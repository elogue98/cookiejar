import { createClient } from '@supabase/supabase-js'

import { getSupabaseUrl } from './config'

/**
 * The service-role client bypasses RLS. Keep imports of this module limited to
 * rate limiting and explicitly invoked account-linking tooling.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
