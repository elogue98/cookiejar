import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const fetchMock = vi.fn()
const supabaseMock = createSupabaseDouble()

vi.stubGlobal('fetch', fetchMock)
vi.mock('@/lib/supabaseClient', () => ({
  createServerClient: () => supabaseMock,
}))

describe('POST /api/places/import', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    supabaseMock.reset()
    process.env.GOOGLE_MAPS_API_KEY = 'test-key'
  })

  it('imports a place via text search when place_id is missing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', results: [{ place_id: 'abc123' }] }),
    })

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        result: {
          place_id: 'abc123',
          name: 'Test Cafe',
          formatted_address: '1 Street, London',
          geometry: { location: { lat: 51.5, lng: -0.1 } },
          url: 'https://maps.google.com/?q=test',
          website: 'https://test.cafe',
          types: ['cafe'],
        },
      }),
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
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(supabaseMock.upsertedPlaces[0].status).toBe('unrated')
  })

  it('expands maps.app.goo.gl short links', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.google.com/maps/place/Flat+White+Coffee/@51.5,-0.1,17z/data=!3m1!4b1!4m6!3m5!1sChIJxyz987!8m2!3d51.5!4d-0.1!16s%2Fg%2F11abcd',
      json: async () => ({}),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        result: {
          place_id: 'ChIJxyz987',
          name: 'Flat White Coffee',
          formatted_address: '1 Street, London',
          geometry: { location: { lat: 51.5, lng: -0.1 } },
          url: 'https://maps.google.com/?q=flatwhite',
          website: null,
          types: ['cafe'],
        },
      }),
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
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(supabaseMock.upsertedPlaces[0].google_place_id).toBe('ChIJxyz987')
  })
})

function createSupabaseDouble() {
  const state = {
    upsertedPlaces: [] as any[],
  }

  return {
    get upsertedPlaces() {
      return state.upsertedPlaces
    },
    reset() {
      state.upsertedPlaces = []
    },
    from(table: string) {
      if (table === 'places') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          upsert: (rows: any[]) => {
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


