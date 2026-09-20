import { ApiError } from './apiErrors'
import { createAdminClient } from './supabase/admin'

export type RateWindow = { seconds: number; limit: number }

export const RATE_LIMITS = {
  imports: [{ seconds: 3_600, limit: 20 }, { seconds: 86_400, limit: 60 }],
  assistant: [{ seconds: 600, limit: 30 }, { seconds: 86_400, limit: 200 }],
  places: [{ seconds: 3_600, limit: 30 }],
  writes: [{ seconds: 600, limit: 120 }],
} as const

export async function enforceRateLimit(
  profileId: string,
  bucket: string,
  windows: readonly RateWindow[],
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('consume_rate_limits', {
      p_profile_id: profileId,
      p_bucket: bucket,
      p_windows: windows,
    })
    if (error || !Array.isArray(data) || !data[0]) throw new Error('rate limit RPC failed')

    const result = data[0] as { allowed?: boolean; retry_after_seconds?: number }
    if (!result.allowed) {
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many requests. Try again later.',
        Math.max(1, Number(result.retry_after_seconds) || 1),
      )
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'RATE_LIMIT_UNAVAILABLE', 'Request protection is temporarily unavailable')
  }
}
