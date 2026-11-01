import { isAuthRetryableFetchError } from '@supabase/supabase-js'

/** A service/network failure must not be treated as an invalid saved login. */
export function isTemporaryAuthError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return true
  if (error && typeof error === 'object' && 'status' in error) {
    return typeof error.status === 'number' && (error.status === 429 || error.status >= 500)
  }
  return false
}
