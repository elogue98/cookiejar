import { FamilyAuthError, requireFamilyProfile, type FamilyProfile } from './auth'
import { ApiError, apiErrorResponse } from './apiErrors'
import { enforceRateLimit, type RateWindow } from './rateLimit'
import type { NextResponse } from 'next/server'

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>()
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
  if (configuredOrigin) {
    try {
      const parsed = new URL(configuredOrigin)
      if (process.env.NODE_ENV !== 'production' || parsed.protocol === 'https:') {
        origins.add(parsed.origin)
      }
    } catch {
      // Invalid deployment configuration is handled by the request origin.
    }
  }
  // In production, require an explicit trusted application origin. Falling
  // back to the request Host would let a forged Host header become trusted.
  if (process.env.NODE_ENV !== 'production') {
    origins.add(new URL(request.url).origin)
  }
  return origins
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  if (!origin || !allowedOrigins(request).has(origin)) {
    throw new ApiError(403, 'INVALID_ORIGIN', 'Request origin is not allowed')
  }
}

export async function requireApiFamilyProfile(
  request: Request,
  options: { stateChanging?: boolean } = {},
): Promise<FamilyProfile> {
  try {
    const profile = await requireFamilyProfile()
    if (options.stateChanging) {
      assertSameOrigin(request)
    }
    return profile
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof FamilyAuthError) {
      throw new ApiError(error.status === 500 ? 500 : error.status, error.code, error.message)
    }
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required')
  }
}

export async function authenticateApiRequest(
  request: Request,
  options: { stateChanging?: boolean } = {},
): Promise<{ profile: FamilyProfile | null; error: NextResponse | null }> {
  try {
    return { profile: await requireApiFamilyProfile(request, options), error: null }
  } catch (error) {
    return { profile: null, error: apiErrorResponse(error) }
  }
}

export async function checkApiRateLimit(
  profileId: string,
  bucket: string,
  windows: readonly RateWindow[],
): Promise<NextResponse | null> {
  try {
    await enforceRateLimit(profileId, bucket, windows)
    return null
  } catch (error) {
    return apiErrorResponse(error)
  }
}
