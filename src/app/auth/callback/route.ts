import { NextResponse } from 'next/server'

import { FamilyAuthError, requireFamilyProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
  let appOrigin = url.origin
  if (configuredAppUrl) {
    try {
      const configuredOrigin = new URL(configuredAppUrl)
      if (process.env.NODE_ENV === 'production' && configuredOrigin.protocol !== 'https:') {
        throw new Error('HTTPS application URL required')
      }
      appOrigin = configuredOrigin.origin
    } catch {
      return NextResponse.json(
        { success: false, error: 'Authentication is temporarily unavailable', code: 'AUTH_CONFIGURATION_ERROR' },
        { status: 500 },
      )
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Authentication is temporarily unavailable', code: 'AUTH_CONFIGURATION_ERROR' },
      { status: 500 },
    )
  }
  const code = url.searchParams.get('code')
  const redirectToLogin = (error: string) => {
    const loginUrl = new URL('/login', appOrigin)
    loginUrl.searchParams.set('error', error)
    return NextResponse.redirect(loginUrl)
  }

  if (!code) return redirectToLogin('invalid-link')

  const supabase = await createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return redirectToLogin('invalid-link')

  try {
    await requireFamilyProfile()
  } catch (error) {
    await supabase.auth.signOut({ scope: 'local' })
    if (error instanceof FamilyAuthError && error.code === 'PROFILE_NOT_LINKED') {
      return redirectToLogin('not-linked')
    }
    return redirectToLogin('auth-error')
  }

  return NextResponse.redirect(new URL('/', appOrigin))
}
