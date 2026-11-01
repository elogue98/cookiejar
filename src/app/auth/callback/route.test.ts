import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { FamilyAuthError } from '@/lib/auth'
const mocks = vi.hoisted(() => ({ profile: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/auth', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/auth')>(), requireFamilyProfile: mocks.profile }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ auth: {
  exchangeCodeForSession: async () => ({ error: null }), signOut: mocks.signOut,
} }) }))
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example') })
afterEach(() => vi.unstubAllEnvs())
describe('sign-in callback', () => {
  it('keeps a newly issued session when profile verification is temporarily unavailable', async () => {
    mocks.profile.mockRejectedValue(new FamilyAuthError('AUTH_CONFIGURATION_ERROR', 500, 'Unavailable'))
    const response = await GET(new Request('https://app.example/auth/callback?code=test-code'))
    expect(response.headers.get('location')).toBe('https://app.example/login?error=auth-error')
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
  it('still signs out accounts with no family link', async () => {
    mocks.profile.mockRejectedValue(new FamilyAuthError('PROFILE_NOT_LINKED', 403, 'Not linked'))
    const response = await GET(new Request('https://app.example/auth/callback?code=test-code'))
    expect(response.headers.get('location')).toBe('https://app.example/login?error=not-linked')
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
})
