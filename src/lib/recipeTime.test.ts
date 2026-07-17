import { describe, expect, it } from 'vitest'
import { formatRecipeTime, parseIsoDurationMinutes } from './recipeTime'

describe('parseIsoDurationMinutes', () => {
  it('parses ISO-8601 recipe durations into minutes', () => {
    expect(parseIsoDurationMinutes('PT10M')).toBe(10)
    expect(parseIsoDurationMinutes('PT1H')).toBe(60)
    expect(parseIsoDurationMinutes('PT1H30M')).toBe(90)
  })

  it('tolerates whitespace and lowercase ISO duration values', () => {
    expect(parseIsoDurationMinutes(' pt1h30m ')).toBe(90)
  })

  it('returns null for non-ISO duration values', () => {
    expect(parseIsoDurationMinutes('10 minutes')).toBeNull()
  })
})

describe('formatRecipeTime', () => {
  it('formats ISO-8601 minute durations compactly', () => {
    expect(formatRecipeTime('PT10M')).toBe('10 min')
  })

  it('formats ISO-8601 hour durations compactly', () => {
    expect(formatRecipeTime('PT1H')).toBe('1 hr')
  })

  it('formats ISO-8601 hour and minute durations compactly', () => {
    expect(formatRecipeTime('PT1H30M')).toBe('1 hr 30 min')
  })

  it('normalizes readable minute strings', () => {
    expect(formatRecipeTime('10 minutes')).toBe('10 min')
    expect(formatRecipeTime('15 mins')).toBe('15 min')
  })

  it('normalizes readable hour and minute strings', () => {
    expect(formatRecipeTime('1 hour 30 minutes')).toBe('1 hr 30 min')
  })

  it('returns an empty string unchanged', () => {
    expect(formatRecipeTime('')).toBe('')
  })
})
