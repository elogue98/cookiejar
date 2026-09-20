import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { apiErrorResponse } from '@/lib/apiErrors'
import { parseJsonRequest, recipeCreateRequestSchema } from '@/lib/validation'
import { generateTagsForRecipe } from '@/lib/aiTagging'
import { toRecipeResponse } from '@/lib/recipeResponses'

/**
 * POST /api/recipes/create
 * 
 * Creates a new recipe with AI-generated tags.
 * Combines user-provided tags with AI-generated tags.
 * 
 * Body: {
 *   title: string
 *   ingredients?: string[]
 *   instructions?: string
 *   tags?: string[] | string (comma-separated)
 *   rating?: number
 *   notes?: string
 * }
 * Returns: { success: boolean, data?: Recipe, error?: string }
 */
export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const profileId = auth.profile!.profileId
  const rateLimitError = await checkApiRateLimit(profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    const body = await parseJsonRequest(req, recipeCreateRequestSchema)
    const { title, ingredients, instructions, tags, rating, notes } = body

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    // Normalize user-provided tags
    let userTags: string[] = []
    if (tags) {
      if (typeof tags === 'string') {
        // Split by comma and clean
        userTags = tags
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0)
      } else if (Array.isArray(tags)) {
        userTags = tags
          .map((tag) => String(tag).trim().toLowerCase())
          .filter((tag) => tag.length > 0)
      }
    }

    // Generate AI tags
    let aiTags: string[] = []
    try {
      const tagIngredients = typeof ingredients === 'string'
        ? ingredients
        : Array.isArray(ingredients)
          ? ingredients.flatMap((item) => typeof item === 'string' ? [item] : item.items)
          : []
      aiTags = await generateTagsForRecipe({
        title: title.trim(),
        ingredients: tagIngredients,
        instructions: typeof instructions === 'string' ? instructions : JSON.stringify(instructions || []),
      })
    } catch (error) {
      // Log but don't fail - continue with user tags only
      console.error('Error generating AI tags:', error)
    }

    // Combine and deduplicate tags
    const allTags = [...userTags, ...aiTags]
    const uniqueTags = Array.from(new Set(allTags)).filter((tag) => tag.length > 0)

    // Validate rating if provided
    let validatedRating: number | null = null
    if (rating !== undefined && rating !== null) {
      const ratingNum = Number(rating)
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
        return NextResponse.json(
          { success: false, error: 'Rating must be a number between 1 and 10', code: 'INVALID_REQUEST' },
          { status: 400 }
        )
      }
      validatedRating = ratingNum
    }

    // Prepare recipe data
    const recipeData = {
      title: title.trim(),
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      instructions: instructions || null,
      tags: uniqueTags,
      rating: validatedRating,
      notes: notes || null,
    }

    // Insert into Supabase
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('recipes')
      .insert({ ...recipeData, created_by: profileId })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { success: false, error: 'Could not create recipe', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: await toRecipeResponse(supabase, data as Record<string, unknown>) },
      { status: 201 }
    )
  } catch (error) {
    return apiErrorResponse(error)
  }
}
