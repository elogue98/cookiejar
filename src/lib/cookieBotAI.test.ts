import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeCookieBot, streamCookieBot } from './cookieBotAI'
const mocks = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('openai', () => ({
  default: class {
    responses = { create: mocks.create }
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_MODEL', 'unrelated-import-model')
  vi.stubEnv('COOKIEBOT_MODEL', '')
})
afterEach(() => vi.unstubAllEnvs())
const messages = [{ role: 'user' as const, content: 'Can I use yogurt?' }]
describe('dedicated CookieBot model', () => {
  it('streams Luna without inheriting the import model or deprecated parameters', async () => {
    async function* events() {
      yield { type: 'response.output_text.delta', delta: 'Yes' }
      yield { type: 'response.completed' }
    }
    mocks.create.mockResolvedValue(events())
    const response = await streamCookieBot(messages, new AbortController().signal)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-6-luna',
        stream: true,
        store: false,
        reasoning: { effort: 'none' },
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('max_tokens')
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('temperature')
    expect(await response.text()).toContain('Yes')
  })
  it('uses Luna structured output for proposals without affecting the shared helper', async () => {
    mocks.create.mockResolvedValue({ status: 'completed', output_text: '{"title":"Soup"}' })
    expect(
      await completeCookieBot(messages, { type: 'object' }, new AbortController().signal),
    ).toBe('{"title":"Soup"}')
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      model: 'gpt-6-luna',
      text: { format: { type: 'json_schema', strict: true, name: 'recipe_mutation' } },
    })
  })
  it('does not retry a partial answer with another model', async () => {
    async function* events() {
      yield { type: 'response.output_text.delta', delta: 'Partial' }
      throw new Error('private')
    }
    mocks.create.mockResolvedValue(events())
    expect(
      await (await streamCookieBot(messages, new AbortController().signal)).text(),
    ).not.toContain('private')
    expect(mocks.create).toHaveBeenCalledOnce()
  })
  it('rejects incomplete proposal output', async () => {
    mocks.create.mockResolvedValue({ status: 'incomplete', output_text: '{"title":' })
    await expect(
      completeCookieBot(messages, { type: 'object' }, new AbortController().signal),
    ).rejects.toThrow('complete')
  })
})
