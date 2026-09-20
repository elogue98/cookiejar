import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildRecipeTagQuestions,
  classifyTypeSafeProbabilities,
  interpretTypeSafeResponse,
  normalizeRecipeTaggingState,
  TYPE_SAFE_TAG_THRESHOLDS,
} from '@/lib/typesafeRecipeTagging'
import { evaluateRecipeTagsWithTypeSafe } from '@/lib/typesafeRecipeTaggingServer'

describe('TypeSafe recipe tagging experiment', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes bounded text state without carrying unrelated metadata', () => {
    const state = normalizeRecipeTaggingState({
      title: '  <b>Chicken   Curry</b>  ',
      ingredients: [' chicken breast ', 'coconut milk'],
      instructions: '  Simmer\nfor 20 minutes. '.repeat(80),
    })

    expect(state).toEqual({
      title: 'Chicken Curry',
      ingredients: ['chicken breast', 'coconut milk'],
      instructions: expect.any(String),
    })
    expect(state.instructions.length).toBeLessThanOrEqual(300)
    expect(state).not.toHaveProperty('url')
  })

  it('builds one stable Noul question per frozen tag', () => {
    const questions = buildRecipeTagQuestions()

    expect(Object.keys(questions)).toHaveLength(60)
    expect(questions.tag_00).toEqual({
      type: 'noul',
      instructions: expect.stringContaining('"italian"'),
      criteria: {
        true: expect.stringContaining('central'),
        false: expect.stringContaining('incidental'),
      },
    })
    expect(questions.tag_59).toEqual(expect.objectContaining({
      type: 'noul',
      instructions: expect.stringContaining('"quick"'),
    }))
  })

  it('preserves accepted tags, uncertain tags, and taxonomy order', () => {
    const result = interpretTypeSafeResponse(
      {
        model: 'jev-latest',
        answers: {
          tag_00: { type: 'noul', noul: 0.91 },
          tag_01: { type: 'noul', noul: 0.81 },
          tag_02: { type: 'noul', noul: 0.79 },
          tag_03: { type: 'noul', noul: 0.2 },
          tag_04: { type: 'noul', noul: 0.19 },
        },
        usage: { input_tokens: 10, output_tokens: 5 },
      },
      ['italian', 'chinese', 'japanese', 'indian', 'mexican'],
    )

    expect(result.status).toBe('matched')
    expect(result.tags).toEqual(['italian', 'chinese'])
    expect(result.uncertainTags).toEqual(['japanese'])
    expect(result.probabilities).toEqual({
      italian: 0.91,
      chinese: 0.81,
      japanese: 0.79,
      indian: 0.2,
      mexican: 0.19,
    })
  })

  it('distinguishes uncertain from a valid no-match at the threshold boundaries', () => {
    const uncertain = interpretTypeSafeResponse(
      {
        model: 'jev-latest',
        answers: {
          tag_00: { type: 'noul', noul: TYPE_SAFE_TAG_THRESHOLDS.reject + 0.01 },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      ['italian'],
    )
    const noMatch = interpretTypeSafeResponse(
      {
        model: 'jev-latest',
        answers: {
          tag_00: { type: 'noul', noul: TYPE_SAFE_TAG_THRESHOLDS.reject },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      ['italian'],
    )

    expect(uncertain.status).toBe('uncertain')
    expect(noMatch.status).toBe('no_match')
  })

  it('returns unavailable results without falling back to baseline tags', async () => {
    const result = await evaluateRecipeTagsWithTypeSafe(
      { title: 'Chicken curry', ingredients: ['chicken'], instructions: 'Simmer.' },
      { apiKey: '' },
    )

    expect(result).toEqual({ source: 'unavailable', reason: 'missing_key' })
  })

  it('rejects malformed or incomplete transport responses', async () => {
    const transport = vi.fn().mockResolvedValue({
      model: 'jev-latest',
      answers: { tag_00: { type: 'noul', noul: 2 } },
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    const result = await evaluateRecipeTagsWithTypeSafe(
      { title: 'Chicken curry', ingredients: ['chicken'], instructions: 'Simmer.' },
      { apiKey: 'test-key', transport },
    )

    expect(result).toEqual({ source: 'unavailable', reason: 'invalid_response' })
    expect(transport).toHaveBeenCalledOnce()
  })

  it('sends one server-side request containing every Noul question', async () => {
    const transport = vi.fn().mockImplementation(async (request) => ({
      model: request.model,
      answers: Object.fromEntries(
        Object.keys(request.questions).map((id) => [id, { type: 'noul', noul: id === 'tag_00' ? 0.9 : 0.1 }]),
      ),
      usage: { input_tokens: 12, output_tokens: 34 },
    }))

    const result = await evaluateRecipeTagsWithTypeSafe(
      { title: 'Italian pasta', ingredients: ['pasta'], instructions: 'Boil.' },
      { apiKey: 'test-key', transport },
    )

    expect(transport).toHaveBeenCalledOnce()
    expect(Object.keys(transport.mock.calls[0][0].questions)).toHaveLength(60)
    expect(result.source).toBe('typesafe')
    if (result.source === 'typesafe') {
      expect(result.tags).toEqual(['italian'])
      expect(result.status).toBe('matched')
    }
  })

  it('caps accepted tags at eight after probability ordering', () => {
    const taxonomy = ['italian', 'chinese', 'japanese', 'indian', 'mexican', 'thai', 'french', 'greek', 'american', 'korean'] as const
    const result = interpretTypeSafeResponse(
      {
        model: 'jev-latest',
        answers: Object.fromEntries(
          taxonomy.map((_, index) => [`tag_${String(index).padStart(2, '0')}`, { type: 'noul', noul: 0.9 - index / 100 }]),
        ),
        usage: { input_tokens: 1, output_tokens: 1 },
      },
      taxonomy,
    )

    expect(result.tags).toEqual(taxonomy.slice(0, 8))
    expect(result.uncertainTags).toEqual([])
  })

  it('supports threshold sweeps without changing the raw probabilities', () => {
    const result = classifyTypeSafeProbabilities(
      { italian: 0.75, chinese: 0.35 },
      { accept: 0.7, reject: 0.3 },
      ['italian', 'chinese'],
    )

    expect(result).toEqual({
      status: 'matched',
      tags: ['italian'],
      uncertainTags: ['chinese'],
    })
  })

  it('maps server transport status and timeout failures explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(
      evaluateRecipeTagsWithTypeSafe(
        { title: 'Recipe', ingredients: [], instructions: '' },
        { apiKey: 'test-key' },
      ),
    ).resolves.toEqual({ source: 'unavailable', reason: 'unauthorized' })

    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))
    await expect(
      evaluateRecipeTagsWithTypeSafe(
        { title: 'Recipe', ingredients: [], instructions: '' },
        { apiKey: 'test-key' },
      ),
    ).resolves.toEqual({ source: 'unavailable', reason: 'timeout' })
  })
})
