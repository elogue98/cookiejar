import { describe, expect, it } from 'vitest'

import {
  assistantRequestSchema,
  imageFinalizeRequestSchema,
  parseJsonBody,
  parseJsonRequest,
  recipeCreateRequestSchema,
  recipeMutationRequestSchema,
  recipeUpdateRequestSchema,
  ratingRequestSchema,
} from './validation'

describe('bounded request schemas', () => {
  it('rejects chat histories above 20 messages or 4,000 characters per message', () => {
    const result = assistantRequestSchema.safeParse({
      recipeTitle: 'Soup',
      ingredients: null,
      instructions: null,
      tags: null,
      userMessage: 'What can I change?',
      messageHistory: Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })),
    })
    expect(result.success).toBe(false)

    const longMessage = assistantRequestSchema.safeParse({
      recipeTitle: 'Soup',
      ingredients: null,
      instructions: null,
      tags: null,
      userMessage: 'x'.repeat(4001),
      messageHistory: [],
    })
    expect(longMessage.success).toBe(false)
  })

  it('rejects forged identity fields in strict mutation bodies', () => {
    const parsed = recipeMutationRequestSchema.safeParse({
      recipeId: 'recipe-1',
      recipeTitle: 'Soup',
      ingredients: null,
      instructions: null,
      tags: null,
      userMessage: 'halve it',
      messageHistory: [],
      userId: 'attacker-profile',
    })
    expect(parsed.success).toBe(false)
  })

  it('returns a safe 400 ApiError for invalid JSON payloads', () => {
    expect(() => parseJsonBody({ title: '' }, recipeCreateRequestSchema)).toThrow('Invalid request body')
  })

  it('rejects chunked JSON bodies once the byte cap is crossed', async () => {
    const request = new Request('https://cookiejar.example/api/recipes/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'x'.repeat(100) }),
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(parseJsonRequest(request, recipeCreateRequestSchema, 32)).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    })
  })

  it('rejects chunked multipart bodies before form-data parsing crosses the byte cap', async () => {
    const { parseFormDataRequest } = await import('./validation') as typeof import('./validation') & {
      parseFormDataRequest: (request: Request, maxBytes: number) => Promise<FormData>
    }
    const request = new Request('https://cookiejar.example/api/import/image', {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(64))
          controller.close()
        },
      }),
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
      duplex: 'half',
    } as RequestInit)

    await expect(parseFormDataRequest(request, 32)).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    })
  })

  it('rejects identity fields and unknown fields in image finalization payloads', () => {
    const parsed = imageFinalizeRequestSchema.safeParse({
      title: 'Soup',
      imageBuffer: 'abcd',
      imageMimeType: 'image/png',
      userId: 'attacker-profile',
    })
    expect(parsed.success).toBe(false)
  })

  it('bounds numeric strings and source URLs in recipe payloads', () => {
    const oversizedNumericString = recipeCreateRequestSchema.safeParse({
      title: 'Soup',
      rating: '1'.repeat(10_001),
    })
    expect(oversizedNumericString.success).toBe(false)
    expect(recipeCreateRequestSchema.safeParse({ title: 'Soup', rating: '8oops' }).success).toBe(false)
    expect(recipeCreateRequestSchema.safeParse({ title: 'Soup', rating: '1e2' }).success).toBe(false)
    expect(ratingRequestSchema.safeParse({ rating: '8oops' }).success).toBe(false)
    expect(ratingRequestSchema.safeParse({ rating: '1e2' }).success).toBe(false)

    const oversizedSourceUrl = recipeMutationRequestSchema.safeParse({
      recipeId: 'recipe-1',
      recipeTitle: 'Soup',
      ingredients: null,
      instructions: null,
      tags: null,
      userMessage: 'save',
      messageHistory: [],
      source_url: `https://example.com/${'a'.repeat(2_049)}`,
    })
    expect(oversizedSourceUrl.success).toBe(false)

    const unsafeSourceUrls = [
      'javascript:alert(1)',
      'https://user:password@example.com/recipe',
      'ftp://example.com/recipe',
    ]
    for (const source_url of unsafeSourceUrls) {
      const parsed = recipeUpdateRequestSchema.safeParse({ title: 'Soup', source_url })
      expect(parsed.success, source_url).toBe(false)
    }
  })

  it('rejects recipe context that exceeds the AI text budget', () => {
    const oversizedInstructions = [{
      section: '',
      steps: Array.from({ length: 100 }, () => 'x'.repeat(2_000)),
    }]
    const parsed = assistantRequestSchema.safeParse({
      recipeTitle: 'Soup',
      ingredients: null,
      instructions: oversizedInstructions,
      tags: null,
      userMessage: 'Summarize this',
      messageHistory: [],
    })

    expect(parsed.success).toBe(false)
  })
})
