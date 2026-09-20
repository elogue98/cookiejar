import { createServerClient } from './supabase/server'

export type FamilyProfile = {
  authUserId: string
  profileId: string
}

export type FamilyAuthErrorCode =
  | 'UNAUTHENTICATED'
  | 'PROFILE_NOT_LINKED'
  | 'AUTH_CONFIGURATION_ERROR'

export class FamilyAuthError extends Error {
  readonly status: 401 | 403 | 500
  readonly code: FamilyAuthErrorCode

  constructor(code: FamilyAuthErrorCode, status: 401 | 403 | 500, message: string) {
    super(message)
    this.name = 'FamilyAuthError'
    this.status = status
    this.code = code
  }
}

async function signOutQuietly(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // The authorization failure is still safe even if cookie cleanup is not
    // available in the current rendering context.
  }
}

export async function requireFamilyProfile(): Promise<FamilyProfile> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.getClaims()
  const authUserId = data?.claims?.sub

  if (error || typeof authUserId !== 'string' || authUserId.length === 0) {
    await signOutQuietly(supabase)
    throw new FamilyAuthError('UNAUTHENTICATED', 401, 'Authentication required')
  }

  const { data: link, error: linkError } = await supabase
    .from('user_auth_links')
    .select('profile_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (linkError) {
    throw new FamilyAuthError('AUTH_CONFIGURATION_ERROR', 500, 'Authentication is temporarily unavailable')
  }

  if (!link || typeof link.profile_id !== 'string' || link.profile_id.length === 0) {
    await signOutQuietly(supabase)
    throw new FamilyAuthError('PROFILE_NOT_LINKED', 403, 'This account is not linked to a family profile')
  }

  return { authUserId, profileId: link.profile_id }
}
