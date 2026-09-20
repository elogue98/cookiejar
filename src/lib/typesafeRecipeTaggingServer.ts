import type { TagInput } from '@/lib/aiTagging'
import {
  buildRecipeTagQuestions,
  interpretTypeSafeResponse,
  normalizeRecipeTaggingState,
  validateTypeSafeResponse,
  TYPE_SAFE_DEFAULT_MODEL,
  type EvaluateRecipeTagsOptions,
  type TypeSafeRequest,
  type TypeSafeTaggingResult,
} from '@/lib/typesafeRecipeTagging'

export const TYPE_SAFE_DEFAULT_TIMEOUT_MS = 10_000
export const TYPE_SAFE_API_URL = 'https://api.typesafe.ai/v1/systemone'

class TypeSafeTransportError extends Error {
  constructor(
    readonly reason: Extract<
      TypeSafeTaggingResult,
      { source: 'unavailable' }
    >['reason'],
  ) {
    super(`TypeSafe transport failed: ${reason}`)
    this.name = 'TypeSafeTransportError'
  }
}

export async function typeSafeFetchTransport(
  request: TypeSafeRequest,
  options: { apiKey: string; timeoutMs: number },
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

  try {
    const response = await fetch(TYPE_SAFE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 401) throw new TypeSafeTransportError('unauthorized')
      if (response.status === 429) throw new TypeSafeTransportError('rate_limit')
      if (response.status === 529) throw new TypeSafeTransportError('overloaded')
      throw new TypeSafeTransportError('transport_error')
    }

    try {
      return await response.json()
    } catch {
      throw new TypeSafeTransportError('invalid_response')
    }
  } catch (error) {
    if (error instanceof TypeSafeTransportError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TypeSafeTransportError('timeout')
    }
    throw new TypeSafeTransportError('transport_error')
  } finally {
    clearTimeout(timeout)
  }
}

export async function evaluateRecipeTagsWithTypeSafe(
  input: TagInput,
  options: EvaluateRecipeTagsOptions = {},
): Promise<TypeSafeTaggingResult> {
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY
  if (!apiKey) return { source: 'unavailable', reason: 'missing_key' }
  if (typeof window !== 'undefined') return { source: 'unavailable', reason: 'server_only' }

  const state = normalizeRecipeTaggingState(input)
  const questions = buildRecipeTagQuestions()
  const request: TypeSafeRequest = {
    state,
    model: options.model ?? TYPE_SAFE_DEFAULT_MODEL,
    questions,
  }
  const transport = options.transport ?? typeSafeFetchTransport

  try {
    const rawResponse = await transport(request, {
      apiKey,
      timeoutMs: options.timeoutMs ?? TYPE_SAFE_DEFAULT_TIMEOUT_MS,
    })
    const response = validateTypeSafeResponse(rawResponse, Object.keys(questions))
    if (!response) return { source: 'unavailable', reason: 'invalid_response' }
    return interpretTypeSafeResponse(response)
  } catch (error) {
    if (error instanceof TypeSafeTransportError) {
      return { source: 'unavailable', reason: error.reason }
    }
    return { source: 'unavailable', reason: 'transport_error' }
  }
}
