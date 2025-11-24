import { describe, expect, it } from 'vitest'
import {
  appendMetricMeasurement,
  appendMetricMeasurementWithAI,
  MetricConversion,
} from './ingredientUnits'

describe('appendMetricMeasurement', () => {
  it('uses grams for cup measurements of rice/grains', () => {
    expect(appendMetricMeasurement('1 cup arborio rice')).toBe('1 cup arborio rice (200 g)')
  })

  it('keeps ml for liquids', () => {
    expect(appendMetricMeasurement('1 cup water')).toBe('1 cup water (240 ml)')
  })

  it('handles unicode fraction quantities', () => {
    expect(appendMetricMeasurement('½ cup sugar')).toBe('½ cup sugar (100 g)')
  })

  it('converts hyphenated ranges', () => {
    expect(appendMetricMeasurement('1-2 cups flour')).toBe('1-2 cups flour (125-250 g)')
  })

  it('converts verbal ranges', () => {
    expect(appendMetricMeasurement('1 to 2 tablespoons olive oil')).toBe(
      '1 to 2 tablespoons olive oil (15-30 ml)'
    )
  })

  it('converts approximate values like 3-ish cups', () => {
    expect(appendMetricMeasurement('3-ish cups chicken broth')).toBe(
      '3-ish cups chicken broth (720 ml)'
    )
  })

  it('adds grams for pounds and ounces', () => {
    expect(appendMetricMeasurement('2 pounds potatoes')).toBe('2 pounds potatoes (908 g)')
    expect(appendMetricMeasurement('8 oz pasta')).toBe('8 oz pasta (224 g)')
  })

  it('preserves bullets and notes', () => {
    expect(appendMetricMeasurement('- 1 cup milk (room temp)')).toBe(
      '- 1 cup milk (room temp) (240 ml)'
    )
  })

  it('skips when metric data already exists', () => {
    const alreadyMetric = '1 cup milk (240 ml)'
    expect(appendMetricMeasurement(alreadyMetric)).toBe(alreadyMetric)
  })

  it('converts sticks of butter to grams', () => {
    expect(appendMetricMeasurement('1 stick butter, melted')).toBe('1 stick butter, melted (113 g)')
  })

  it('converts fluid ounces separately from weight ounces', () => {
    expect(appendMetricMeasurement('4 fl oz cream')).toBe('4 fl oz cream (120 ml)')
  })

  it('uses flour override when cups are mentioned', () => {
    expect(appendMetricMeasurement('2 cups all-purpose flour')).toBe('2 cups all-purpose flour (250 g)')
  })

  it('uses cheese override for cups', () => {
    expect(appendMetricMeasurement('1 cup grated Parmesan cheese')).toBe(
      '1 cup grated Parmesan cheese (100 g)'
    )
  })

  it('uses leafy greens override for cups', () => {
    expect(appendMetricMeasurement('4 cups spinach or kale')).toBe('4 cups spinach or kale (120 g)')
  })

  it('uses AI fallback when heuristics are unsure', async () => {
    const mockConversion: MetricConversion = {
      metricUnit: 'g',
      ratio: 150,
      confidence: 'high',
      source: 'ai',
    }

    const result = await appendMetricMeasurementWithAI('1 cup mystery mix', {
      aiProvider: async () => mockConversion,
    })

    expect(result).toBe('1 cup mystery mix (150 g)')
  })
})


