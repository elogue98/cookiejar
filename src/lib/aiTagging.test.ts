import { afterEach, describe, expect, it, vi } from 'vitest'

const { aiComplete } = vi.hoisted(() => ({ aiComplete: vi.fn() }))

vi.mock('@/lib/ai', () => ({ aiComplete }))

import {
  generateKeywordTagsForRecipe,
  generateTagsForRecipeForEvaluation,
} from '@/lib/aiTagging'

describe('current tagger evaluation mode', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('does not turn a missing OpenAI key into a keyword baseline result', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    await expect(generateTagsForRecipeForEvaluation({ title: 'Chicken curry' })).resolves.toEqual({
      source: 'unavailable',
      reason: 'missing_key',
    })
  })

  it('reports a successful OpenAI result as OpenAI-sourced', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    aiComplete.mockResolvedValue(JSON.stringify({ tags: ['chicken', 'curry'] }))

    await expect(
      generateTagsForRecipeForEvaluation({ title: 'Chicken curry', ingredients: ['chicken'] }),
    ).resolves.toEqual({ source: 'openai', tags: ['chicken', 'curry'] })
  })

  it('does not turn an invalid OpenAI response into a keyword baseline result', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    aiComplete.mockResolvedValue('not-json')

    await expect(generateTagsForRecipeForEvaluation({ title: 'Chicken curry' })).resolves.toEqual({
      source: 'unavailable',
      reason: 'invalid_response',
    })
  })

  it('keeps the ordinary keyword fallback available separately', () => {
    expect(generateKeywordTagsForRecipe({ title: 'Chicken curry' })).toEqual(['chicken', 'curry'])
  })
})
