import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'

/**
 * GET /api/recipes/[id]/ratings
 * 
 * Gets rating information for a recipe:
 * - Current user's rating (if logged in)
 * - Average rating across all users
 * - Total number of ratings
 * 
 * Query params: userId (optional)
 * Returns: { success: boolean, data?: { userRating: number | null, averageRating: number | null, totalRatings: number }, error?: string }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    const supabase = createServerClient()

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
        { success: false, error: `Database error: ${ratingsError.message}` },
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

    // Get current user's rating if userId is provided
    let userRating: number | null = null
    if (userId && ratings) {
      const userRatingData = ratings.find(r => r.user_id === userId)
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
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recipes/[id]/ratings
 * 
 * Creates or updates a user's rating for a recipe.
 * 
 * Body: { userId: string, rating: number }
 * Returns: { success: boolean, data?: { userRating: number, averageRating: number, totalRatings: number }, error?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { userId, rating } = body

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (rating === undefined || rating === null) {
      return NextResponse.json(
        { success: false, error: 'Rating is required' },
        { status: 400 }
      )
    }

    const ratingNum = typeof rating === 'string' ? parseInt(rating, 10) : Number(rating)
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
      return NextResponse.json(
        { success: false, error: 'Rating must be a number between 1 and 10' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Check if ratings table exists, if not return error
    const { data: existingRating, error: checkError } = await supabase
      .from('ratings')
      .select('*')
      .eq('recipe_id', id)
      .eq('user_id', userId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      // If table doesn't exist, return error
      if (checkError.code === '42P01' || checkError.message.includes('does not exist')) {
        return NextResponse.json(
          { success: false, error: 'Ratings table does not exist. Please run the migration_create_ratings_table.sql migration first.' },
          { status: 500 }
        )
      }
      console.error('Error checking existing rating:', checkError)
    }

    let result
    if (existingRating) {
      // Update existing rating
      const { data, error } = await supabase
        .from('ratings')
        .update({ rating: ratingNum, updated_at: new Date().toISOString() })
        .eq('recipe_id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('Error updating rating:', error)
        return NextResponse.json(
          { success: false, error: `Database error: ${error.message}` },
          { status: 500 }
        )
      }
      result = data
    } else {
      // Insert new rating
      const { data, error } = await supabase
        .from('ratings')
        .insert({
          recipe_id: id,
          user_id: userId,
          rating: ratingNum
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating rating:', error)
        return NextResponse.json(
          { success: false, error: `Database error: ${error.message}` },
          { status: 500 }
        )
      }
      result = data
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
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

