import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    const supabase = createServerClient()

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
        { success: false, error: `Database error: ${ratingsError.message}` },
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
    if (userId && ratings) {
      const userRatingData = ratings.find((r) => r.user_id === userId)
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
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await req.json()
    const { userId, rating } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 })
    }

    const ratingNum = typeof rating === 'string' ? parseFloat(rating) : Number(rating)
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
      return NextResponse.json(
        { success: false, error: 'Rating must be a number between 1 and 10' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data: existingRating, error: checkError } = await supabase
      .from('place_ratings')
      .select('*')
      .eq('place_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      if (checkError.code === '42P01' || checkError.message.includes('does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error:
              'place_ratings table does not exist. Please run migration_create_place_ratings_table.sql first.',
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
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating place rating:', error)
        return NextResponse.json(
          { success: false, error: `Database error: ${error.message}` },
          { status: 500 }
        )
      }
    } else {
      const { error } = await supabase.from('place_ratings').insert({
        place_id: id,
        user_id: userId,
        rating: ratingNum,
      })

      if (error) {
        console.error('Error creating place rating:', error)
        return NextResponse.json(
          { success: false, error: `Database error: ${error.message}` },
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
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    )
  }
}


