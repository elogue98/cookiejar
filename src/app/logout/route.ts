import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'
import { ApiError, apiErrorResponse } from '@/lib/apiErrors'
import { assertSameOrigin } from '@/lib/apiSecurity'

export async function GET() {
  return apiErrorResponse(new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST to sign out'))
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const supabase = await createServerClient()
    await supabase.auth.signOut({ scope: 'local' })
    const response = NextResponse.json({ success: true })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return apiErrorResponse(error)
  }
}
