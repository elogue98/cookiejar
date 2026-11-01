import { NextResponse } from 'next/server'
import { getAdminLoginConfig, readAdminPassword } from '@/lib/adminLogin'
import { ApiError, apiErrorResponse } from '@/lib/apiErrors'
import { assertSameOrigin } from '@/lib/apiSecurity'
import { FamilyAuthError, requireFamilyProfile } from '@/lib/auth'
import { isTemporaryAuthError } from '@/lib/authAvailability'
import { enforceRateLimit } from '@/lib/rateLimit'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const profile = await requireFamilyProfile()
    assertSameOrigin(request)
    const config = getAdminLoginConfig()
    if (profile.profileId !== config.profileId) throw new ApiError(403, 'FORBIDDEN', 'This password entrance belongs to another account.')
    const password = await readAdminPassword(request, 12)
    await enforceRateLimit(profile.profileId, 'admin-password', [{ seconds: 600, limit: 5 }])
    const supabase = await createServerClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      if (isTemporaryAuthError(error)) throw error
      throw new ApiError(400, 'PASSWORD_REJECTED', 'Password could not be saved. Use a stronger password, or sign in again by email and retry.')
    }
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error)
    if (error instanceof FamilyAuthError) {
      return apiErrorResponse(new ApiError(error.status, error.code, error.message))
    }
    return apiErrorResponse(new ApiError(502, 'AUTH_UNAVAILABLE', 'Password setup is temporarily unavailable. Please try again.'))
  }
}
