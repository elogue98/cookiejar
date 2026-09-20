import { redirect } from 'next/navigation'

import { FamilyAuthError, requireFamilyProfile } from './auth'

/**
 * Server-component boundary for family-only pages. Route handlers use
 * requireFamilyProfile directly so they can return an API error envelope;
 * pages redirect safely instead of rendering a framework error screen.
 */
export async function requireFamilyPage() {
  try {
    return await requireFamilyProfile()
  } catch (error) {
    if (error instanceof FamilyAuthError && error.code === 'PROFILE_NOT_LINKED') {
      redirect('/login?error=not-linked')
    }
    if (error instanceof FamilyAuthError && error.code === 'AUTH_CONFIGURATION_ERROR') {
      redirect('/login?error=auth-error')
    }
    redirect('/login')
  }
}
