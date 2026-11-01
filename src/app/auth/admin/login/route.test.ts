import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/apiErrors'
import { FamilyAuthError } from '@/lib/auth'
import { POST } from './route'

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), profile: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut } }) }))
vi.mock('@/lib/auth', async original => ({ ...await original<typeof import('@/lib/auth')>(), requireFamilyProfile: mocks.profile }))
vi.mock('@/lib/rateLimit', () => ({ enforceRateLimit: mocks.limit }))

const profileId = '11111111-1111-4111-8111-111111111111'
function request(body: unknown = { password: 'test password' }, origin = 'https://app.example') {
  return new Request('https://app.example/auth/admin/login', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ADMIN_LOGIN_EMAIL', 'owner@example.com')
  vi.stubEnv('ADMIN_LOGIN_PROFILE_ID', profileId)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example')
  mocks.signIn.mockResolvedValue({ data: { user: { id: 'auth-owner' } }, error: null })
  mocks.profile.mockResolvedValue({ profileId, authUserId: 'auth-owner' })
})
afterEach(() => vi.unstubAllEnvs())

describe('password-only sign-in', () => {
  it('uses only the configured account and verifies its linked profile', async () => {
    const response = await POST(request({ password: ' test password ', email: 'attacker@example.com' }))
    expect(response.status).toBe(200)
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'owner@example.com', password: ' test password ' })
    expect(mocks.limit).toHaveBeenCalledWith(profileId, 'admin-login', expect.any(Array))
    expect(mocks.limit.mock.invocationCallOrder[0]).toBeLessThan(mocks.signIn.mock.invocationCallOrder[0])
    expect(mocks.profile).toHaveBeenCalledOnce()
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(JSON.stringify(await response.json())).not.toContain('owner@example.com')
  })
  it.each(['', null, 123, 'x'.repeat(1025)])('rejects an invalid password before authentication: %s', async password => {
    expect((await POST(request({ password }))).status).toBe(400)
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it('rejects oversized and malformed bodies', async () => {
    expect((await POST(request({ extra: 'x'.repeat(5000) }))).status).toBe(413)
    const req = new Request('https://app.example/auth/admin/login', { method: 'POST', headers: { origin: 'https://app.example' }, body: '{' })
    expect((await POST(req)).status).toBe(400)
  })
  it('rejects foreign origins before attempting authentication', async () => {
    expect((await POST(request(undefined, 'https://evil.example'))).status).toBe(403)
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it.each(['ADMIN_LOGIN_EMAIL', 'ADMIN_LOGIN_PROFILE_ID'])('fails closed without %s', async key => {
    vi.stubEnv(key, '')
    expect((await POST(request())).status).toBe(500)
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it('blocks guesses when the shared rate limit is exceeded', async () => {
    mocks.limit.mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'Try later', 60))
    const response = await POST(request())
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it('fails closed when request protection is unavailable', async () => {
    mocks.limit.mockRejectedValue(new ApiError(502, 'RATE_LIMIT_UNAVAILABLE', 'Request protection is temporarily unavailable'))
    expect((await POST(request())).status).toBe(502)
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it('returns a generic invalid-password error', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { status: 400, message: 'private provider details' } })
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'Incorrect password.' })
  })
  it.each(['different-profile', 'unlinked', 'identity-mismatch'])('clears the partial session for %s', async failure => {
    if (failure === 'unlinked') mocks.profile.mockRejectedValue(new FamilyAuthError('PROFILE_NOT_LINKED', 403, 'not linked'))
    else mocks.profile.mockResolvedValue({ profileId: failure === 'different-profile' ? 'other' : profileId, authUserId: failure === 'identity-mismatch' ? 'other' : 'auth-owner' })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('keeps temporary auth failures generic and retryable', async () => {
    mocks.signIn.mockRejectedValue(new TypeError('private connection details'))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('private')
  })
  it('clears a partial session if profile verification is temporarily unavailable', async () => {
    mocks.profile.mockRejectedValue(new FamilyAuthError('AUTH_CONFIGURATION_ERROR', 500, 'private details'))
    expect((await POST(request())).status).toBe(502)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
