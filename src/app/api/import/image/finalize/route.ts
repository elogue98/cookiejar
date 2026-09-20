import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import { createSignedRecipeImageUrl } from '@/lib/imageUrls'
import { toRecipeResponse } from '@/lib/recipeResponses'
import { validateUploadedImage } from '@/lib/imageValidation'
import { apiErrorResponse } from '@/lib/apiErrors'
import {
  normalizeIngredientSections,
  normalizeInstructionSections,
} from '@/lib/recipeFormatting'
import {
  assertRequestContentLength,
  imageFinalizeRequestSchema,
  MAX_BASE64_IMAGE_CHARS,
  MAX_IMAGE_FINALIZE_BODY_BYTES,
  parseJsonRequest,
} from '@/lib/validation'

type NormalizedIngredients = Awaited<ReturnType<typeof normalizeIngredientSections>>
type NormalizedInstructions = ReturnType<typeof normalizeInstructionSections>

type RecipeInsertPayload = {
  title: string
  ingredients: NormalizedIngredients
  instructions: NormalizedInstructions
  tags: string[]
  cookbooksource: string | null
  notes: string | null
  // Metadata fields
  servings?: number | null
  prep_time?: string | null
  cook_time?: string | null
  total_time?: string | null
  cuisine?: string | null
  meal_type?: string | null
  // Nutrition (per serving)
  calories?: number | null
  protein_grams?: number | null
  fat_grams?: number | null
  carbs_grams?: number | null
}

/**
 * POST /api/import/image/finalize
 * 
 * Finalizes an image import by creating the recipe with optional cookbook source
 * and uploading the optimized image.
 * 
 * Body: {
 *   title: string
 *   ingredients: string[]
 *   instructions: string
 *   tags: string[]
 *   cookbookSource?: string | null
 *   metadataNotes?: string | null (JSON string with metadata)
 *   imageBuffer: string (base64)
 *   imageMimeType: string
 * }
 * Returns: { success: boolean, data?: Recipe, error?: string }
 */
export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const profileId = auth.profile!.profileId
  const rateLimitError = await checkApiRateLimit(profileId, 'imports', RATE_LIMITS.imports)
  if (rateLimitError) return rateLimitError

  try {
    assertRequestContentLength(req, MAX_IMAGE_FINALIZE_BODY_BYTES)
    const body = await parseJsonRequest(req, imageFinalizeRequestSchema, MAX_IMAGE_FINALIZE_BODY_BYTES)
    const {
      title,
      ingredients,
      instructions,
      tags,
      cookbookSource,
      imageBuffer,
      imageMimeType,
      ingredientSections,
      instructionSections,
      // Metadata fields
      servings,
      prepTime,
      cookTime,
      totalTime,
      cuisine,
      mealType,
      nutrition,
      description,
    } = body

    console.log('[Image Finalize] Received metadata:', {
      servings,
      prepTime,
      cookTime,
      totalTime,
      cuisine,
      mealType,
      nutrition,
      description,
    })

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    if (!imageBuffer || !imageMimeType) {
      return NextResponse.json(
        { success: false, error: 'Image data is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    if (imageBuffer.length > MAX_BASE64_IMAGE_CHARS || !isCanonicalBase64(imageBuffer)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image data', code: 'INVALID_IMAGE' },
        { status: 400 },
      )
    }

    try {
      await validateUploadedImage(Buffer.from(imageBuffer, 'base64'), imageMimeType)
    } catch (error) {
      const tooLarge = error instanceof Error && /too large/i.test(error.message)
      return NextResponse.json(
        { success: false, error: tooLarge ? 'Image is too large' : 'Invalid image', code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_IMAGE' },
        { status: tooLarge ? 413 : 400 },
      )
    }

    // Normalize ingredients/instructions before storing
    const normalizedIngredients =
      Array.isArray(ingredientSections) && ingredientSections.length > 0
        ? await normalizeIngredientSections(ingredientSections)
        : await normalizeIngredientSections([
            {
              section: '',
              items: Array.isArray(ingredients) ? ingredients : [],
            },
          ])

    const fallbackInstructionSteps =
      typeof instructions === 'string'
        ? instructions
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
        : Array.isArray(instructions)
        ? instructions
        : []

    const normalizedInstructions =
      Array.isArray(instructionSections) && instructionSections.length > 0
        ? normalizeInstructionSections(instructionSections)
        : normalizeInstructionSections([
            {
              section: '',
              steps: fallbackInstructionSteps,
            },
          ])

    // Prepare recipe data
    const recipeData: RecipeInsertPayload = {
      title: title.trim(),
      ingredients: normalizedIngredients,
      instructions: normalizedInstructions,
      tags: Array.isArray(tags) ? tags : [],
      cookbooksource: cookbookSource && cookbookSource.trim() ? cookbookSource.trim() : null,
      notes: description?.trim() || null,
      // Metadata fields
      servings: servings || null,
      prep_time: prepTime || null,
      cook_time: cookTime || null,
      total_time: totalTime || null,
      cuisine: cuisine || null,
      meal_type: mealType || null,
      // Nutrition (per serving)
      calories: nutrition?.calories || null,
      protein_grams: nutrition?.protein || null,
      fat_grams: nutrition?.fat || null,
      carbs_grams: nutrition?.carbs || null,
    }

    console.log('[Image Finalize] Prepared recipe data for insert:', {
      servings: recipeData.servings,
      prep_time: recipeData.prep_time,
      cook_time: recipeData.cook_time,
      calories: recipeData.calories,
      protein_grams: recipeData.protein_grams,
      fat_grams: recipeData.fat_grams,
      carbs_grams: recipeData.carbs_grams,
    })

    // Insert into Supabase
    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('recipes')
      .insert({ ...recipeData, created_by: profileId })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert failed', { code: error.code })
      return NextResponse.json(
        { success: false, error: 'Could not save imported recipe', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    // Upload the optimized image to Supabase storage
    let finalImageUrl: string | null = null
    if (data.id) {
      try {
        // Convert base64 back to buffer
        const buffer = Buffer.from(imageBuffer, 'base64')

        // Determine original file extension
        let extension = 'jpg'
        if (imageMimeType.includes('png')) {
          extension = 'png'
        } else if (imageMimeType.includes('webp')) {
          extension = 'webp'
        } else if (imageMimeType.includes('jpeg') || imageMimeType.includes('jpg')) {
          extension = 'jpg'
        }

        // Upload optimized image (utility handles optimization and cleanup)
        finalImageUrl = await uploadOptimizedImage(supabase, buffer, data.id, extension, imageMimeType)

        if (finalImageUrl) {
          const { error: updateError } = await supabase
            .from('recipes')
            .update({ image_path: finalImageUrl })
            .eq('id', data.id)

          if (!updateError) {
            data.image_path = finalImageUrl
            data.image_url = await createSignedRecipeImageUrl(supabase, finalImageUrl)
          }
        }
      } catch (imageError) {
        console.error('Error uploading recipe image:', imageError)
        // Don't fail the request if image upload fails
      }
    }

    return NextResponse.json(
      { success: true, data: await toRecipeResponse(supabase, data as Record<string, unknown>) },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return apiErrorResponse(error)
  }
}

function isCanonicalBase64(value: string): boolean {
  return value.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
}
