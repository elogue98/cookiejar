import { z } from 'zod'

import type { TagInput } from '@/lib/aiTagging'
import {
  isRecipeTag,
  RECIPE_TAG_CUISINES,
  RECIPE_TAG_DIETARY,
  RECIPE_TAG_MAIN_INGREDIENTS,
  RECIPE_TAG_METHODS,
  RECIPE_TAG_TAXONOMY,
  type RecipeTag,
} from '@/lib/recipeTagTaxonomy'

export type TypeSafeThresholds = {
  accept: number
  reject: number
}

export const TYPE_SAFE_TAG_THRESHOLDS: TypeSafeThresholds = {
  accept: 0.8,
  reject: 0.2,
} as const

export const TYPE_SAFE_MAX_ACCEPTED_TAGS = 8
export const TYPE_SAFE_DEFAULT_MODEL = 'jev-latest'

const MAX_TITLE_CHARS = 240
const MAX_INGREDIENTS = 100
const MAX_INGREDIENT_CHARS = 200
const MAX_INSTRUCTIONS_CHARS = 300

export type RecipeTaggingState = {
  title: string
  ingredients: string[]
  instructions: string
}

export type TypeSafeQuestion = {
  type: 'noul'
  instructions: string
  criteria: {
    true: string
    false: string
  }
}

export type TypeSafeQuestions = Record<string, TypeSafeQuestion>

export type TypeSafeRequest = {
  state: RecipeTaggingState
  model: string
  questions: TypeSafeQuestions
}

type TypeSafeNoulAnswer = {
  type: 'noul'
  noul: number
}

export type TypeSafeResponse = {
  model: string
  answers: Record<string, TypeSafeNoulAnswer>
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export type TypeSafeTaggingResult =
  | {
      source: 'typesafe'
      status: 'matched' | 'uncertain' | 'no_match'
      tags: RecipeTag[]
      uncertainTags: RecipeTag[]
      probabilities: Record<string, number>
      usage: TypeSafeResponse['usage']
      model: string
    }
  | {
      source: 'unavailable'
      reason:
        | 'missing_key'
        | 'server_only'
        | 'timeout'
        | 'unauthorized'
        | 'rate_limit'
        | 'overloaded'
        | 'invalid_response'
        | 'transport_error'
    }

export type TypeSafeTransport = (
  request: TypeSafeRequest,
  options: { apiKey: string; timeoutMs: number },
) => Promise<unknown>

export type EvaluateRecipeTagsOptions = {
  apiKey?: string
  model?: string
  timeoutMs?: number
  transport?: TypeSafeTransport
}

export type TypeSafeDecision = {
  status: 'matched' | 'uncertain' | 'no_match'
  tags: RecipeTag[]
  uncertainTags: RecipeTag[]
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeRecipeTaggingState(input: TagInput): RecipeTaggingState {
  const ingredients = input.ingredients
    ? Array.isArray(input.ingredients)
      ? input.ingredients
      : [input.ingredients]
    : []

  return {
    title: cleanText(input.title).slice(0, MAX_TITLE_CHARS),
    ingredients: ingredients
      .map(cleanText)
      .filter(Boolean)
      .slice(0, MAX_INGREDIENTS)
      .map((ingredient) => ingredient.slice(0, MAX_INGREDIENT_CHARS)),
    instructions: cleanText(input.instructions ?? '').slice(0, MAX_INSTRUCTIONS_CHARS),
  }
}

function tagCategory(tag: RecipeTag): string {
  if ((RECIPE_TAG_CUISINES as readonly string[]).includes(tag)) return 'cuisine'
  if ((RECIPE_TAG_METHODS as readonly string[]).includes(tag)) return 'cooking method'
  if ((RECIPE_TAG_DIETARY as readonly string[]).includes(tag)) return 'dietary property'
  if ((RECIPE_TAG_MAIN_INGREDIENTS as readonly string[]).includes(tag)) return 'main ingredient or dish type'
  return 'time-related property'
}

export function buildRecipeTagQuestions(
  taxonomy: readonly RecipeTag[] = RECIPE_TAG_TAXONOMY,
): TypeSafeQuestions {
  return Object.fromEntries(
    taxonomy.map((tag, index) => [
      `tag_${String(index).padStart(2, '0')}`,
      {
        type: 'noul',
        instructions: `Should this recipe be tagged "${tag}" for search and categorization, based on \`title\`, \`ingredients\`, and \`instructions\`?`,
        criteria: {
          true: `The recipe clearly has "${tag}" as a central ${tagCategory(tag)}.`,
          false: `The tag is absent, contradicted, or only incidental and would mislead someone searching by "${tag}".`,
        },
      },
    ]),
  ) as TypeSafeQuestions
}

const typeSafeNoulAnswerSchema = z
  .object({
    type: z.literal('noul'),
    noul: z.number().finite().min(0).max(1),
  })
  .strict()

const typeSafeResponseSchema = z
  .object({
    model: z.string().min(1),
    answers: z.record(z.string(), typeSafeNoulAnswerSchema),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export function validateTypeSafeResponse(
  value: unknown,
  questionIds: readonly string[],
): TypeSafeResponse | null {
  const parsed = typeSafeResponseSchema.safeParse(value)
  if (!parsed.success) return null

  const answerIds = Object.keys(parsed.data.answers)
  if (
    answerIds.length !== questionIds.length ||
    questionIds.some((questionId) => !Object.hasOwn(parsed.data.answers, questionId))
  ) {
    return null
  }

  return parsed.data
}

export function classifyTypeSafeProbabilities(
  probabilities: Record<string, number>,
  thresholds: TypeSafeThresholds = TYPE_SAFE_TAG_THRESHOLDS,
  taxonomy: readonly RecipeTag[] = RECIPE_TAG_TAXONOMY,
): TypeSafeDecision {
  if (thresholds.reject >= thresholds.accept) {
    throw new Error('TypeSafe reject threshold must be lower than the accept threshold')
  }

  const accepted: Array<{ tag: RecipeTag; probability: number; index: number }> = []
  const uncertain: Array<{ tag: RecipeTag; index: number }> = []

  taxonomy.forEach((tag, index) => {
    const probability = probabilities[tag]
    if (typeof probability !== 'number') return
    if (probability >= thresholds.accept) {
      accepted.push({ tag, probability, index })
    } else if (probability > thresholds.reject) {
      uncertain.push({ tag, index })
    }
  })

  accepted.sort((a, b) => b.probability - a.probability || a.index - b.index)
  uncertain.sort((a, b) => a.index - b.index)

  const tags = accepted.slice(0, TYPE_SAFE_MAX_ACCEPTED_TAGS).map(({ tag }) => tag)
  const uncertainTags = uncertain.map(({ tag }) => tag)

  return {
    status: tags.length > 0 ? 'matched' : uncertainTags.length > 0 ? 'uncertain' : 'no_match',
    tags,
    uncertainTags,
  }
}

export function interpretTypeSafeResponse(
  response: TypeSafeResponse,
  taxonomy: readonly RecipeTag[] = RECIPE_TAG_TAXONOMY,
): Extract<TypeSafeTaggingResult, { source: 'typesafe' }> {
  const probabilities: Record<string, number> = {}

  taxonomy.forEach((tag, index) => {
    const answer = response.answers[`tag_${String(index).padStart(2, '0')}`]
    const probability = answer?.noul
    if (typeof probability !== 'number') return

    probabilities[tag] = probability
  })

  const decision = classifyTypeSafeProbabilities(probabilities)

  return {
    source: 'typesafe',
    ...decision,
    probabilities,
    usage: response.usage,
    model: response.model,
  }
}

export function projectTagsToRecipeTaxonomy(tags: readonly string[]): RecipeTag[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter(isRecipeTag),
    ),
  )
}
