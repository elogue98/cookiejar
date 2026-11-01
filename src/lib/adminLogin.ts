import { z } from 'zod'
import { ApiError } from './apiErrors'

export function getAdminLoginConfig() {
  // Existing family profiles include UUIDs without RFC version/variant bits.
  // Match PostgreSQL's canonical UUID shape, as the account-linking tool does.
  const result = z.object({ email: z.email(), profileId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) }).safeParse({
    email: process.env.ADMIN_LOGIN_EMAIL?.trim(),
    profileId: process.env.ADMIN_LOGIN_PROFILE_ID?.trim(),
  })
  if (!result.success) {
    throw new ApiError(500, 'ADMIN_LOGIN_UNAVAILABLE', 'Password sign-in has not been configured yet.')
  }
  return result.data
}

export async function readAdminPassword(request: Request, minimumLength = 1): Promise<string> {
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError(400, 'INVALID_REQUEST', 'Enter a password.')
  const decoder = new TextDecoder()
  let body = ''
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) {
        await reader.cancel()
        throw new ApiError(413, 'INVALID_REQUEST', 'Request is too large.')
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    const parsed = z.object({ password: z.string().min(minimumLength).max(1024) }).safeParse(JSON.parse(body))
    if (!parsed.success) throw new Error('Invalid password')
    return parsed.data.password
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(400, 'INVALID_REQUEST', minimumLength > 1 ? `Use a password of ${minimumLength}–1024 characters.` : 'Enter a valid password.')
  } finally {
    reader.releaseLock()
  }
}
