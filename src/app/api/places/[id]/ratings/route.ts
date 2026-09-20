import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { apiErrorResponse } from '@/lib/apiErrors'
import { parseJsonRequest, ratingRequestSchema } from '@/lib/validation'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  const auth = await authenticateApiRequest(req)
  if (auth.error) return auth.error
  const profileId = auth.profile!.profileId

  try {
    const { id } = await params
    const supabase = await createServerClient()

    const { data: ratings, error: ratingsError } = await supabase
      .from('place_ratings')
      .select('*')
      .eq('place_id', id)

    if (ratingsError) {
      if (ratingsError.code === '42P01' || ratingsError.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: {
            userRating: null,
            averageRating: null,
            totalRatings: 0,
          },
        })
      }
      console.error('Error fetching place ratings:', ratingsError)
      return NextResponse.json(
        { success: false, error: 'Could not fetch place ratings', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    let averageRating: number | null = null
    const totalRatings = ratings?.length || 0

    if (totalRatings > 0 && ratings) {
      const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
      averageRating = Math.round((sum / totalRatings) * 10) / 10
    }

    let userRating: number | null = null
    if (ratings) {
      const userRatingData = ratings.find((r) => r.user_id === profileId)
      userRating = userRatingData?.rating ?? null
    }

    return NextResponse.json({
      success: true,
      data: {
        userRating,
        averageRating,
        totalRatings,
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return apiErrorResponse(error)
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const profileId = auth.profile!.profileId
  const rateLimitError = await checkApiRateLimit(profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await params
    const { rating } = await parseJsonRequest(req, ratingRequestSchema)

    const ratingNum = Number(rating)
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
      return NextResponse.json(
        { success: false, error: 'Rating must be a number between 1 and 10', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    const { data: existingRating, error: checkError } = await supabase
      .from('place_ratings')
      .select('*')
      .eq('place_id', id)
      .eq('user_id', profileId)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      if (checkError.code === '42P01' || checkError.message.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Place ratings are temporarily unavailable',
            code: 'DATABASE_ERROR',
          },
          { status: 500 }
        )
      }
      console.error('Error checking existing place rating:', checkError)
    }

    if (existingRating) {
      const { error } = await supabase
        .from('place_ratings')
        .update({ rating: ratingNum, updated_at: new Date().toISOString() })
        .eq('place_id', id)
        .eq('user_id', profileId)

      if (error) {
        console.error('Error updating place rating:', error)
        return NextResponse.json(
          { success: false, error: 'Could not update place rating', code: 'DATABASE_ERROR' },
          { status: 500 }
        )
      }
    } else {
      const { error } = await supabase.from('place_ratings').insert({
        place_id: id,
        user_id: profileId,
        rating: ratingNum,
      })

      if (error) {
        console.error('Error creating place rating:', error)
        return NextResponse.json(
          { success: false, error: 'Could not create place rating', code: 'DATABASE_ERROR' },
          { status: 500 }
        )
      }
    }

    // Update place status to visited when rated
    await supabase.from('places').update({ status: 'visited' }).eq('id', id)

    // Compute updated average
    const { data: allRatings, error: avgError } = await supabase
      .from('place_ratings')
      .select('rating')
      .eq('place_id', id)

    if (avgError) {
      console.error('Error fetching place ratings for average:', avgError)
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
        totalRatings,
      },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
