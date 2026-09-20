import { createServerClient as createCookieServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getSupabasePublicKey, getSupabaseUrl } from './config'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createCookieServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies. The proxy refreshes sessions
          // before rendering, while route handlers can write them directly.
        }
      },
    },
  })
}
