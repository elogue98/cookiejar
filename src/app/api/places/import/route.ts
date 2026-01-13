async function resolvePlaceIdByNearby(
  keyword: string,
  apiKey: string,
  coords?: { lat: number; lng: number } | null
): Promise<string | null> {
  if (!coords) return null
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
  url.searchParams.set('location', `${coords.lat},${coords.lng}`)
  url.searchParams.set('rankby', 'distance')
  url.searchParams.set('keyword', keyword)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('region', 'gb')
  url.searchParams.set('language', 'en')

  const response = await fetch(url.toString())
  if (!response.ok) {
    console.error('Nearby search HTTP error', response.status, response.statusText)
    return null
  }
  const payload = (await response.json()) as GoogleTextSearchResponse
  if (payload.status !== 'OK' || !payload.results?.length) {
    console.error('Nearby search failed', payload.status, payload.error_message)
    return null
  }

  // Pick the closest within 5km to avoid cross-city mismatches.
  const withDistance = payload.results
    .map((r) => {
      const lat = (r as any).geometry?.location?.lat
      const lng = (r as any).geometry?.location?.lng
      if (typeof lat !== 'number' || typeof lng !== 'number') return null
      const d = haversineDistance(coords.lat, coords.lng, lat, lng)
      return { place_id: r.place_id, distanceKm: d }
    })
    .filter(
      (v): v is { place_id: string; distanceKm: number } =>
        v !== null && typeof v.place_id === 'string'
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)

  const candidate = withDistance.find((c) => c.distanceKm <= 5) ?? withDistance[0]
  if (!candidate) {
    console.error('Nearby search had results but none with coords/place_id')
    return null
  }
  return candidate.place_id
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabaseClient'
import {
  deriveTextSearchQuery,
  extractPlaceIdFromUrl,
  mapPlaceTypesToTags,
  parseLatLngFromUrl,
} from '@/lib/googlePlaces'
import { generateTagsForPlace } from '@/lib/placeTagging'

const requestSchema = z.object({
  url: z.string().url(),
})

type GoogleTextSearchResult = { place_id: string }
type GoogleTextSearchResponse = {
  status: string
  results?: GoogleTextSearchResult[]
  error_message?: string
}

type GooglePlaceDetails = {
  place_id: string
  name?: string
  formatted_address?: string
  url?: string
  website?: string
  types?: string[]
  geometry?: { location?: { lat?: number; lng?: number } }
}

type GooglePlaceDetailsResponse = {
  status: string
  result?: GooglePlaceDetails
  error_message?: string
}

type PlaceDetailsResult = {
  place: GooglePlaceDetails | null
  status: string
  errorMessage?: string
}

function isLikelyPlaceId(value: string | null | undefined): value is string {
  if (!value) return false
  // Prefer canonical IDs starting with Ch
  if (/^Ch[Ii]/.test(value)) return true
  // Reject obvious garbage
  if (/[%\s/]/.test(value)) return false
  return value.length >= 10
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', debug: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let { url } = parsed.data
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!googleApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing GOOGLE_MAPS_API_KEY environment variable',
          debug: 'Set GOOGLE_MAPS_API_KEY in env (server key with Places enabled)',
        },
        { status: 500 }
      )
    }

    if (isShortMapsUrl(url)) {
      const expanded = await expandMapsShortLink(url)
      if (expanded) {
        url = expanded
      }
    }

    const coords = parseLatLngFromUrl(url)
    let placeIdFromUrl = extractPlaceIdFromUrl(url)
    // Ignore opaque 0x... blobs – they are map entity ids, not stable place_ids.
    if (placeIdFromUrl?.startsWith('0x')) {
      placeIdFromUrl = null
    }
    const textQuery = deriveTextSearchQuery(url)
    let resolvedPlaceId =
      placeIdFromUrl ??
      (coords && textQuery ? await resolvePlaceIdByNearby(textQuery, googleApiKey, coords) : null) ??
      (textQuery ? await resolvePlaceIdByText(textQuery, googleApiKey, coords) : null) ??
      (await resolvePlaceIdByFindPlace(textQuery ?? url, googleApiKey, coords))

    // If the resolved place_id looks invalid (e.g., 0x... blob), retry with text/find using bias.
    if (resolvedPlaceId && resolvedPlaceId.startsWith('0x')) {
      const retry =
        (textQuery ? await resolvePlaceIdByFindPlace(textQuery, googleApiKey, coords) : null) ??
        (textQuery ? await resolvePlaceIdByText(textQuery, googleApiKey, coords) : null) ??
        resolvedPlaceId
      resolvedPlaceId = retry
    }

    if (!isLikelyPlaceId(resolvedPlaceId)) {
      // Retry with a broader find-place if the extracted id looks malformed
      resolvedPlaceId =
        (coords && textQuery ? await resolvePlaceIdByNearby(textQuery, googleApiKey, coords) : null) ??
        (textQuery ? await resolvePlaceIdByFindPlace(textQuery, googleApiKey, coords) : null) ??
        (await resolvePlaceIdByText(url, googleApiKey, coords)) ??
        (await resolvePlaceIdByFindPlace(url, googleApiKey, coords))
    }

    if (!isLikelyPlaceId(resolvedPlaceId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Unable to resolve a Google place_id from that URL. Try sharing the full Google Maps place link (not a short maps.app.goo.gl redirect).',
          google_status: 'NO_PLACE_ID',
          google_error: null,
          debug: {
            url,
            textQuery,
            placeIdFromUrl,
          },
        },
        { status: 400 }
      )
    }

    let placeDetails = await fetchPlaceDetails(resolvedPlaceId, googleApiKey)

    // If we have user-provided coordinates, prefer the closest match to those coords.
    if (coords) {
      const currentLocation = placeDetails.place?.geometry?.location
      const currentDist = currentLocation
        ? haversineDistance(
            coords.lat,
            coords.lng,
            currentLocation.lat ?? coords.lat,
            currentLocation.lng ?? coords.lng
          )
        : Number.POSITIVE_INFINITY

      // Always run a nearby search with location bias and pick the closer of the two.
      const nearbyId = textQuery && (await resolvePlaceIdByNearby(textQuery, googleApiKey, coords))
      if (nearbyId && nearbyId !== resolvedPlaceId) {
        const nearbyDetails = await fetchPlaceDetails(nearbyId, googleApiKey)
        const nearLoc = nearbyDetails.place?.geometry?.location
        if (nearLoc) {
          const nearDist = haversineDistance(
            coords.lat,
            coords.lng,
            nearLoc.lat ?? coords.lat,
            nearLoc.lng ?? coords.lng
          )
          // Prefer the nearer candidate; allow a small tie buffer of 50m.
          if (nearDist + 0.05 < currentDist) {
            resolvedPlaceId = nearbyId
            placeDetails = nearbyDetails
          }
        }
      }
    }

    if (!placeDetails.place && placeDetails.status === 'INVALID_REQUEST') {
      const fallbackId =
        (textQuery ? await resolvePlaceIdByFindPlace(textQuery, googleApiKey) : null) ??
        (await resolvePlaceIdByText(url, googleApiKey))

      if (isLikelyPlaceId(fallbackId) && fallbackId !== resolvedPlaceId) {
        placeDetails = await fetchPlaceDetails(fallbackId!, googleApiKey)
        resolvedPlaceId = fallbackId!
      }
    }

    if (!placeDetails.place) {
      const detail =
        placeDetails.status === 'REQUEST_DENIED'
          ? 'Google API key rejected the request (check key type, restrictions, billing, and Places API enablement).'
          : placeDetails.errorMessage || 'Failed to fetch place details from Google Maps'

      return NextResponse.json(
        {
          success: false,
          error: detail,
          google_status: placeDetails.status,
          google_error: placeDetails.errorMessage ?? null,
          debug: { place_id: resolvedPlaceId, textQuery },
        },
        { status: 502 }
      )
    }

    const supabase = createServerClient()

    const aiTags = await generateTagsForPlace({
      name: placeDetails.place.name ?? '',
      address: placeDetails.place.formatted_address ?? '',
      types: placeDetails.place.types ?? [],
    })
    const typeTags = mapPlaceTypesToTags(placeDetails.place.types)
    const cuisineTags = Array.from(new Set([...typeTags, ...aiTags])).slice(0, 10)

    const normalizedPlace = normalizePlaceDetails(placeDetails.place, url, 'unrated', cuisineTags)

    const {
      data: existingPlace,
      error: existingPlaceError,
    } = await supabase
      .from('places')
      .select('*')
      .eq('google_place_id', resolvedPlaceId)
      .maybeSingle()

    if (existingPlaceError) {
      console.error('Failed to look up existing place', existingPlaceError)
      return NextResponse.json(
        { success: false, error: 'Could not check for existing place' },
        { status: 500 }
      )
    }

    const {
      data: upsertedPlace,
      error: upsertError,
    } = await supabase
      .from('places')
      .upsert([normalizedPlace], { onConflict: 'google_place_id' })
      .select()
      .single()

    if (upsertError) {
      console.error('Failed to save place', upsertError)
      return NextResponse.json(
        {
          success: false,
          error: 'Could not save place',
          debug: upsertError.message ?? 'Supabase upsert failed',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { place: upsertedPlace },
    })
  } catch (error) {
    console.error('Unexpected error importing place', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected server error while importing place',
        debug: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

async function resolvePlaceIdByText(
  query: string,
  apiKey: string,
  coords?: { lat: number; lng: number } | null
): Promise<string | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  url.searchParams.set('query', query)
  url.searchParams.set('key', apiKey)
  if (coords) {
    url.searchParams.set('location', `${coords.lat},${coords.lng}`)
    url.searchParams.set('radius', '1500') // bias to ~1.5km around map pin
    url.searchParams.set('region', 'gb')
    url.searchParams.set('language', 'en')
  }

  const response = await fetch(url.toString())

  if (!response.ok) {
    console.error('Text search HTTP error', response.status, response.statusText)
    return null
  }

  const payload = (await response.json()) as GoogleTextSearchResponse

  if (payload.status !== 'OK' || !payload.results?.length) {
    console.error('Text search failed', payload.status, payload.error_message)
    return null
  }

  return payload.results[0].place_id
}

async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetailsResult> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set(
    'fields',
    ['place_id', 'name', 'formatted_address', 'geometry/location', 'url', 'website', 'types'].join(
      ','
    )
  )
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())

  if (!response.ok) {
    console.error('Place details HTTP error', response.status, response.statusText)
    return { place: null, status: 'HTTP_ERROR', errorMessage: `${response.status} ${response.statusText}` }
  }

  const payload = (await response.json()) as GooglePlaceDetailsResponse

  if (payload.status !== 'OK' || !payload.result) {
    console.error('Place details failed', payload.status, payload.error_message)
    return { place: null, status: payload.status, errorMessage: payload.error_message }
  }

  return { place: payload.result, status: payload.status }
}

function normalizePlaceDetails(
  place: GooglePlaceDetails,
  fallbackUrl: string,
  status: string,
  cuisineTags?: string[]
) {
  return {
    google_place_id: place.place_id,
    name: place.name ?? 'Unknown place',
    address: place.formatted_address ?? '',
    latitude: place.geometry?.location?.lat ?? null,
    longitude: place.geometry?.location?.lng ?? null,
    url: place.url ?? fallbackUrl,
    website: place.website ?? null,
    status,
    cuisine_tags: cuisineTags ?? mapPlaceTypesToTags(place.types),
  }
}

async function resolvePlaceIdByFindPlace(
  input: string,
  apiKey: string,
  coords?: { lat: number; lng: number } | null
): Promise<string | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json')
  url.searchParams.set('input', input)
  url.searchParams.set('inputtype', 'textquery')
  url.searchParams.set('fields', 'place_id')
  url.searchParams.set('key', apiKey)
  if (coords) {
    url.searchParams.set('locationbias', `point:${coords.lat},${coords.lng}`)
    url.searchParams.set('region', 'gb')
    url.searchParams.set('language', 'en')
  }

  const response = await fetch(url.toString())

  if (!response.ok) {
    console.error('FindPlace HTTP error', response.status, response.statusText)
    return null
  }

  const payload = (await response.json()) as GoogleTextSearchResponse

  if (payload.status !== 'OK' || !payload.results?.length) {
    console.error('FindPlace failed', payload.status, payload.error_message)
    return null
  }

  return payload.results[0].place_id
}

async function expandMapsShortLink(url: string): Promise<string | null> {
  try {
    // Try a HEAD first (lighter), then fall back to GET.
    const headRes = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (headRes.url && headRes.url !== url) return headRes.url

    const getRes = await fetch(url, { method: 'GET', redirect: 'follow' })
    if (getRes.ok && getRes.url && getRes.url !== url) return getRes.url
  } catch (err) {
    console.error('Failed to expand maps short link', err)
  }
  return null
}

function isShortMapsUrl(url: string) {
  try {
    const u = new URL(url)
    return u.hostname.includes('maps.app.goo.gl')
  } catch {
    return false
  }
}


