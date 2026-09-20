import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createServerClient } from './supabase/server'
import { requireFamilyProfile } from './auth'

vi.mock('./supabase/server', () => ({
  createServerClient: vi.fn(),
}))

type MockClient = {
  auth: {
    getClaims: ReturnType<typeof vi.fn>
    signOut: ReturnType<typeof vi.fn>
  }
  from: ReturnType<typeof vi.fn>
}

const createMockClient = () => {
  const client: MockClient = {
    auth: {
      getClaims: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  }

  vi.mocked(createServerClient).mockReturnValue(client as never)
  return client
}

describe('requireFamilyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the linked family profile for a verified auth claim', async () => {
    const client = createMockClient()
    client.auth.getClaims.mockResolvedValue({
      data: { claims: { sub: 'auth-user-1' } },
      error: null,
    })

    const maybeSingle = vi.fn().mockResolvedValue({
      data: { profile_id: 'profile-eoin' },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    client.from.mockReturnValue({ select })

    await expect(requireFamilyProfile()).resolves.toEqual({
      authUserId: 'auth-user-1',
      profileId: 'profile-eoin',
    })
    expect(client.from).toHaveBeenCalledWith('user_auth_links')
    expect(eq).toHaveBeenCalledWith('auth_user_id', 'auth-user-1')
  })

  it('rejects and signs out when there is no verified session', async () => {
    const client = createMockClient()
    client.auth.getClaims.mockResolvedValue({
      data: null,
      error: new Error('invalid token'),
    })

    await expect(requireFamilyProfile()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    })
    expect(client.auth.signOut).toHaveBeenCalledOnce()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('rejects and signs out an authenticated user with no family link', async () => {
    const client = createMockClient()
    client.auth.getClaims.mockResolvedValue({
      data: { claims: { sub: 'auth-user-unmapped' } },
      error: null,
    })

    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    client.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq }),
    })

    await expect(requireFamilyProfile()).rejects.toMatchObject({
      code: 'PROFILE_NOT_LINKED',
      status: 403,
    })
    expect(client.auth.signOut).toHaveBeenCalledOnce()
  })
})
