export type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
export const encodeChatEvent = (event: ChatEvent) => `data: ${JSON.stringify(event)}\n\n`

/** Hold only the unfinished final word; completion/stop always reveals all received text. */
export const readableStreamText = (text: string) => text.replace(/\S+$/u, '')

/** Consume our bounded SSE protocol, including events split across UTF-8 chunks. */
export async function consumeChatStream(
  response: Response,
  onText: (delta: string) => void,
  signal?: AbortSignal,
) {
  if (!response.body) throw new Error('The response was empty. Please retry.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false
  const abort = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    signal?.throwIfAborted()
    while (!completed) {
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let separator: RegExpExecArray | null
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, separator.index)
        if (block.length > 65_536) throw new Error('Invalid response. Please retry.')
        buffer = buffer.slice(separator.index + separator[0].length)
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (!data) continue
        let event: ChatEvent
        try {
          event = JSON.parse(data)
        } catch {
          throw new Error('Invalid response. Please retry.')
        }
        if (event?.type === 'delta' && typeof event.text === 'string') onText(event.text)
        else if (event?.type === 'done') {
          completed = true
          break
        } else if (event?.type === 'error' && typeof event.message === 'string')
          throw new Error(event.message)
        else throw new Error('Invalid response. Please retry.')
      }
      // Limit one unfinished event, rather than a coalesced batch of valid events.
      if (buffer.length > 65_536) throw new Error('Invalid response. Please retry.')
      if (done && !completed)
        throw new Error('The connection was interrupted. You can retry this answer.')
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

type ProviderEvent = { type: string; delta?: string }

/** Never mark an interrupted upstream response complete or expose provider errors. */
export function createChatResponse(
  events: AsyncIterable<ProviderEvent>,
  abort: AbortController,
  cleanup = () => {},
) {
  const encoder = new TextEncoder()
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        if (!cancelled) controller.enqueue(encoder.encode(encodeChatEvent(event)))
      }
      let completed = false
      let hasText = false
      try {
        for await (const event of events) {
          if (abort.signal.aborted) break
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            hasText ||= event.delta.length > 0
            send({ type: 'delta', text: event.delta })
          } else if (event.type === 'response.completed') {
            if (!hasText) throw new Error('Empty answer')
            send({ type: 'done' })
            completed = true
            break
          } else if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
            throw new Error('Incomplete answer')
          }
        }
        if (!completed && !cancelled) throw new Error('Interrupted answer')
      } catch {
        if (!cancelled)
          send({ type: 'error', message: 'This answer was interrupted. Please retry.' })
      } finally {
        cleanup()
        if (!cancelled) controller.close()
      }
    },
    cancel() {
      cancelled = true
      abort.abort()
      cleanup()
    },
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
