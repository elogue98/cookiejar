import { config as loadEnv } from 'dotenv'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LinkInput = {
  profileId: string
  email: string
}

type LinkClient = {
  auth: {
    admin: {
      listUsers: (options: { page: number; perPage: number }) => Promise<{
        data: { users: Array<{ id: string; email?: string | null; invited_at?: string | null }> }
        error: unknown
      }>
    }
  }
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }>
      }
    }
    insert: (values: { profile_id: string; auth_user_id: string }) => Promise<{ error: unknown }>
  }
}

export async function linkAuthProfile(client: LinkClient, input: LinkInput) {
  const profileId = input.profileId.trim()
  const email = input.email.trim().toLowerCase()

  if (!UUID_PATTERN.test(profileId)) throw new Error('Invalid profile id')
  if (!email || !email.includes('@') || email.length > 320) throw new Error('Invalid email')

  const profile = await client.from('users').select('id').eq('id', profileId).maybeSingle()
  if (profile.error || !profile.data) throw new Error('Family profile not found')

  let invitedUser: { id: string; email?: string | null; invited_at?: string | null } | undefined
  for (let page = 1; page <= 100 && !invitedUser; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (result.error) throw new Error('Could not list invited accounts')
    invitedUser = result.data.users.find(
      (user) => user.invited_at && user.email?.trim().toLowerCase() === email,
    )
    if (result.data.users.length < 1000) break
  }

  if (!invitedUser) throw new Error('No invited account matched')

  const { error } = await client.from('user_auth_links').insert({
    profile_id: profileId,
    auth_user_id: invitedUser.id,
  })
  if (error) throw new Error('Could not create account link')

  return { profileId, authUserId: invitedUser.id }
}

function parseArgs(argv: string[]): LinkInput {
  const profileIndex = argv.indexOf('--profile-id')
  const emailIndex = argv.indexOf('--email')
  const profileId = profileIndex >= 0 ? argv[profileIndex + 1] : undefined
  const email = emailIndex >= 0 ? argv[emailIndex + 1] : undefined
  if (!profileId || !email) throw new Error('Usage: link-auth-profile --profile-id <uuid> --email <email>')
  return { profileId, email }
}

async function main() {
  const result = await linkAuthProfile(createAdminClient() as unknown as LinkClient, parseArgs(process.argv.slice(2)))
  console.log(`Linked auth user ${result.authUserId} to profile ${result.profileId}`)
}

if (process.argv[1]?.endsWith('link-auth-profile.ts')) {
  main().catch(() => {
    console.error('Account linking failed')
    process.exitCode = 1
  })
}
