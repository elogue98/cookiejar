import { z } from 'zod'

import { ApiError } from './apiErrors'
import { httpUrlSchema } from './urlValidation'

export { httpUrlSchema } from './urlValidation'

export const MAX_HTML_BYTES = 2 * 1024 * 1024
export const MAX_AI_TEXT_CHARS = 200_000
export const MAX_CHAT_MESSAGES = 20
export const MAX_CHAT_MESSAGE_CHARS = 4_000
export const MAX_CHAT_TOTAL_CHARS = 40_000
export const MAX_BASE64_IMAGE_CHARS = Math.ceil((10 * 1024 * 1024 * 4) / 3) + 32
export const MAX_IMAGE_FINALIZE_BODY_BYTES = 16 * 1024 * 1024
export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024

const text = (max: number) => z.string().trim().max(max)
const numericText = text(100).refine(
  (value) => /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value),
  'Must be a finite decimal number',
)
const ingredientGroupSchema = z.object({
  section: text(200),
  items: z.array(text(500)).max(100),
}).strict()
const instructionGroupSchema = z.object({
  section: text(200),
  steps: z.array(text(2_000)).max(100),
}).strict()

const ingredientsSchema = z.union([
  z.array(text(500)).max(200),
  z.array(ingredientGroupSchema).max(100),
  text(100_000),
]).nullable().optional()

const instructionsSchema = z.union([
  z.array(text(2_000)).max(200),
  z.array(instructionGroupSchema).max(100),
  text(100_000),
]).nullable().optional()

const tagsSchema = z.array(text(50)).max(30).nullable().optional()

function countText(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (Array.isArray(value)) return value.reduce((total, entry) => total + countText(entry), 0)
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((total, entry) => total + countText(entry), 0)
  }
  return 0
}

function addRecipeTextBudgetIssue(value: {
  title?: unknown
  recipeTitle?: unknown
  ingredients?: unknown
  instructions?: unknown
  tags?: unknown
  notes?: unknown
  userMessage?: unknown
  messageHistory?: unknown
}, context: z.RefinementCtx) {
  const recipeText = countText(value.title ?? value.recipeTitle) +
    countText(value.ingredients) +
    countText(value.instructions) +
    countText(value.tags) +
    countText(value.notes)
  const chatText = countText(value.userMessage) + countText(value.messageHistory)

  if (recipeText + chatText > MAX_AI_TEXT_CHARS) {
    context.addIssue({ code: 'custom', path: ['instructions'], message: 'Recipe content is too large' })
  }
}

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: text(MAX_CHAT_MESSAGE_CHARS),
}).strict()

const chatFields = {
  recipeTitle: text(300),
  ingredients: z.array(ingredientGroupSchema).max(100).nullable(),
  instructions: z.array(instructionGroupSchema).max(100).nullable(),
  tags: tagsSchema,
  userMessage: text(MAX_CHAT_MESSAGE_CHARS),
  messageHistory: z.array(chatMessageSchema).max(MAX_CHAT_MESSAGES),
}

export const assistantRequestSchema = z.object(chatFields).strict().superRefine((value, context) => {
  const total = value.userMessage.length + value.messageHistory.reduce((sum, message) => sum + message.content.length, 0)
  if (total > MAX_CHAT_TOTAL_CHARS) {
    context.addIssue({ code: 'custom', path: ['messageHistory'], message: 'Chat history is too large' })
  }
  addRecipeTextBudgetIssue(value, context)
})

export const recipeMutationRequestSchema = z.object({
  recipeId: text(100),
  ...chatFields,
}).strict().superRefine((value, context) => {
  const total = value.userMessage.length + value.messageHistory.reduce((sum, message) => sum + message.content.length, 0)
  if (total > MAX_CHAT_TOTAL_CHARS) {
    context.addIssue({ code: 'custom', path: ['messageHistory'], message: 'Chat history is too large' })
  }
  addRecipeTextBudgetIssue(value, context)
})

export const mutatedRecipeSchema = z.object({
  title: text(300).min(1),
  ingredients: z.array(ingredientGroupSchema).max(100),
  instructions: z.array(instructionGroupSchema).max(100),
  tags: z.array(text(50)).max(30),
}).strict()

export const MUTATED_RECIPE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
        required: ['section', 'items'],
      },
    },
    instructions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['section', 'steps'],
      },
    },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'ingredients', 'instructions', 'tags'],
} as const

export const recipeCreateRequestSchema = z.object({
  title: text(300).min(1),
  ingredients: ingredientsSchema,
  instructions: instructionsSchema,
  tags: z.union([tagsSchema, text(2_000)]),
  rating: z.union([z.number().finite(), numericText]).optional(),
  notes: text(20_000).nullable().optional(),
}).strict().superRefine((value, context) => addRecipeTextBudgetIssue(value, context))

const nullableNumberOrString = z.union([z.number().finite(), numericText]).nullable().optional()

export const recipeUpdateRequestSchema = z.object({
  title: text(300).optional(),
  ingredients: ingredientsSchema,
  instructions: instructionsSchema,
  tags: z.union([tagsSchema, text(2_000)]),
  rating: nullableNumberOrString,
  notes: text(20_000).nullable().optional(),
  source_url: z.union([httpUrlSchema, z.literal('')]).nullable().optional(),
  cookbookSource: text(2_000).nullable().optional(),
  servings: nullableNumberOrString,
  prep_time: text(200).nullable().optional(),
  cook_time: text(200).nullable().optional(),
  total_time: text(200).nullable().optional(),
  cuisine: text(200).nullable().optional(),
  meal_type: text(200).nullable().optional(),
  calories: nullableNumberOrString,
  protein_grams: nullableNumberOrString,
  fat_grams: nullableNumberOrString,
  carbs_grams: nullableNumberOrString,
}).strict().superRefine((value, context) => addRecipeTextBudgetIssue(value, context))

export const commentRequestSchema = z.object({
  message: text(4_000).min(1),
}).strict()

export const ratingRequestSchema = z.object({
  rating: z.union([z.number().finite(), numericText]),
}).strict()

const finalizeIngredientSectionSchema = z.object({
  section: text(200).nullable().optional(),
  items: z.array(text(500)).max(200),
}).strict()

const finalizeInstructionSectionSchema = z.object({
  section: text(200).nullable().optional(),
  steps: z.array(text(2_000)).max(200),
}).strict()

const finalizeNutritionSchema = z.object({
  calories: z.number().finite().nonnegative().nullable().optional(),
  protein: z.number().finite().nonnegative().nullable().optional(),
  fat: z.number().finite().nonnegative().nullable().optional(),
  carbs: z.number().finite().nonnegative().nullable().optional(),
}).strict()

export const imageFinalizeRequestSchema = z.object({
  title: text(300).min(1),
  ingredients: z.union([z.array(text(500)).max(200), text(100_000)]).optional().nullable(),
  instructions: z.union([z.array(text(2_000)).max(200), text(100_000)]).optional().nullable(),
  tags: z.array(text(50)).max(30).optional().nullable(),
  cookbookSource: text(2_000).nullable().optional(),
  // Deprecated compatibility input. Older open clients may still send this,
  // but image finalization intentionally ignores it.
  metadataNotes: text(20_000).nullable().optional(),
  imageBuffer: z.string().min(4).max(MAX_BASE64_IMAGE_CHARS),
  imageMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  ingredientSections: z.array(finalizeIngredientSectionSchema).max(100).optional(),
  instructionSections: z.array(finalizeInstructionSectionSchema).max(100).optional(),
  servings: z.number().int().positive().max(100_000).nullable().optional(),
  prepTime: text(200).nullable().optional(),
  cookTime: text(200).nullable().optional(),
  totalTime: text(200).nullable().optional(),
  cuisine: text(200).nullable().optional(),
  mealType: text(200).nullable().optional(),
  nutrition: finalizeNutritionSchema.nullable().optional(),
  description: text(20_000).nullable().optional(),
}).strict()

export function parseJsonBody<T>(body: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, 'INVALID_REQUEST', 'Invalid request body')
  return parsed.data
}

async function readRequestBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError(400, 'INVALID_REQUEST', 'Request body is required')

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload is too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function parseFormDataRequest(request: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readRequestBytes(request, maxBytes)
  try {
    const body = new Blob([
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    ])
    const replayRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    })
    return await replayRequest.formData()
  } catch {
    throw new ApiError(400, 'INVALID_MULTIPART', 'Invalid multipart request')
  }
}

export async function parseJsonRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<T> {
  let raw: string
  try {
    raw = new TextDecoder().decode(await readRequestBytes(request, maxBytes))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON request body')
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON request body')
  }
  return parseJsonBody(body, schema)
}

export function assertTextLimit(value: string, limit: number, code = 'PAYLOAD_TOO_LARGE'): string {
  if (value.length > limit) throw new ApiError(413, code, 'Payload is too large')
  return value
}

export function assertRequestContentLength(request: Request, maxBytes: number): void {
  const rawLength = request.headers.get('content-length')
  if (!rawLength) return
  const length = Number(rawLength)
  if (Number.isFinite(length) && length > maxBytes) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Payload is too large')
  }
}
