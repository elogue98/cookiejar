import { supabase } from './supabaseClient'

export type PlaceStatus = 'visited' | 'want' | 'unrated'

export type Place = {
  id: string
  google_place_id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  url: string | null
  website: string | null
  status: PlaceStatus
  notes: string | null
  cuisine_tags: string[]
  created_at: string
  updated_at: string
  rating_average?: number | null
  rating_count?: number
}

type RatingRow = { place_id: string; rating: number }

export async function fetchPlaces(userId?: string) {
  const { data, error } = await supabase.from('places').select('*').order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch places: ${error.message}`)
  }

  const places = ((data as Place[]) || []).map((p) => ({ ...p, rating_average: null, rating_count: 0 }))

  // Fetch rating aggregates
  const { data: ratingRows, error: ratingsError } = await supabase
    .from('place_ratings')
    .select('place_id, rating') as unknown as { data: RatingRow[] | null; error: any }

  if (ratingsError) {
    console.warn('Could not fetch place ratings (continuing without aggregates):', ratingsError)
    return places
  }

  const byPlace: Record<string, RatingRow[]> = {}
  ratingRows?.forEach((row) => {
    if (!byPlace[row.place_id]) byPlace[row.place_id] = []
    byPlace[row.place_id].push(row)
  })

  return places.map((place) => {
    const rows = byPlace[place.id] || []
    if (!rows.length) return place
    const sum = rows.reduce((acc, r) => acc + r.rating, 0)
    const avg = Math.round((sum / rows.length) * 10) / 10
    return {
      ...place,
      rating_average: avg,
      rating_count: rows.length,
    }
  })
}

export async function fetchPlace(id: string) {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch place ${id}: ${error.message}`)
  }

  return data as Place
}

