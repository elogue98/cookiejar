import { describe, expect, it } from 'vitest'

import { isTrainingEnabled } from './trainingAvailability'

describe('training availability', () => {
  it.each([
    ['development', true],
    ['test', false],
    ['production', false],
  ] as const)('allows training only in development (%s)', (environment, expected) => {
    expect(isTrainingEnabled(environment)).toBe(expected)
  })
})
