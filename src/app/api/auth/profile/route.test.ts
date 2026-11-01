import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
const mocks = vi.hoisted(() => ({ profile: vi.fn() }))
vi.mock('@/lib/auth', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/auth')>(), requireFamilyProfile: async () => ({ profileId: 'u1' }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }) }) }))
beforeEach(() => vi.clearAllMocks())
describe('profile availability', () => {
  it('returns a temporary failure rather than revoking access on database errors', async () => {
    mocks.profile.mockResolvedValue({ data: null, error: { code: 'connection-error' } })
    const response = await GET()
    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('still denies access when the linked profile is actually missing', async () => {
    mocks.profile.mockResolvedValue({ data: null, error: null })
    expect((await GET()).status).toBe(403)
  })
})
