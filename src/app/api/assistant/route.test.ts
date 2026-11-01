import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), stream: vi.fn() }))
vi.mock('@/lib/apiSecurity', () => ({
  authenticateApiRequest: mocks.auth,
  checkApiRateLimit: mocks.limit,
}))
vi.mock('@/lib/cookieBotAI', () => ({ streamCookieBot: mocks.stream }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ profile: { profileId: 'owner' }, error: null })
  mocks.limit.mockResolvedValue(null)
  mocks.stream.mockResolvedValue(
    new Response('stream', { headers: { 'Content-Type': 'text/event-stream' } }),
  )
})
function request(
  body: unknown = {
    recipeTitle: 'Bread',
    ingredients: [],
    instructions: [],
    tags: [],
    servings: 12,
    userMessage: 'Can I use yogurt?',
    messageHistory: [],
  },
) {
  return new NextRequest('https://app.example/api/assistant', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
describe('streaming assistant route', () => {
  it('streams after authorization and passes recipe serving context and abort signal', async () => {
    const response = await POST(request())
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system', content: expect.stringContaining('12') }),
      ]),
      expect.any(AbortSignal),
    )
  })
  it('does not contact the model for anonymous or invalid requests', async () => {
    mocks.auth.mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Denied' }, { status: 401 }),
    })
    expect((await POST(request())).status).toBe(401)
    expect((await POST(request({ userMessage: 'hello' }))).status).toBe(400)
    expect(mocks.stream).not.toHaveBeenCalled()
  })
  it('returns safe provider errors before streaming starts', async () => {
    mocks.stream.mockRejectedValue(new Error('private API details'))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('private')
  })
})
