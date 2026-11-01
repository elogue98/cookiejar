import { describe, expect, it } from 'vitest'
import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { isTemporaryAuthError } from './authAvailability'

describe('temporary auth failures', () => {
  it.each([new AuthRetryableFetchError('offline', 0), new TypeError('fetch failed'), { status: 503 }, { status: 429 }])('recognizes service/network outages', error => {
    expect(isTemporaryAuthError(error)).toBe(true)
  })
  it.each([null, { status: 401 }, { status: 403 }, new Error('invalid token')])('does not classify invalid credentials as temporary', error => {
    expect(isTemporaryAuthError(error)).toBe(false)
  })
})
