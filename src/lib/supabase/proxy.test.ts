import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { updateSession } from './proxy'
const mocks = vi.hoisted(() => ({ claims: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getClaims: mocks.claims } }) }))
vi.mock('./config', () => ({ getSupabaseUrl: () => 'https://project.supabase.co', getSupabasePublicKey: () => 'public-test-key' }))
beforeEach(() => vi.clearAllMocks())
describe('session proxy', () => {
  it.each(['/admin/login', '/auth/admin/login'])('allows the hidden entry without a session: %s', async path => {
    mocks.claims.mockResolvedValue({ data: null, error: null })
    const response = await updateSession(new NextRequest(`https://app.example${path}`))
    expect(response.headers.get('location')).toBeNull()
  })
  it('returns a retryable failure rather than a login redirect during an auth outage', async () => {
    mocks.claims.mockResolvedValue({ data: null, error: { name: 'AuthRetryableFetchError', __isAuthError: true } })
    const response = await updateSession(new NextRequest('https://app.example/'))
    expect(response.status).toBe(503)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('allows recovery on the login page even with a valid auth token', async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null })
    const response = await updateSession(new NextRequest('https://app.example/login?error=auth-error'))
    expect(response.headers.get('location')).toBeNull()
  })
  it('still redirects a genuinely missing session to login', async () => {
    mocks.claims.mockResolvedValue({ data: null, error: null })
    const response = await updateSession(new NextRequest('https://app.example/'))
    expect(response.headers.get('location')).toBe('https://app.example/login')
  })
})
