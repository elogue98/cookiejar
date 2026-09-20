import { NextResponse } from 'next/server'

import { FamilyAuthError, requireFamilyProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { profileId } = await requireFamilyProfile()
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('id', profileId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Profile unavailable', code: 'PROFILE_UNAVAILABLE' },
        { status: 403 },
      )
    }

    const response = NextResponse.json({ success: true, data })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    if (error instanceof FamilyAuthError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { success: false, error: 'Profile unavailable', code: 'PROFILE_UNAVAILABLE' },
      { status: 500 },
    )
  }
}
