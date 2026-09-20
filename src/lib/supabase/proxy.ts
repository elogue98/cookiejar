import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { getSupabasePublicKey, getSupabaseUrl } from './config'

const PUBLIC_PATHS = new Set(['/login', '/auth/callback', '/logout', '/train/highlights'])

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/')
  const isPublicPath = PUBLIC_PATHS.has(request.nextUrl.pathname)

  if (!data?.claims?.sub && !isApiRequest && !isPublicPath) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    const redirectResponse = NextResponse.redirect(loginUrl)
    copyResponseCookies(response, redirectResponse)
    return redirectResponse
  }

  if (data?.claims?.sub && request.nextUrl.pathname === '/login') {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    const redirectResponse = NextResponse.redirect(homeUrl)
    copyResponseCookies(response, redirectResponse)
    return redirectResponse
  }

  return response
}
