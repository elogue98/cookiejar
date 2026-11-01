import { describe, expect, it, vi } from 'vitest'
import { consumeChatStream, encodeChatEvent, createChatResponse, readableStreamText } from './chatStream'

function response(text: string, fragment = 1) {
  const bytes = new TextEncoder().encode(text)
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += fragment)
          controller.enqueue(bytes.slice(i, i + fragment))
        controller.close()
      },
    }),
  )
}

describe('chat stream transport', () => {
  it('reveals complete word groups without discarding received text', () => {
    expect(readableStreamText('Use **275ml** yog')).toBe('Use **275ml** ')
    expect(readableStreamText('Crème fraîche ')).toBe('Crème fraîche ')
    expect(readableStreamText('Hello')).toBe('')
  })
  it('accepts many small events coalesced into one large network chunk', async () => {
    const text =
      encodeChatEvent({ type: 'delta', text: 'word ' }).repeat(2000) +
      encodeChatEvent({ type: 'done' })
    let received = ''
    await consumeChatStream(response(text, text.length), (delta) => {
      received += delta
    })
    expect(received).toBe('word '.repeat(2000))
  })
  it('decodes fragmented UTF-8 and SSE events without losing text', async () => {
    const updates: string[] = []
    await consumeChatStream(
      response(
        'data: {"type":"delta","text":"Crème 🍪"}\r\n\r\ndata: {"type":"delta","text":" fraîche"}\n\ndata: {"type":"done"}\n\n',
      ),
      (text) => updates.push(text),
    )
    expect(updates.join('')).toBe('Crème 🍪 fraîche')
  })
  it('keeps received text when a connection ends without completion', async () => {
    const updates: string[] = []
    await expect(
      consumeChatStream(response(encodeChatEvent({ type: 'delta', text: 'Use yogurt' })), (text) =>
        updates.push(text),
      ),
    ).rejects.toThrow('interrupted')
    expect(updates).toEqual(['Use yogurt'])
  })
  it('reports safe server errors and rejects malformed events', async () => {
    await expect(
      consumeChatStream(
        response(encodeChatEvent({ type: 'error', message: 'Please retry.' })),
        () => {},
      ),
    ).rejects.toThrow('Please retry.')
    await expect(
      consumeChatStream(response('data: {"type":"delta","text":null}\n\n'), () => {}),
    ).rejects.toThrow('Invalid')
  })
  it('cancels a pending reader when stopped', async () => {
    const cancel = vi.fn()
    const controller = new AbortController()
    const result = consumeChatStream(
      new Response(new ReadableStream({ cancel })),
      () => {},
      controller.signal,
    )
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('forwards real deltas and explicitly completes the stream', async () => {
    const abort = new AbortController()
    async function* events() {
      yield { type: 'response.output_text.delta', delta: 'Hello' }
      yield { type: 'response.completed' }
    }
    const result = createChatResponse(events(), abort)
    expect(result.headers.get('content-type')).toContain('text/event-stream')
    expect(result.headers.get('cache-control')).toContain('no-store')
    const text: string[] = []
    await consumeChatStream(result, (delta) => text.push(delta))
    expect(text).toEqual(['Hello'])
  })
  it('does not expose provider errors or treat a truncated provider stream as complete', async () => {
    async function* events() {
      yield { type: 'response.output_text.delta', delta: 'Partial' }
      throw new Error('private provider error')
    }
    const text = await createChatResponse(events(), new AbortController()).text()
    expect(text).toContain('Partial')
    expect(text).toContain('"type":"error"')
    expect(text).not.toContain('private provider error')
    async function* truncated() {
      yield { type: 'response.output_text.delta', delta: 'Partial' }
    }
    expect(await createChatResponse(truncated(), new AbortController()).text()).toContain(
      '"type":"error"',
    )
  })
  it('aborts upstream when the browser cancels its response', async () => {
    const abort = new AbortController()
    async function* events() {
      yield { type: 'response.output_text.delta', delta: 'First' }
      await new Promise<void>((resolve) =>
        abort.signal.addEventListener('abort', () => resolve(), { once: true }),
      )
    }
    const reader = createChatResponse(events(), abort).body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(abort.signal.aborted).toBe(true)
  })
})
