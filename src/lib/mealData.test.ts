import { describe, expect, it } from 'vitest'
import {
  CARBS,
  DEFAULT_TARGET,
  PROTEINS,
  VEGS,
  calculateMealPortions,
  parseStoredMacroTarget,
} from './mealData'

describe('parseStoredMacroTarget', () => {
  it('returns a complete finite non-negative saved target', () => {
    const stored = JSON.stringify({ calories: 2200, protein: 160, carbs: 230, fat: 70 })

    expect(parseStoredMacroTarget(stored)).toEqual({
      calories: 2200,
      protein: 160,
      carbs: 230,
      fat: 70,
    })
  })

  it.each([
    null,
    'not-json',
    JSON.stringify({ calories: 2200, protein: 160, carbs: 230 }),
    JSON.stringify({ calories: -1, protein: 160, carbs: 230, fat: 70 }),
    JSON.stringify({ calories: 2650, protein: 175, carbs: 260, fat: 68 }),
  ])('falls back to the default for invalid or stale input: %s', (stored) => {
    expect(parseStoredMacroTarget(stored)).toEqual(DEFAULT_TARGET)
  })
})

describe('calculateMealPortions', () => {
  it('uses protein and carbohydrate targets while reporting calories and fat as results', () => {
    const result = calculateMealPortions(
      { calories: 723, protein: 71, carbs: 78, fat: 20 },
      { protein: 'salmon', carbs: ['rice'], vegs: [] },
      PROTEINS,
      CARBS,
      VEGS
    )

    expect(result.portions.map(({ food }) => food.id)).toEqual(['salmon', 'rice'])
    expect(result.portions[0].protein).toBeCloseTo(71)
    expect(result.portions[1].carbs).toBeCloseTo(78)
    expect(result.totalCalories).toBeGreaterThan(723)
    expect(result.totalFat).toBeGreaterThan(20)
  })
})
