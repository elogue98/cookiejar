/**
 * Helpers for working with Google Maps / Places URLs.
 */

/**
 * Attempts to extract a Google `place_id` from a Maps URL.
 */
export function extractPlaceIdFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)

    const q = url.searchParams.get('q')
    if (q && q.startsWith('place_id:')) {
      return q.replace('place_id:', '')
    }

    const queryPlaceId = url.searchParams.get('query_place_id')
    if (queryPlaceId) return queryPlaceId

    const placeIdParam = url.searchParams.get('place_id')
    if (placeIdParam) return placeIdParam

    const dataPatterns = [
      /!1s([^!]+)!/, // common place id slot
      /!3m5!1s([^!]+)!/, // place blob pattern
      /!4m5!3m4!1s([^!]+)!/, // directions-style links
    ]
    for (const pattern of dataPatterns) {
      const m = rawUrl.match(pattern)
      if (m?.[1]) return m[1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Derives a sensible text query from a Maps URL to use with Places Text Search.
 */
export function deriveTextSearchQuery(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)

    const q = url.searchParams.get('q')
    if (q && !q.startsWith('place_id:')) {
      return decodeURIComponentSafe(q)
    }

    const query = url.searchParams.get('query')
    if (query) {
      return decodeURIComponentSafe(query)
    }

    const pathSegments = url.pathname.split('/').filter(Boolean)
    const placeIndex = pathSegments.findIndex((segment) => segment === 'place')

    if (placeIndex !== -1 && pathSegments[placeIndex + 1]) {
      const segment = cleanSegment(pathSegments[placeIndex + 1])
      if (segment) return segment
    }

    const tailSegment = pathSegments[pathSegments.length - 1]
    if (tailSegment) {
      const segment = cleanSegment(tailSegment)
      if (segment) return segment
    }

    return null
  } catch {
    return null
  }
}

/**
 * Normalizes Google place `types` into human-readable tags.
 */
export function mapPlaceTypesToTags(types?: string[] | null): string[] {
  if (!types?.length) return []

  const normalized = types
    .map((type) => type.replace(/_/g, ' '))
    .map((type) => type.trim())
    .filter(Boolean)

  return Array.from(new Set(normalized))
}

/**
 * Attempts to extract latitude/longitude from a Google Maps URL.
 * Prefers the explicit `!3d<lat>!4d<lng>` coordinates (actual pin),
 * falling back to the map viewport `@lat,lng` when needed.
 */
export function parseLatLngFromUrl(rawUrl: string): { lat: number; lng: number } | null {
  try {
    const pinnedCoords = rawUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
    if (pinnedCoords) {
      const lat = Number(pinnedCoords[1])
      const lng = Number(pinnedCoords[2])
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng }
      }
    }

    const viewportCoords = rawUrl.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    if (viewportCoords) {
      const lat = Number(viewportCoords[1])
      const lng = Number(viewportCoords[2])
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng }
      }
    }

    return null
  } catch {
    return null
  }
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value).replace(/\+/g, ' ').trim()
  } catch {
    return value.replace(/\+/g, ' ').trim()
  }
}

function cleanSegment(segment: string): string {
  const withoutCoords = segment.split('@')[0]
  const decoded = decodeURIComponentSafe(withoutCoords)
  return decoded.replace(/-/g, ' ').trim()
}


