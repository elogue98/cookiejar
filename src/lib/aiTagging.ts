import { aiComplete } from '@/lib/ai'
import { TAGS_JSON_SCHEMA, tagsOutputSchema } from './aiSchemas'
import {
  RECIPE_TAG_CUISINES,
  RECIPE_TAG_DIETARY,
  RECIPE_TAG_MAIN_INGREDIENTS,
  RECIPE_TAG_METHODS,
} from './recipeTagTaxonomy'

/**
 * Input type for AI tagging function
 */
export type TagInput = {
  title: string
  ingredients?: string[] | string
  instructions?: string
}

/**
 * Free fallback: Generates basic tags from keywords in title and ingredients
 * This is used when OpenAI API key is not available
 */
export function generateKeywordTagsForRecipe(input: TagInput): string[] {
  const tags: Set<string> = new Set()
  const title = input.title.toLowerCase()

  // Common cuisine keywords
  const cuisines = RECIPE_TAG_CUISINES

  // Common cooking methods
  const methods = RECIPE_TAG_METHODS

  // Common dietary tags
  const dietary = RECIPE_TAG_DIETARY

  // Extract main ingredients from title (common proteins, vegetables, etc.)
  const mainIngredients = RECIPE_TAG_MAIN_INGREDIENTS

  // Check title for keywords
  const allKeywords = [...cuisines, ...methods, ...dietary, ...mainIngredients]
  for (const keyword of allKeywords) {
    if (title.includes(keyword)) {
      tags.add(keyword)
    }
  }

  // Extract from ingredients if available
  if (input.ingredients) {
    const ingredientsText = Array.isArray(input.ingredients)
      ? input.ingredients.join(' ').toLowerCase()
      : input.ingredients.toLowerCase()

    // Look for common ingredient keywords
    for (const keyword of mainIngredients) {
      if (ingredientsText.includes(keyword) && !tags.has(keyword)) {
        tags.add(keyword)
      }
    }

    // Check for dietary indicators
    if (ingredientsText.includes('tofu') || ingredientsText.includes('tempeh')) {
      tags.add('vegetarian')
    }
    const hasMeat = ingredientsText.includes('meat') || ingredientsText.includes('chicken')
    const hasVegetables = ingredientsText.includes('vegetable') || ingredientsText.includes('veggie')
    if (!hasMeat && hasVegetables) {
      tags.add('vegetarian')
    }
  }

  // Time-based tags (simple heuristics)
  if (input.instructions) {
    const instructions = input.instructions.toLowerCase()
    if (instructions.includes('quick') || instructions.includes('fast') || instructions.includes('5 minute') || instructions.includes('10 minute')) {
      tags.add('quick')
    }
    if (instructions.includes('slow') || instructions.includes('overnight') || instructions.includes('marinate')) {
      tags.add('slow-cooked')
    }
  }

  // Convert to array, limit to 8 tags
  return Array.from(tags)
    .filter((tag) => tag.length > 0)
    .slice(0, 8)
}

/**
 * Generates relevant tags for a recipe using OpenAI API
 * Falls back to free keyword-based tagging if API key is not available
 * 
 * @param input - Recipe data (title, ingredients, instructions)
 * @returns Array of lowercase tags (3-8 tags)
 * @throws Never throws - returns fallback tags or empty array on error
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

type GenerateTagsOptions = {
  fallbackOnError?: boolean
}

type CurrentTaggingEvaluationResult =
  | { source: 'openai'; tags: string[] }
  | { source: 'unavailable'; reason: 'missing_key' | 'invalid_input' | 'invalid_response' | 'transport_error' }

class StrictTaggingError extends Error {
  constructor(
    readonly reason: Extract<CurrentTaggingEvaluationResult, { source: 'unavailable' }>['reason'],
    message: string,
  ) {
    super(message)
    this.name = 'StrictTaggingError'
  }
}

export async function generateTagsForRecipe(
  input: TagInput,
  options: GenerateTagsOptions = {},
): Promise<string[]> {
  const fallbackOnError = options.fallbackOnError !== false

  // Validate input
  if (!input.title || input.title.trim().length === 0) {
    console.warn('Empty title provided to generateTagsForRecipe')
    return []
  }

  // Validate API key
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    if (!fallbackOnError) {
      throw new StrictTaggingError('missing_key', 'OPENAI_API_KEY is required for strict tag evaluation')
    }
    console.warn('OPENAI_API_KEY not set, using free keyword-based tagging')
    return generateKeywordTagsForRecipe(input)
  }

  try {
    // Prepare ingredients text
    let ingredientsText = ''
    if (input.ingredients) {
      if (Array.isArray(input.ingredients)) {
        ingredientsText = input.ingredients.join(', ')
      } else {
        ingredientsText = input.ingredients
      }
    }

    // Prepare instructions text (truncate if too long)
    let instructionsText = input.instructions || ''
    if (instructionsText.length > 500) {
      instructionsText = instructionsText.substring(0, 500) + '...'
    }

    // Build prompt
    const prompt = `You are a recipe tagging assistant. Analyze the following recipe and generate 3-8 short, lowercase tags that would help users find and categorize this recipe.

Tags should be:
- Single words or short phrases (max 2 words)
- Lowercase
- Relevant to cuisine type, main ingredients, cooking method, dietary restrictions, or time (e.g. "chicken", "italian", "pasta", "30-minute", "vegetarian")
- No duplicates
- No explanations or extra text

Recipe Title: ${input.title}
${ingredientsText ? `Ingredients: ${ingredientsText}` : ''}
${instructionsText ? `Instructions: ${instructionsText.substring(0, 300)}` : ''}

Return a JSON object with a "tags" property containing an array of tags. Example: {"tags": ["chicken", "italian", "pasta"]}`

    // Call OpenAI API using central helper
    const content = await aiComplete(
      [
        {
          role: 'system',
          content: 'You are a helpful recipe tagging assistant. Always return a JSON object with a "tags" array property.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      {
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 150, // Enough for 3-8 tags
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'recipe_tags', strict: true, schema: TAGS_JSON_SCHEMA },
        },
      }
    )
    if (!content) {
      if (!fallbackOnError) throw new StrictTaggingError('invalid_response', 'OpenAI returned an empty tag response')
      console.warn('Empty response from OpenAI')
      return []
    }

    // Parse and validate the complete structured output before using any tags.
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      if (!fallbackOnError) throw new StrictTaggingError('invalid_response', 'OpenAI returned invalid tag JSON')
      console.warn('Failed to parse OpenAI response as JSON, using keyword fallback')
      return generateKeywordTagsForRecipe(input)
    }

    const validated = tagsOutputSchema.safeParse(parsed)
    if (!validated.success) {
      if (!fallbackOnError) throw new StrictTaggingError('invalid_response', 'OpenAI returned an invalid tag payload')
      return generateKeywordTagsForRecipe(input)
    }

    // Clean and validate tags
    const cleanedTags = validated.data.tags
      .map((tag) => {
        // Convert to lowercase, trim, remove extra spaces
        let cleaned = tag.toLowerCase().trim().replace(/\s+/g, ' ')
        // Remove quotes if present
        cleaned = cleaned.replace(/^["']|["']$/g, '')
        return cleaned
      })
      .filter((tag): tag is string => {
        // Filter out invalid tags
        if (!tag || tag.length === 0) {
          return false
        }
        // Max 2 words
        if (tag.split(/\s+/).length > 2) {
          return false
        }
        // Max 30 characters per tag
        if (tag.length > 30) {
          return false
        }
        return true
      })
      // Remove duplicates
      .filter((tag, index, array) => array.indexOf(tag) === index)
      // Limit to 8 tags
      .slice(0, 8)

    // Ensure minimum 3 tags if we have enough data
    if (cleanedTags.length < 3 && (ingredientsText || instructionsText)) {
      // If we got fewer than 3 tags but have recipe data, this might be an issue
      // But we'll return what we have rather than failing
      console.warn(`Only generated ${cleanedTags.length} tags, expected 3-8`)
    }

    return cleanedTags
  } catch (error: unknown) {
    if (!fallbackOnError) throw error

    // Handle specific error types
    if (error instanceof Error && error.message.includes('429')) {
      // Quota exceeded - silently fall back to free tagging
      console.warn('OpenAI quota exceeded, using free keyword-based tagging')
      return generateKeywordTagsForRecipe(input)
    }
    
    // Other errors - log but don't throw - fall back to free keyword-based tagging
    const message =
      error instanceof Error
        ? error.message
        : isRecord(error) && typeof error.message === 'string'
          ? error.message
          : String(error)
    console.error('Error generating AI tags, falling back to keyword-based tagging:', message)
    return generateKeywordTagsForRecipe(input)
  }
}

export async function generateTagsForRecipeForEvaluation(
  input: TagInput,
): Promise<CurrentTaggingEvaluationResult> {
  if (!input.title || input.title.trim().length === 0) {
    return { source: 'unavailable', reason: 'invalid_input' }
  }
  if (!process.env.OPENAI_API_KEY) {
    return { source: 'unavailable', reason: 'missing_key' }
  }

  try {
    return {
      source: 'openai',
      tags: await generateTagsForRecipe(input, { fallbackOnError: false }),
    }
  } catch (error: unknown) {
    if (error instanceof StrictTaggingError) {
      return { source: 'unavailable', reason: error.reason }
    }
    return { source: 'unavailable', reason: 'transport_error' }
  }
}
