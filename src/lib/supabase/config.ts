const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function getSupabaseUrl(): string {
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }

  try {
    const parsed = new URL(supabaseUrl)
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      throw new Error('invalid hostname')
    }
  } catch {
    throw new Error('Invalid NEXT_PUBLIC_SUPABASE_URL')
  }

  return supabaseUrl
}

export function getSupabasePublicKey(): string {
  if (!supabasePublicKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return supabasePublicKey
}
