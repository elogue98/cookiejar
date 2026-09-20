'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getSupabasePublicKey, getSupabaseUrl } from './config'

export const supabase = createBrowserClient(getSupabaseUrl(), getSupabasePublicKey(), {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
