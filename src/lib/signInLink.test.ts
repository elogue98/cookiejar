import { describe, expect, it, vi } from 'vitest'
import { sendSignInLink } from './signInLink'

describe('sending a sign-in link', () => {
  it('uses the existing invited account with a trimmed address', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null })
    expect(await sendSignInLink({ signInWithOtp }, ' test@example.com ', 'https://app.example/auth/callback')).toBeNull()
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'test@example.com', options: { shouldCreateUser: false, emailRedirectTo: 'https://app.example/auth/callback' } })
  })
  it('explains network failures without blaming the email address', async () => {
    const signInWithOtp = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    expect(await sendSignInLink({ signInWithOtp }, 'test@example.com', 'https://app.example/auth/callback')).toMatch(/connect.*sign-in service/i)
  })
  it('explains email rate limits', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit' } })
    expect(await sendSignInLink({ signInWithOtp }, 'test@example.com', 'https://app.example/auth/callback')).toMatch(/too many.*wait/i)
  })
})
