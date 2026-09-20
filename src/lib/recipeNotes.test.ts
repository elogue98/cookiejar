import { describe, expect, it } from 'vitest'

import { parseRecipeNotes } from './recipeNotes'

describe('parseRecipeNotes', () => {
  it('suppresses legacy metadata JSON with no description', () => {
    expect(parseRecipeNotes(JSON.stringify({ servings: 8, prepTime: '15 minutes' }))).toEqual({
      description: undefined,
      legacyMetadata: { servings: 8, prepTime: '15 minutes' },
    })
  })

  it('extracts a description from legacy metadata JSON', () => {
    expect(
      parseRecipeNotes(JSON.stringify({ description: 'A family favourite', servings: 4 })).description,
    ).toBe('A family favourite')
  })

  it('preserves ordinary text and unrecognized JSON objects', () => {
    expect(parseRecipeNotes('A family favourite').description).toBe('A family favourite')
    expect(parseRecipeNotes('{"custom":"note"}').description).toBe('{"custom":"note"}')
  })

  it.each([
    { nutrition: { calories: 180 } },
    { cuisine: 'Vegetarian' },
    { mealType: 'Side Dish' },
  ])('recognizes metadata-only legacy notes: %j', (metadata) => {
    expect(parseRecipeNotes(JSON.stringify(metadata))).toEqual({
      description: undefined,
      legacyMetadata: metadata,
    })
  })

  it.each(['', ' ', 'null', 'undefined', 'n/a'])('ignores empty description value %j', (description) => {
    expect(parseRecipeNotes(JSON.stringify({ description, servings: 4 })).description).toBeUndefined()
  })
})
