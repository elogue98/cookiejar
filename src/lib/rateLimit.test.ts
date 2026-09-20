import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAdminClient } from './supabase/admin'
import { enforceRateLimit } from './rateLimit'

vi.mock('./supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

describe('enforceRateLimit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows a request when every configured window has capacity', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null })
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never)

    await expect(enforceRateLimit('profile-1', 'imports', [{ seconds: 3600, limit: 20 }])).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('consume_rate_limits', {
      p_profile_id: 'profile-1',
      p_bucket: 'imports',
      p_windows: [{ seconds: 3600, limit: 20 }],
    })
  })

  it('throws a 429 with a retry duration when the RPC rejects the request', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 42 }], error: null })
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never)

    await expect(enforceRateLimit('profile-1', 'imports', [{ seconds: 3600, limit: 20 }]))
      .rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 42 })
  })

  it('fails closed when the limiter cannot be reached', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('database unavailable') })
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never)

    await expect(enforceRateLimit('profile-1', 'imports', [{ seconds: 3600, limit: 20 }]))
      .rejects.toMatchObject({ status: 502, code: 'RATE_LIMIT_UNAVAILABLE' })
  })
})
