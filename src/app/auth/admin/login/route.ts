import { NextResponse } from 'next/server'
import { getAdminLoginConfig, readAdminPassword } from '@/lib/adminLogin'
import { ApiError, apiErrorResponse } from '@/lib/apiErrors'
import { assertSameOrigin } from '@/lib/apiSecurity'
import { FamilyAuthError, requireFamilyProfile } from '@/lib/auth'
import { isTemporaryAuthError } from '@/lib/authAvailability'
import { enforceRateLimit } from '@/lib/rateLimit'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  let signedInClient: Awaited<ReturnType<typeof createServerClient>> | undefined
  try {
    assertSameOrigin(request)
    const config = getAdminLoginConfig()
    const password = await readAdminPassword(request)
    await enforceRateLimit(config.profileId, 'admin-login', [
      { seconds: 600, limit: 10 },
      { seconds: 86_400, limit: 50 },
    ])
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: config.email, password })
    if (error) {
      if (isTemporaryAuthError(error)) throw error
      throw new ApiError(401, 'INVALID_PASSWORD', 'Incorrect password.')
    }
    signedInClient = supabase
    const profile = await requireFamilyProfile()
    if (!data.user || profile.profileId !== config.profileId || profile.authUserId !== data.user.id) {
      throw new ApiError(401, 'INVALID_PASSWORD', 'Incorrect password.')
    }
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (signedInClient) {
      try { await signedInClient.auth.signOut({ scope: 'local' }) } catch { /* Access remains denied. */ }
    }
    if (error instanceof ApiError) return apiErrorResponse(error)
    if (error instanceof FamilyAuthError && error.status !== 500) {
      return apiErrorResponse(new ApiError(401, 'INVALID_PASSWORD', 'Incorrect password.'))
    }
    return apiErrorResponse(new ApiError(502, 'AUTH_UNAVAILABLE', 'Password sign-in is temporarily unavailable. Please try again.'))
  }
}
