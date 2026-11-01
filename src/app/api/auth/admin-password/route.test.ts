import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FamilyAuthError } from '@/lib/auth'
import { POST } from './route'

const mocks = vi.hoisted(() => ({ profile: vi.fn(), update: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/auth', async original => ({ ...await original<typeof import('@/lib/auth')>(), requireFamilyProfile: mocks.profile }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ auth: { updateUser: mocks.update } }) }))
vi.mock('@/lib/rateLimit', () => ({ enforceRateLimit: mocks.limit }))
const profileId = '11111111-1111-4111-8111-111111111111'
function request(password: unknown = 'a long test password', origin = 'https://app.example') {
  return new Request('https://app.example/api/auth/admin-password', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ADMIN_LOGIN_EMAIL', 'owner@example.com')
  vi.stubEnv('ADMIN_LOGIN_PROFILE_ID', profileId)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example')
  mocks.profile.mockResolvedValue({ profileId, authUserId: 'auth-owner' })
  mocks.update.mockResolvedValue({ error: null })
})
afterEach(() => vi.unstubAllEnvs())
describe('owner password setup', () => {
  it('updates only the authenticated configured profile password', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ password: 'a long test password' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('denies unauthenticated requests', async () => {
    mocks.profile.mockRejectedValue(new FamilyAuthError('UNAUTHENTICATED', 401, 'Authentication required'))
    expect((await POST(request())).status).toBe(401)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('denies other family profiles', async () => {
    mocks.profile.mockResolvedValue({ profileId: 'other' })
    expect((await POST(request())).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects foreign origins', async () => {
    expect((await POST(request(undefined, 'https://evil.example'))).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects short passwords', async () => {
    expect((await POST(request('short'))).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('fails closed when password entrance configuration is missing', async () => {
    vi.stubEnv('ADMIN_LOGIN_PROFILE_ID', '')
    expect((await POST(request())).status).toBe(500)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('returns a retryable failure when password storage is unavailable', async () => {
    mocks.update.mockRejectedValue(new TypeError('private details'))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('private')
  })
  it('returns safe errors when the configured password policy rejects an update', async () => {
    mocks.update.mockResolvedValue({ error: { status: 422, message: 'private details' } })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(JSON.stringify(await response.json())).not.toContain('private')
  })
})
