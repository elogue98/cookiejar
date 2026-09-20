import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { apiErrorResponse } from '@/lib/apiErrors'
import { parseJsonRequest, ratingRequestSchema } from '@/lib/validation'

/**
 * GET /api/recipes/[id]/ratings
 * 
 * Gets rating information for a recipe:
 * - Current user's rating (if logged in)
 * - Average rating across all users
 * - Total number of ratings
 * 
 * The current user's rating is derived from the authenticated family mapping.
 * Returns: { success: boolean, data?: { userRating: number | null, averageRating: number | null, totalRatings: number }, error?: string }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(req)
  if (auth.error) return auth.error
  const profileId = auth.profile!.profileId

  try {
    const { id } = await params
    const supabase = await createServerClient()

    // Get all ratings for this recipe
    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .select('*')
      .eq('recipe_id', id)

    if (ratingsError) {
      // If ratings table doesn't exist, return null values
      if (ratingsError.code === '42P01' || ratingsError.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: {
            userRating: null,
            averageRating: null,
            totalRatings: 0
          }
        })
      }
      console.error('Error fetching ratings:', ratingsError)
      return NextResponse.json(
        { success: false, error: 'Could not fetch ratings', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    // Calculate average rating
    let averageRating: number | null = null
    const totalRatings = ratings?.length || 0
    
    if (totalRatings > 0 && ratings) {
      const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
      averageRating = Math.round((sum / totalRatings) * 10) / 10 // Round to 1 decimal place
    }

    let userRating: number | null = null
    if (ratings) {
      const userRatingData = ratings.find(r => r.user_id === profileId)
      userRating = userRatingData?.rating || null
    }

    return NextResponse.json({
      success: true,
      data: {
        userRating,
        averageRating,
        totalRatings
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return apiErrorResponse(error)
  }
}

/**
 * POST /api/recipes/[id]/ratings
 * 
 * Creates or updates a user's rating for a recipe.
 * 
 * Body: { rating: number }
 * Returns: { success: boolean, data?: { userRating: number, averageRating: number, totalRatings: number }, error?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const profileId = auth.profile!.profileId
  const rateLimitError = await checkApiRateLimit(profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await params
    const { rating } = await parseJsonRequest(req, ratingRequestSchema)

    if (rating === undefined || rating === null) {
      return NextResponse.json(
        { success: false, error: 'Rating is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const ratingNum = Number(rating)
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
      return NextResponse.json(
        { success: false, error: 'Rating must be a number between 1 and 10', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Check if ratings table exists, if not return error
    const { data: existingRating, error: checkError } = await supabase
      .from('ratings')
      .select('*')
      .eq('recipe_id', id)
      .eq('user_id', profileId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      // If table doesn't exist, return error
      if (checkError.code === '42P01' || checkError.message.includes('does not exist')) {
        return NextResponse.json(
          { success: false, error: 'Ratings are temporarily unavailable', code: 'DATABASE_ERROR' },
          { status: 500 }
        )
      }
      console.error('Error checking existing rating:', checkError)
    }

    if (existingRating) {
      // Update existing rating
      const { error } = await supabase
        .from('ratings')
        .update({ rating: ratingNum, updated_at: new Date().toISOString() })
        .eq('recipe_id', id)
        .eq('user_id', profileId)
        .select()
        .single()

      if (error) {
        console.error('Error updating rating:', error)
        return NextResponse.json(
          { success: false, error: 'Could not update rating', code: 'DATABASE_ERROR' },
          { status: 500 }
        )
      }
    } else {
      // Insert new rating
      const { error } = await supabase
        .from('ratings')
        .insert({
          recipe_id: id,
          user_id: profileId,
          rating: ratingNum
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating rating:', error)
        return NextResponse.json(
          { success: false, error: 'Could not create rating', code: 'DATABASE_ERROR' },
          { status: 500 }
        )
      }
    }

    // Get updated average rating
    const { data: allRatings, error: avgError } = await supabase
      .from('ratings')
      .select('rating')
      .eq('recipe_id', id)

    if (avgError) {
      console.error('Error fetching ratings for average:', avgError)
    }

    let averageRating: number | null = null
    const totalRatings = allRatings?.length || 0
    
    if (totalRatings > 0 && allRatings) {
      const sum = allRatings.reduce((acc, r) => acc + r.rating, 0)
      averageRating = Math.round((sum / totalRatings) * 10) / 10
    }

    return NextResponse.json({
      success: true,
      data: {
        userRating: ratingNum,
        averageRating,
        totalRatings
      }
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
