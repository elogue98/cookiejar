import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai', () => ({
  aiComplete: vi.fn(),
}))

import { generateTagsForRecipe } from '@/lib/aiTagging'

import {
  RECIPE_TAG_CUISINES,
  RECIPE_TAG_DIETARY,
  RECIPE_TAG_MAIN_INGREDIENTS,
  RECIPE_TAG_METHODS,
  RECIPE_TAG_TAXONOMY,
} from '@/lib/recipeTagTaxonomy'

describe('recipe tag experiment taxonomy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('freezes the existing fallback vocabulary without duplicates', () => {
    expect(RECIPE_TAG_TAXONOMY).toHaveLength(60)
    expect(new Set(RECIPE_TAG_TAXONOMY).size).toBe(RECIPE_TAG_TAXONOMY.length)
    expect(RECIPE_TAG_TAXONOMY).toContain('quick')
    expect(RECIPE_TAG_TAXONOMY).toContain('middle eastern')
  })

  it('keeps category lists disjoint and complete', () => {
    const grouped = [
      ...RECIPE_TAG_CUISINES,
      ...RECIPE_TAG_METHODS,
      ...RECIPE_TAG_DIETARY,
      ...RECIPE_TAG_MAIN_INGREDIENTS,
      'quick',
    ]

    expect(new Set(grouped).size).toBe(grouped.length)
    expect(new Set(grouped)).toEqual(new Set(RECIPE_TAG_TAXONOMY))
  })

  it('does not change the existing keyword fallback behavior', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    await expect(
      generateTagsForRecipe({
        title: 'Chicken curry',
        ingredients: ['tomato', 'vegetable'],
        instructions: 'A quick simmer.',
      }),
    ).resolves.toEqual(['chicken', 'curry', 'tomato', 'vegetarian', 'quick'])
  })
})
