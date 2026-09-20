import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3
const MAX_REMOTE_URL_CHARS = 2_048
const MAX_HTML_BYTES = 2 * 1024 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const REMOTE_FETCH_USER_AGENT = 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'

const redirectStatuses = new Set([301, 302, 303, 307, 308])
const imageContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const htmlContentTypes = new Set(['text/html', 'application/xhtml+xml'])

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SafeFetchError'
  }
}

function ipv4ToNumber(address: string): number | null {
  const parts = address.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null
  const octets = parts.map(Number)
  if (octets.some((octet) => octet < 0 || octet > 255)) return null
  return ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]
}

function isForbiddenIpv4(address: string): boolean {
  const value = ipv4ToNumber(address)
  if (value === null) return true
  const ranges: Array<[string, string]> = [
    ['0.0.0.0', '0.255.255.255'],
    ['10.0.0.0', '10.255.255.255'],
    ['100.64.0.0', '100.127.255.255'],
    ['127.0.0.0', '127.255.255.255'],
    ['169.254.0.0', '169.254.255.255'],
    ['172.16.0.0', '172.31.255.255'],
    ['192.0.0.0', '192.0.0.255'],
    ['192.0.2.0', '192.0.2.255'],
    ['192.88.99.0', '192.88.99.255'],
    ['192.168.0.0', '192.168.255.255'],
    ['198.18.0.0', '198.19.255.255'],
    ['198.51.100.0', '198.51.100.255'],
    ['203.0.113.0', '203.0.113.255'],
    ['224.0.0.0', '255.255.255.255'],
  ]
  return ranges.some(([start, end]) => value >= ipv4ToNumber(start)! && value <= ipv4ToNumber(end)!)
}

function ipv6ToGroups(address: string): number[] | null {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':')
    const ipv4 = ipv4ToNumber(normalized.slice(lastColon + 1))
    if (ipv4 === null) return null
    const high = ((ipv4 >>> 16) & 0xffff).toString(16)
    const low = (ipv4 & 0xffff).toString(16)
    return ipv6ToGroups(`${normalized.slice(0, lastColon)}:${high}:${low}`)
  }

  const halves = normalized.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(':').filter(Boolean) : []
  const missing = 8 - left.length - right.length
  if (halves.length === 1 && missing !== 0) return null
  if (missing < 0) return null
  const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right]
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null
  return groups.map((group) => parseInt(group, 16))
}

function isForbiddenIpv6(address: string): boolean {
  const groups = ipv6ToGroups(address)
  if (groups === null) return true
  const ipv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff
  if (ipv4Mapped) {
    const ipv4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.')
    return isForbiddenIpv4(ipv4)
  }
  const allZero = groups.every((group) => group === 0)
  const isLoopback = groups[7] === 1 && groups.slice(0, 7).every((group) => group === 0)
  const startsWith = (prefix: string, bits: number): boolean => {
    const prefixGroups = ipv6ToGroups(prefix)
    if (!prefixGroups) return true
    const fullGroups = Math.floor(bits / 16)
    for (let index = 0; index < fullGroups; index += 1) {
      if (groups[index] !== prefixGroups[index]) return false
    }
    const remainingBits = bits % 16
    if (remainingBits === 0) return true
    const mask = 0xffff ^ ((1 << (16 - remainingBits)) - 1)
    return (groups[fullGroups] & mask) === (prefixGroups[fullGroups] & mask)
  }

  return allZero || isLoopback || [
    ['100::', 64], // discard-only
    ['2001::', 32], // protocol-assigned special-use range
    ['2001:1::', 48],
    ['2001:2::', 48],
    ['2001:3::', 48],
    ['2001:10::', 28], // ORCHID
    ['2001:db8::', 32], // documentation
    ['3fff::', 20], // documentation
    ['fc00::', 7], // unique local
    ['fe80::', 10], // link local
    ['fec0::', 10], // deprecated site local
    ['ff00::', 8], // multicast
  ].some(([prefix, bits]) => startsWith(prefix as string, bits as number))
}

function isForbiddenAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isForbiddenIpv4(address)
  if (family === 6) return isForbiddenIpv6(address)
  return true
}

export async function validateRemoteUrl(rawUrl: string): Promise<URL> {
  if (rawUrl.length > MAX_REMOTE_URL_CHARS) throw new SafeFetchError('Remote URL is too long')

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SafeFetchError('Invalid remote URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('Only HTTP(S) URLs are allowed')
  }
  if (url.username || url.password) throw new SafeFetchError('URL credentials are not allowed')
  if (url.href.length > MAX_REMOTE_URL_CHARS) throw new SafeFetchError('Remote URL is too long')

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new SafeFetchError('Remote address is not allowed')
  }

  let addresses: Array<{ address: string }>
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new SafeFetchError('Remote address is not available')
  }
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address))) {
    throw new SafeFetchError('Remote address is not allowed')
  }

  return url
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelResponseBody(response)
    throw new SafeFetchError('Remote response is too large')
  }
  if (!response.body) return new Uint8Array()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = new Uint8Array(value)
      total += chunk.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new SafeFetchError('Remote response is too large')
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // The original response error is the useful failure to surface.
  }
}

async function fetchSafeBytes(
  rawUrl: string,
  allowedTypes: Set<string>,
  maxBytes: number,
): Promise<{ url: string; contentType: string; bytes: Uint8Array }> {
  let currentUrl = (await validateRemoteUrl(rawUrl)).href

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': REMOTE_FETCH_USER_AGENT },
      })
      if (redirectStatuses.has(response.status)) {
        const location = response.headers.get('location')
        await cancelResponseBody(response)
        if (redirectCount === MAX_REDIRECTS) throw new SafeFetchError('Too many redirects')
        if (!location) throw new SafeFetchError('Invalid redirect')
        currentUrl = (await validateRemoteUrl(new URL(location, currentUrl).href)).href
        continue
      }

      if (!response.ok) {
        await cancelResponseBody(response)
        throw new SafeFetchError('Remote response unavailable')
      }
      const contentType = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
      if (!allowedTypes.has(contentType)) {
        await cancelResponseBody(response)
        throw new SafeFetchError('Unexpected content type')
      }
      const bytes = await readLimitedBody(response, maxBytes)
      return { url: currentUrl, contentType, bytes }
    } catch (error) {
      if (error instanceof SafeFetchError) throw error
      if (controller.signal.aborted) throw new SafeFetchError('Remote request timed out')
      throw new SafeFetchError('Remote request failed')
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new SafeFetchError('Too many redirects')
}

/** Resolve a user-supplied redirect URL without downloading an unbounded body. */
export async function safeFetchRedirect(rawUrl: string): Promise<{ url: string }> {
  let currentUrl = (await validateRemoteUrl(rawUrl)).href

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': REMOTE_FETCH_USER_AGENT },
      })
    } catch {
      if (controller.signal.aborted) throw new SafeFetchError('Remote request timed out')
      throw new SafeFetchError('Remote request failed')
    } finally {
      clearTimeout(timeout)
    }

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get('location')
      await cancelResponseBody(response)
      if (redirectCount === MAX_REDIRECTS) throw new SafeFetchError('Too many redirects')
      if (!location) throw new SafeFetchError('Invalid redirect')
      currentUrl = (await validateRemoteUrl(new URL(location, currentUrl).href)).href
      continue
    }

    await cancelResponseBody(response)
    if (!response.ok) throw new SafeFetchError('Remote response unavailable')
    if (response.url && response.url !== currentUrl) {
      currentUrl = (await validateRemoteUrl(response.url)).href
    }
    return { url: currentUrl }
  }

  throw new SafeFetchError('Too many redirects')
}

export async function safeFetchText(rawUrl: string) {
  const result = await fetchSafeBytes(rawUrl, htmlContentTypes, MAX_HTML_BYTES)
  return { ...result, text: new TextDecoder().decode(result.bytes) }
}

export async function safeFetchImage(rawUrl: string) {
  return fetchSafeBytes(rawUrl, imageContentTypes, MAX_IMAGE_BYTES)
}
