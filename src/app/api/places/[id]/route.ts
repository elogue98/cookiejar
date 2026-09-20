import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { apiErrorResponse } from '@/lib/apiErrors'
import { parseJsonRequest } from '@/lib/validation'

const placeUpdateSchema = z.object({ notes: z.string().max(20_000).nullable() }).strict()

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(_req, { stateChanging: true })
  if (auth.error) return auth.error
  const rateLimitError = await checkApiRateLimit(auth.profile!.profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Place id is required', code: 'INVALID_REQUEST' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { error: ratingsError } = await supabase.from('place_ratings').delete().eq('place_id', id)
    if (ratingsError) {
      console.error('Failed to delete ratings for place', ratingsError)
    }

    const { error: placeError } = await supabase.from('places').delete().eq('id', id)
    if (placeError) {
      return NextResponse.json({ success: false, error: 'Could not delete place', code: 'DATABASE_ERROR' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting place', error)
    return apiErrorResponse(error)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const rateLimitError = await checkApiRateLimit(auth.profile!.profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Place id is required', code: 'INVALID_REQUEST' }, { status: 400 })
    }

    const { notes } = await parseJsonRequest(req, placeUpdateSchema)

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('places')
      .update({ notes })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: 'Could not update place', code: 'DATABASE_ERROR' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error updating place', error)
    return apiErrorResponse(error)
  }
}
