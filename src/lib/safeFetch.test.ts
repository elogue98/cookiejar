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

  it('fetches Waitrose recipe pages with a browser user-agent', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      if (headers['User-Agent'] !== 'Mozilla/5.0') {
        throw new Error('Waitrose does not respond to the link-expanding bot')
      }
      return Promise.resolve(new Response('<html>Recipe</html>', {
        headers: { 'content-type': 'text/html' },
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetchText('https://www.waitrose.com/ecom/recipe/marthas-smarties-cookies'))
      .resolves.toMatchObject({ text: '<html>Recipe</html>' })
  })

  it('selects headers for the redirect destination without matching lookalike hosts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: 'https://www.waitrose.com/ecom/recipe/marthas-smarties-cookies' },
      }))
      .mockResolvedValueOnce(new Response('Recipe', { headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(new Response('Other site', { headers: { 'content-type': 'text/html' } }))
    vi.stubGlobal('fetch', fetchMock)

    await safeFetchText('https://example.com/recipe')
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      'https://www.waitrose.com/ecom/recipe/marthas-smarties-cookies',
      expect.objectContaining({ headers: { 'User-Agent': 'Mozilla/5.0' } }),
    )
    await safeFetchText('https://www.waitrose.com.example.com/ecom/recipe/cookies')
    expect(fetchMock).toHaveBeenNthCalledWith(3,
      'https://www.waitrose.com.example.com/ecom/recipe/cookies',
      expect.objectContaining({ headers: {
        'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      } }),
    )
  })

  it('falls back to Reader HTML when a public Waitrose recipe request times out', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce(new Response('<html>Recipe</html>', {
        headers: { 'content-type': 'text/plain' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const source = 'https://www.waitrose.com/ecom/recipe/marthas-smarties-cookies?tracking=value#method'
    await expect(safeFetchText(source)).resolves.toMatchObject({
      url: source,
      text: '<html>Recipe</html>',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      'https://r.jina.ai/https://www.waitrose.com/ecom/recipe/marthas-smarties-cookies',
      expect.objectContaining({
        redirect: 'manual',
        headers: expect.objectContaining({ 'X-Return-Format': 'html' }),
      }),
    )
  })

  it('does not proxy other sites or invalid Waitrose URLs', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection failed'))
    vi.stubGlobal('fetch', fetchMock)
    for (const url of [
      'https://example.com/recipe',
      'https://www.waitrose.com.example.com/ecom/recipe/cookies',
      'https://www.waitrose.com/account',
      'https://www.waitrose.com:8080/ecom/recipe/cookies',
      'https://www.waitrose.com/ecom/recipe/cookies/other',
    ]) {
      await expect(safeFetchText(url)).rejects.toThrow('Remote request failed')
    }
    expect(fetchMock).toHaveBeenCalledTimes(5)
    await expect(safeFetchText('https://user:secret@www.waitrose.com/ecom/recipe/cookies'))
      .rejects.toThrow('URL credentials are not allowed')
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('keeps the HTML size limit on Reader fallback responses', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce(new Response('x'.repeat(2 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'text/plain' },
      })))
    await expect(safeFetchText('https://www.waitrose.com/ecom/recipe/cookies'))
      .rejects.toThrow('Remote response is too large')
  })

  it('rejects non-HTML Reader responses and private redirects', async () => {
    const source = 'https://www.waitrose.com/ecom/recipe/cookies'
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce(new Response('Access denied', {
        headers: { 'content-type': 'text/plain' },
      })))
    await expect(safeFetchText(source)).rejects.toThrow('Reader did not return HTML')

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce(new Response(null, {
        status: 302, headers: { location: 'http://127.0.0.1/private' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(safeFetchText(source)).rejects.toThrow('Remote address is not allowed')
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
