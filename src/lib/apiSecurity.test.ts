import { describe, expect, it, vi } from 'vitest'

import { FamilyAuthError } from './auth'
import { ApiError, apiErrorResponse } from './apiErrors'
import { requireApiFamilyProfile } from './apiSecurity'

vi.mock('./auth', () => ({
  FamilyAuthError: class FamilyAuthError extends Error {
    status: number
    code: string
    constructor(code: string, status: number, message: string) {
      super(message)
      this.code = code
      this.status = status
    }
  },
  requireFamilyProfile: vi.fn(),
}))

describe('API security boundary', () => {
  it('returns 401 for a signed-out state-changing request before checking origin', async () => {
    const { requireFamilyProfile } = await import('./auth')
    vi.mocked(requireFamilyProfile).mockRejectedValueOnce(
      new FamilyAuthError('UNAUTHENTICATED', 401, 'Authentication required'),
    )
    const request = new Request('https://cookiejar.example/api/recipes/create', { method: 'POST' })

    await expect(requireApiFamilyProfile(request, { stateChanging: true })).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    })
  })

  it('requires a same-origin header for state-changing requests', async () => {
    const { requireFamilyProfile } = await import('./auth')
    vi.mocked(requireFamilyProfile).mockResolvedValueOnce({ authUserId: 'auth-1', profileId: 'profile-1' })
    const request = new Request('https://cookiejar.example/api/recipes/create', { method: 'POST' })

    await expect(requireApiFamilyProfile(request, { stateChanging: true })).rejects.toMatchObject({
      status: 403,
      code: 'INVALID_ORIGIN',
    })
  })

  it('returns a safe error envelope with no internal details', async () => {
    const response = apiErrorResponse(new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'Provider unavailable'))
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Provider unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
    })
  })

  it('sets Retry-After on rate-limit responses', () => {
    const response = apiErrorResponse(new ApiError(429, 'RATE_LIMITED', 'Try again later', 42))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
  })

  it('maps an unmapped verified user to a 403 without leaking auth details', async () => {
    const { requireFamilyProfile } = await import('./auth')
    vi.mocked(requireFamilyProfile).mockRejectedValueOnce(
      new FamilyAuthError('PROFILE_NOT_LINKED', 403, 'This account is not linked to a family profile'),
    )
    const request = new Request('https://cookiejar.example/api/recipes/create', {
      method: 'POST',
      headers: { Origin: 'https://cookiejar.example' },
    })

    await expect(requireApiFamilyProfile(request, { stateChanging: true })).rejects.toMatchObject({
      status: 403,
      code: 'PROFILE_NOT_LINKED',
    })
  })
})
