import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 405 | 413 | 429 | 502 | 500,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
  const response = NextResponse.json(
    { success: false, error: apiError.message, code: apiError.code },
    { status: apiError.status },
  )
  response.headers.set('Cache-Control', 'no-store')
  if (apiError.retryAfterSeconds !== undefined) {
    response.headers.set('Retry-After', String(apiError.retryAfterSeconds))
  }
  return response
}

export function badRequest(message: string, code = 'INVALID_REQUEST'): ApiError {
  return new ApiError(400, code, message)
}
