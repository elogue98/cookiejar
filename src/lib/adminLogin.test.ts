import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAdminLoginConfig } from './adminLogin'

afterEach(() => vi.unstubAllEnvs())

describe('admin account configuration', () => {
  it('accepts existing PostgreSQL profile UUIDs without imposing RFC version bits', () => {
    vi.stubEnv('ADMIN_LOGIN_EMAIL', 'owner@example.com')
    vi.stubEnv('ADMIN_LOGIN_PROFILE_ID', '11111111-1111-1111-1111-111111111111')
    expect(getAdminLoginConfig()).toEqual({ email: 'owner@example.com', profileId: '11111111-1111-1111-1111-111111111111' })
  })
  it.each(['not-a-uuid', '', '11111111-1111-1111-1111-111111111111/other'])('rejects malformed profile identifiers: %s', profileId => {
    vi.stubEnv('ADMIN_LOGIN_EMAIL', 'owner@example.com')
    vi.stubEnv('ADMIN_LOGIN_PROFILE_ID', profileId)
    expect(() => getAdminLoginConfig()).toThrow('Password sign-in has not been configured yet.')
  })
})
