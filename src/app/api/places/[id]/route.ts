import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Place id is required' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { error: ratingsError } = await supabase.from('place_ratings').delete().eq('place_id', id)
    if (ratingsError) {
      console.error('Failed to delete ratings for place', ratingsError)
    }

    const { error: placeError } = await supabase.from('places').delete().eq('id', id)
    if (placeError) {
      return NextResponse.json({ success: false, error: placeError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting place', error)
    return NextResponse.json(
      { success: false, error: 'Unexpected error deleting place' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Place id is required' }, { status: 400 })
    }

    const body = await req.json()
    const { notes } = body

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('places')
      .update({ notes })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error updating place', error)
    return NextResponse.json(
      { success: false, error: 'Unexpected error updating place' },
      { status: 500 }
    )
  }
}

