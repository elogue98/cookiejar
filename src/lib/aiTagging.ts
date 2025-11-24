import { aiComplete } from '@/lib/ai'

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
function generateFreeTags(input: TagInput): string[] {
  const tags: Set<string> = new Set()
  const title = input.title.toLowerCase()

  // Common cuisine keywords
  const cuisines = [
    'italian', 'chinese', 'japanese', 'indian', 'mexican', 'thai', 'french',
    'greek', 'mediterranean', 'american', 'korean', 'vietnamese', 'spanish',
    'italian', 'middle eastern', 'caribbean'
  ]

  // Common cooking methods
  const methods = [
    'baked', 'fried', 'grilled', 'roasted', 'steamed', 'boiled', 'braised',
    'slow-cooked', 'pressure-cooked', 'raw', 'marinated', 'smoked'
  ]

  // Common dietary tags
  const dietary = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo',
    'low-carb', 'high-protein', 'healthy', 'comfort-food'
  ]

  // Extract main ingredients from title (common proteins, vegetables, etc.)
  const mainIngredients = [
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'pasta', 'rice',
    'potato', 'tomato', 'cheese', 'bread', 'cake', 'cookie', 'soup', 'salad',
    'pizza', 'burger', 'sandwich', 'curry', 'stir-fry', 'casserole'
  ]

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

export async function generateTagsForRecipe(input: TagInput): Promise<string[]> {
  // Validate input
  if (!input.title || input.title.trim().length === 0) {
    console.warn('Empty title provided to generateTagsForRecipe')
    return []
  }

  // Validate API key
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set, using free keyword-based tagging')
    return generateFreeTags(input)
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
        response_format: { type: 'json_object' }, // Force JSON response
      }
    )
    if (!content) {
      console.warn('Empty response from OpenAI')
      return []
    }

    // Parse JSON response
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (parseError) {
      // Try to extract array if response is not valid JSON
      console.warn('Failed to parse OpenAI response as JSON, attempting fallback')
      // Fallback: try to extract array from text
      const arrayMatch = content.match(/\[[\s\S]*?\]/)
      if (arrayMatch) {
        try {
          parsed = JSON.parse(arrayMatch[0])
        } catch {
          return []
        }
      } else {
        return []
      }
    }

    // Extract tags from response
    // OpenAI might return { tags: [...] } or just [...]
    let tags: unknown[] = []
    if (Array.isArray(parsed)) {
      tags = parsed
    } else if (isRecord(parsed) && Array.isArray(parsed.tags)) {
      tags = parsed.tags
    } else if (isRecord(parsed)) {
      const arrayValue = Object.values(parsed).find((value): value is unknown[] =>
        Array.isArray(value)
      )
      if (arrayValue) {
        tags = arrayValue
      }
    }

    // Clean and validate tags
    const cleanedTags = tags
      .map((tag) => {
        if (typeof tag !== 'string') {
          return null
        }
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
    // Handle specific error types
    if (
      isRecord(error) &&
      (error.status === 429 || error.code === 'insufficient_quota')
    ) {
      // Quota exceeded - silently fall back to free tagging
      console.warn('OpenAI quota exceeded, using free keyword-based tagging')
      return generateFreeTags(input)
    }
    
    // Other errors - log but don't throw - fall back to free keyword-based tagging
    const message =
      error instanceof Error
        ? error.message
        : isRecord(error) && typeof error.message === 'string'
          ? error.message
          : String(error)
    console.error('Error generating AI tags, falling back to keyword-based tagging:', message)
    return generateFreeTags(input)
  }
}

