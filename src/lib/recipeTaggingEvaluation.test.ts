import { describe, expect, it } from 'vitest'

import {
  calculateRecipeTaggingMetrics,
  findContradictoryRecipeTags,
  parseRecipeTagEvaluationCases,
  parseRecipeTagFixtureReferences,
  type RecipeTagEvaluationCase,
} from '@/lib/recipeTaggingEvaluation'

const cases: RecipeTagEvaluationCase[] = [
  {
    id: 'one',
    title: 'Chicken rice',
    ingredients: ['chicken', 'rice'],
    instructions: 'Cook.',
    expectedTags: ['chicken', 'rice'],
  },
  {
    id: 'two',
    title: 'Soup',
    ingredients: ['tomato'],
    instructions: 'Simmer.',
    expectedTags: ['soup'],
  },
]

describe('recipe tagging evaluation metrics', () => {
  it('reports taxonomy-projected classification metrics and baseline OOV rate', () => {
    const metrics = calculateRecipeTaggingMetrics(cases, [
      { tags: ['chicken', 'rice', 'new-tag'] },
      { tags: [] },
    ])

    expect(metrics.micro).toEqual({ precision: 2 / 3, recall: 2 / 3, f1: 2 / 3 })
    expect(metrics.exactSetMatchRate).toBe(0)
    expect(metrics.meanJaccard).toBeCloseTo(1 / 3)
    expect(metrics.outOfTaxonomyRate).toBe(1 / 3)
    expect(metrics.perTag.chicken).toEqual({ precision: 1, recall: 1, f1: 1, support: 1 })
    expect(metrics.perTag.soup).toEqual({ precision: 0, recall: 0, f1: 0, support: 1 })
  })

  it('reports TypeSafe availability, abstention, and probability calibration', () => {
    const metrics = calculateRecipeTaggingMetrics(cases, [
      { tags: ['chicken'], status: 'matched', probabilities: { chicken: 0.9, rice: 0.4, soup: 0.1 } },
      { tags: [], status: 'uncertain', probabilities: { chicken: 0.2, rice: 0.2, soup: 0.6 } },
    ])

    expect(metrics.availabilityRate).toBe(1)
    expect(metrics.coverageRate).toBe(0.5)
    expect(metrics.abstentionRate).toBe(0.5)
    expect(metrics.selectivePrecision).toBe(1)
    expect(metrics.brierScore).toBeCloseTo((0.1 ** 2 + 0.6 ** 2 + 0.1 ** 2 + 0.2 ** 2 + 0.2 ** 2 + 0.4 ** 2) / 6)
  })

  it('scores valid no-match decisions and excludes unavailable calls from quality metrics', () => {
    const metrics = calculateRecipeTaggingMetrics(
      [
        { id: 'none', title: 'Plain', ingredients: [], instructions: '', expectedTags: [] },
        { id: 'unavailable', title: 'Chicken', ingredients: [], instructions: '', expectedTags: ['chicken'] },
      ],
      [
        { tags: [], status: 'no_match' },
        { tags: [], status: 'unavailable', unavailableReason: 'timeout', latencyMs: 42 },
      ],
    )

    expect(metrics.scoredCases).toBe(1)
    expect(metrics.exactSetMatchRate).toBe(1)
    expect(metrics.meanJaccard).toBe(1)
    expect(metrics.coverageRate).toBe(0.5)
    expect(metrics.availabilityRate).toBe(0.5)
    expect(metrics.outcomeCounts).toEqual({ matched: 0, uncertain: 0, no_match: 1, unavailable: 1 })
    expect(metrics.unavailableReasons).toEqual({ timeout: 1 })
    expect(metrics.latencyMs).toEqual({ p50: 42, p95: 42 })
  })

  it('reports clear contradictory tag pairs', () => {
    const metrics = calculateRecipeTaggingMetrics(
      [{ id: 'one', title: 'Recipe', ingredients: [], instructions: '', expectedTags: [] }],
      [{ tags: ['vegetarian', 'chicken'] }],
    )

    expect(findContradictoryRecipeTags(['vegan', 'cheese'])).toEqual([['vegan', 'cheese']])
    expect(metrics.contradictoryCaseCount).toBe(1)
    expect(metrics.contradictoryCaseRate).toBe(1)
  })

  it('validates evaluation fixtures against the frozen taxonomy', () => {
    expect(parseRecipeTagEvaluationCases([
      { id: 'ok', title: 'Soup', ingredients: ['tomato'], instructions: 'Cook.', expectedTags: ['soup'] },
    ])).toHaveLength(1)
    expect(() => parseRecipeTagEvaluationCases([
      { id: 'bad', title: 'Recipe', ingredients: [], instructions: '', expectedTags: ['invented-tag'] },
    ])).toThrow()
    expect(parseRecipeTagFixtureReferences([
      { id: 'fixture', fixture: 'recipe.json', expectedTags: ['soup'] },
    ])).toHaveLength(1)
    expect(() => parseRecipeTagFixtureReferences([
      { id: 'bad', fixture: 'recipe.json', expectedTags: ['invented-tag'] },
    ])).toThrow()
  })
})
