import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

type PlaceInsert = {
  google_place_id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  url: string | null
  website: string | null
  status: string
  cuisine_tags: string[]
}

type SavedPlace = PlaceInsert & { id: string }

const fetchMock = vi.fn<typeof fetch>()
const supabaseMock = createSupabaseDouble()

vi.stubGlobal('fetch', fetchMock)
vi.mock('@/lib/supabaseClient', () => ({
  createServerClient: () => supabaseMock,
}))
vi.mock('@/lib/placeTagging', () => ({
  generateTagsForPlace: vi.fn().mockResolvedValue(['coffee']),
}))

describe('POST /api/places/import', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    supabaseMock.reset()
    process.env.GOOGLE_MAPS_API_KEY = 'test-key'
  })

  it('imports a place via text search when place_id is missing', async () => {
    const placeId = 'ChIJabc1234'
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input)

      if (url.pathname.endsWith('/textsearch/json')) {
        return googleResponse({ status: 'OK', results: [{ place_id: placeId }] })
      }

      if (url.pathname.endsWith('/details/json')) {
        return googleResponse({
          status: 'OK',
          result: {
            place_id: placeId,
            name: 'Test Cafe',
            formatted_address: '1 Street, London',
            geometry: { location: { lat: 51.5, lng: -0.1 } },
            url: 'https://maps.google.com/?q=test',
            website: 'https://test.cafe',
            types: ['cafe'],
          },
        })
      }

      throw new Error(`Unexpected fetch ${url.toString()}`)
    })

    const request = new Request('http://localhost/api/places/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.google.com/maps/search/?q=Test+Cafe',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(fetchedPathnames()).toEqual([
      '/maps/api/place/textsearch/json',
      '/maps/api/place/details/json',
    ])
    expect(supabaseMock.upsertedPlaces[0]).toMatchObject({
      google_place_id: placeId,
      name: 'Test Cafe',
      status: 'unrated',
      cuisine_tags: ['cafe', 'coffee'],
    })
    expect(supabaseMock.placeLookups).toBe(0)
  })

  it('expands maps.app.goo.gl short links', async () => {
    const placeId = 'ChIJxyz987'
    const expandedUrl =
      'https://www.google.com/maps/place/Flat+White+Coffee/@51.5,-0.1,17z/data=!3m1!4b1!4m6!3m5!1sChIJxyz987!8m2!3d51.5!4d-0.1!16s%2Fg%2F11abcd'
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input)

      if (url.hostname === 'maps.app.goo.gl') {
        return googleResponse({}, expandedUrl)
      }

      if (url.pathname.endsWith('/nearbysearch/json')) {
        return googleResponse({
          status: 'OK',
          results: [
            {
              place_id: placeId,
              geometry: { location: { lat: 51.5, lng: -0.1 } },
            },
          ],
        })
      }

      if (url.pathname.endsWith('/details/json')) {
        return googleResponse({
          status: 'OK',
          result: {
            place_id: placeId,
            name: 'Flat White Coffee',
            formatted_address: '1 Street, London',
            geometry: { location: { lat: 51.5, lng: -0.1 } },
            url: 'https://maps.google.com/?q=flatwhite',
            website: null,
            types: ['cafe'],
          },
        })
      }

      throw new Error(`Unexpected fetch ${url.toString()}`)
    })

    const request = new Request('http://localhost/api/places/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://maps.app.goo.gl/short123',
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(fetchedPathnames()).toEqual([
      '/short123',
      '/maps/api/place/details/json',
      '/maps/api/place/nearbysearch/json',
    ])
    expect(supabaseMock.upsertedPlaces[0]).toMatchObject({
      google_place_id: placeId,
      name: 'Flat White Coffee',
      status: 'unrated',
    })
    expect(supabaseMock.placeLookups).toBe(0)
  })
})

function createSupabaseDouble() {
  const state = {
    placeLookups: 0,
    upsertedPlaces: [] as SavedPlace[],
  }

  return {
    get placeLookups() {
      return state.placeLookups
    },
    get upsertedPlaces() {
      return state.upsertedPlaces
    },
    reset() {
      state.placeLookups = 0
      state.upsertedPlaces = []
    },
    from(table: string) {
      if (table === 'places') {
        return {
          select: () => {
            state.placeLookups += 1
            return {
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }
          },
          upsert: (rows: PlaceInsert[]) => {
            const record = { id: `place-${state.upsertedPlaces.length + 1}`, ...rows[0] }
            state.upsertedPlaces.push(record)
            return {
              select: () => ({
                single: async () => ({ data: record, error: null }),
              }),
            }
          },
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }
}

function requestUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return new URL(input)
  if (input instanceof URL) return input
  return new URL(input.url)
}

function googleResponse(body: unknown, url = '') {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url,
    json: async () => body,
  } as Response
}

function fetchedPathnames() {
  return fetchMock.mock.calls.map(([input]) => requestUrl(input).pathname)
}
