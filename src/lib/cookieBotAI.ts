import OpenAI from 'openai'
import { createChatResponse } from './chatStream'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }
let client: OpenAI | undefined
const getClient = () =>
  (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60_000 }))
const model = () => process.env.COOKIEBOT_MODEL?.trim() || 'gpt-6-luna'

/** Dedicated to CookieBot: shared import/tagging defaults are intentionally independent. */
export async function streamCookieBot(messages: Message[], signal: AbortSignal): Promise<Response> {
  const abort = new AbortController()
  const onAbort = () => abort.abort()
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) abort.abort()
  const cleanup = () => signal.removeEventListener('abort', onAbort)
  try {
    const events = await getClient().responses.create(
      {
        model: model(),
        input: messages,
        reasoning: { effort: 'none' },
        max_output_tokens: 1600,
        stream: true,
        store: false,
      },
      { signal: abort.signal },
    )
    return createChatResponse(events, abort, cleanup)
  } catch (error) {
    cleanup()
    throw error
  }
}

export async function completeCookieBot(
  messages: Message[],
  schema: Record<string, unknown>,
  signal: AbortSignal,
): Promise<string> {
  const response = await getClient().responses.create(
    {
      model: model(),
      input: messages,
      reasoning: { effort: 'none' },
      max_output_tokens: 6000,
      store: false,
      text: { format: { type: 'json_schema', name: 'recipe_mutation', strict: true, schema } },
    },
    { signal },
  )
  if (response.status !== 'completed' || !response.output_text)
    throw new Error('Could not complete the recipe proposal.')
  return response.output_text
}
