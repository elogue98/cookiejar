import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lookup } from 'node:dns/promises'

import { safeFetchImage, safeFetchRedirect, safeFetchText, validateRemoteUrl } from './safeFetch'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))

describe('safe remote fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never)
  })

  it('rejects private, loopback, credentialed, and non-http URLs before fetch', async () => {
    await expect(validateRemoteUrl('http://127.0.0.1/image.jpg')).rejects.toThrow('Remote address is not allowed')
    await expect(validateRemoteUrl('http://[::1]/image.jpg')).rejects.toThrow('Remote address is not allowed')
    await expect(validateRemoteUrl('http://[2001:db8::1]/image.jpg')).rejects.toThrow('Remote address is not allowed')
    await expect(validateRemoteUrl('http://[fec0::1]/image.jpg')).rejects.toThrow('Remote address is not allowed')
    await expect(validateRemoteUrl('file:///etc/passwd')).rejects.toThrow('Only HTTP(S) URLs are allowed')
    await expect(validateRemoteUrl('gopher://example.com/image.jpg')).rejects.toThrow('Only HTTP(S) URLs are allowed')
    await expect(validateRemoteUrl('https://user:pass@example.com/image.jpg')).rejects.toThrow('URL credentials are not allowed')
    await expect(validateRemoteUrl(`https://example.com/${'a'.repeat(2_049)}`)).rejects.toThrow('Remote URL is too long')
  })

  it('rejects hostnames that resolve to private addresses', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '10.0.0.8', family: 4 }] as never)
    await expect(validateRemoteUrl('https://example.com/image.jpg')).rejects.toThrow('Remote address is not allowed')

    vi.mocked(lookup).mockResolvedValue([{ address: 'fd00::8', family: 6 }] as never)
    await expect(validateRemoteUrl('https://example.com/image.jpg')).rejects.toThrow('Remote address is not allowed')
  })

  it('revalidates redirects and permits at most three', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com/2' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com/3' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com/4' } }))
      .mockResolvedValueOnce(new Response('done', { headers: { 'content-type': 'text/html' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetchText('https://example.com/1')).resolves.toMatchObject({ text: 'done', url: 'https://example.com/4' })
    expect(fetchMock).toHaveBeenCalledTimes(4)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://example.com/2' } }),
    ))
    await expect(safeFetchText('https://example.com/1')).rejects.toThrow('Too many redirects')
  })

  it('uses the source-compatible user-agent for remote fetches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('done', { headers: { 'content-type': 'text/html' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetchText('https://example.com/recipe')).resolves.toMatchObject({ text: 'done' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/recipe',
      expect.objectContaining({
        headers: {
          'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
        },
      }),
    )
  })

  it('rejects wrong content types and bodies over the configured limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('not html', { headers: { 'content-type': 'application/json' } }),
    ))
    await expect(safeFetchText('https://example.com')).rejects.toThrow('Unexpected content type')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'text/html' } }),
    ))
    await expect(safeFetchText('https://example.com')).rejects.toThrow('Remote response is too large')
  })

  it('cancels oversized responses rejected by their declared content length', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(body, {
        headers: {
          'content-type': 'text/html',
          'content-length': String(2 * 1024 * 1024 + 1),
        },
      }),
    ))

    await expect(safeFetchText('https://example.com')).rejects.toThrow('Remote response is too large')
    expect(cancelled).toBe(true)
  })

  it('cancels redirect response bodies before following the next location', async () => {
    let cancelled = false
    const redirectBody = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true
      },
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(redirectBody, {
        status: 302,
        headers: { location: 'https://example.com/final' },
      }))
      .mockResolvedValueOnce(new Response('done', { headers: { 'content-type': 'text/html' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetchText('https://example.com/short')).resolves.toMatchObject({ text: 'done' })
    expect(cancelled).toBe(true)
  })

  it('cancels a response stream as soon as the body limit is crossed', async () => {
    let cancelled = false
    let chunkNumber = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(chunkNumber++ === 0 ? 2 * 1024 * 1024 : 1))
      },
      cancel() {
        cancelled = true
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/html' } }),
    ))

    await expect(safeFetchText('https://example.com')).rejects.toThrow('Remote response is too large')
    expect(cancelled).toBe(true)
  })

  it('accepts supported image content types and returns bytes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } }),
    ))

    await expect(safeFetchImage('https://example.com/image.jpg')).resolves.toMatchObject({
      contentType: 'image/jpeg',
      bytes: expect.any(Uint8Array),
    })
  })

  it('aborts a remote request after the ten-second timeout', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const pending = safeFetchText('https://example.com/slow')
      const timedOut = expect(pending).rejects.toThrow('Remote request timed out')
      await vi.advanceTimersByTimeAsync(10_000)

      await timedOut
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves short-link redirects without downloading the response body', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      },
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com/final' } }))
      .mockResolvedValueOnce(new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetchRedirect('https://example.com/short')).resolves.toEqual({
      url: 'https://example.com/final',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
