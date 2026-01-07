import { describe, expect, it } from 'vitest'
import {
  deriveTextSearchQuery,
  extractPlaceIdFromUrl,
  mapPlaceTypesToTags,
  parseLatLngFromUrl,
} from './googlePlaces'

describe('extractPlaceIdFromUrl', () => {
  it('pulls place_id from q param', () => {
    const url = 'https://www.google.com/maps/place/?q=place_id:ChIJ123456'
    expect(extractPlaceIdFromUrl(url)).toBe('ChIJ123456')
  })

  it('pulls query_place_id param', () => {
    const url = 'https://www.google.com/maps/search/?api=1&query_place_id=ChIJabcdef'
    expect(extractPlaceIdFromUrl(url)).toBe('ChIJabcdef')
  })

  it('pulls encoded place id from data blob', () => {
    const url =
      'https://www.google.com/maps/place/Test+Cafe/data=!3m1!4b1!4m5!3m4!1sChIJxyz987!8m2!3d51.5!4d-0.1'
    expect(extractPlaceIdFromUrl(url)).toBe('ChIJxyz987')
  })

  it('returns null when nothing matches', () => {
    const url = 'https://maps.app.goo.gl/short'
    expect(extractPlaceIdFromUrl(url)).toBeNull()
  })
})

describe('deriveTextSearchQuery', () => {
  it('uses q param when not a place id', () => {
    const url = 'https://www.google.com/maps/search/?q=Best+coffee+London'
    expect(deriveTextSearchQuery(url)).toBe('Best coffee London')
  })

  it('uses path segment after /place/', () => {
    const url =
      'https://www.google.com/maps/place/Flat+White+Coffee/@51.5,-0.1,17z/data=!3m1!4b1!4m6'
    expect(deriveTextSearchQuery(url)).toBe('Flat White Coffee')
  })

  it('returns null for unparseable URLs', () => {
    expect(deriveTextSearchQuery('not a url')).toBeNull()
  })
})

describe('parseLatLngFromUrl', () => {
  it('prefers pin coordinates when present', () => {
    const url =
      'https://www.google.com/maps/place/Nostos+Coffee/@51.4986862,-0.1436015,15z/data=!3m2!4b1!5s0x487604dc6e2831b1:0xfa9f9db9eec8d02f!4m6!3m5!1s0x48760513cb9f6363:0x4b85618e89510990!8m2!3d51.4986733!4d-0.1333018!16s%2Fg%2F11y2fkqphn?entry=ttu'
    expect(parseLatLngFromUrl(url)).toEqual({ lat: 51.4986733, lng: -0.1333018 })
  })

  it('falls back to viewport coordinates when pins are missing', () => {
    const url = 'https://www.google.com/maps/place/Test/@40.0,-74.0,17z'
    expect(parseLatLngFromUrl(url)).toEqual({ lat: 40, lng: -74 })
  })

  it('returns null for unparseable URLs', () => {
    expect(parseLatLngFromUrl('not a url')).toBeNull()
  })
})

describe('mapPlaceTypesToTags', () => {
  it('normalizes underscores and dedupes', () => {
    expect(mapPlaceTypesToTags(['cafe', 'coffee_shop', 'cafe'])).toEqual(['cafe', 'coffee shop'])
  })

  it('handles empty types', () => {
    expect(mapPlaceTypesToTags(undefined)).toEqual([])
    expect(mapPlaceTypesToTags([])).toEqual([])
  })
})


