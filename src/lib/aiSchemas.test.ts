import { describe, expect, it } from 'vitest'

import {
  expectedMatchesOutputSchema,
  imageRecipeOutputSchema,
  recipeExtractionOutputSchema,
  tagsOutputSchema,
} from './aiSchemas'

describe('AI output schemas', () => {
  it('accepts the supported structured recipe shape', () => {
    expect(recipeExtractionOutputSchema.safeParse({
      title: 'Soup',
      description: null,
      sourceUrl: null,
      image: null,
      servings: 4,
      prepTime: '10 minutes',
      cookTime: '20 minutes',
      totalTime: '30 minutes',
      cuisine: null,
      mealType: null,
      nutrition: { calories: 300, protein: 12, fat: 8, carbs: 40 },
      ingredientSections: [{ section: null, items: ['1 onion'] }],
      instructionSections: [{ section: null, steps: ['Cook the onion.'] }],
      tags: ['soup'],
    }).success).toBe(true)
  })

  it('rejects malformed or unexpected model fields before persistence', () => {
    const validTags = { tags: ['soup'] }
    expect(tagsOutputSchema.safeParse({ ...validTags, userId: 'attacker' }).success).toBe(false)
    expect(imageRecipeOutputSchema.safeParse({
      title: 'Soup',
      ingredients: ['1 onion'],
      instructions: ['Cook it.'],
      tags: null,
      extra: 'unexpected',
    }).success).toBe(false)
    expect(expectedMatchesOutputSchema.safeParse({ matches: [{ stepId: 'step-0', ingredientIds: ['0-0'] }] }).success).toBe(true)
    expect(expectedMatchesOutputSchema.safeParse({ matches: [{ stepId: 'step-0', ingredientIds: ['x'.repeat(101)] }] }).success).toBe(false)

    const oversizedUrl = `https://example.com/${'a'.repeat(2_049)}`
    expect(recipeExtractionOutputSchema.safeParse({
      title: 'Soup',
      description: null,
      sourceUrl: oversizedUrl,
      image: null,
      servings: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      cuisine: null,
      mealType: null,
      nutrition: null,
      ingredientSections: [{ section: null, items: ['1 onion'] }],
      instructionSections: [{ section: null, steps: ['Cook it.'] }],
      tags: null,
    }).success).toBe(false)

    for (const unsafeUrl of ['javascript:alert(1)', 'https://user:password@example.com/recipe', 'ftp://example.com/recipe']) {
      expect(recipeExtractionOutputSchema.safeParse({
        title: 'Soup',
        description: null,
        sourceUrl: unsafeUrl,
        image: null,
        servings: null,
        prepTime: null,
        cookTime: null,
        totalTime: null,
        cuisine: null,
        mealType: null,
        nutrition: null,
        ingredientSections: [{ section: null, items: ['1 onion'] }],
        instructionSections: [{ section: null, steps: ['Cook it.'] }],
        tags: null,
      }).success, unsafeUrl).toBe(false)
    }
  })
})
