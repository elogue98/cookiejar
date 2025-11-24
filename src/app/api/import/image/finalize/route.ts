import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import {
  normalizeIngredientSections,
  normalizeInstructionSections,
} from '@/lib/recipeFormatting'

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
  try {
    const body = await req.json()
    const {
      title,
      ingredients,
      instructions,
      tags,
      cookbookSource,
      metadataNotes,
      imageBuffer,
      imageMimeType,
      userId,
      ingredientSections,
      instructionSections,
    } = body

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!imageBuffer || !imageMimeType) {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
        { status: 400 }
      )
    }

    // Normalize ingredients/instructions before storing
    const normalizedIngredients =
      Array.isArray(ingredientSections) && ingredientSections.length > 0
        ? normalizeIngredientSections(ingredientSections)
        : normalizeIngredientSections([
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
    const recipeData: any = {
      title: title.trim(),
      ingredients: normalizedIngredients,
      instructions: normalizedInstructions,
      tags: Array.isArray(tags) ? tags : [],
      cookbooksource: cookbookSource && cookbookSource.trim() ? cookbookSource.trim() : null,
      notes: metadataNotes && typeof metadataNotes === 'string' && metadataNotes.trim() ? metadataNotes.trim() : null,
    }

    // Insert into Supabase
    const supabase = createServerClient()
    
    // Try to insert with created_by first, fallback without it if column doesn't exist
    let data, error
    if (userId && typeof userId === 'string') {
      // Try with created_by
      const result = await supabase
        .from('recipes')
        .insert({ ...recipeData, created_by: userId })
        .select()
        .single()
      
      data = result.data
      error = result.error
      
      // If error is about missing column, retry without created_by
      if (error && (error.message.includes('created_by') || error.message.includes('column') || error.code === '42703')) {
        const retryResult = await supabase
          .from('recipes')
          .insert(recipeData)
          .select()
          .single()
        
        data = retryResult.data
        error = retryResult.error
      }
    } else {
      // No userId, insert without created_by
      const result = await supabase
        .from('recipes')
        .insert(recipeData)
        .select()
        .single()
      
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
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
        finalImageUrl = await uploadOptimizedImage(supabase, buffer, data.id, extension)

        if (finalImageUrl) {
          const { error: updateError } = await supabase
            .from('recipes')
            .update({ image_url: finalImageUrl })
            .eq('id', data.id)

          if (!updateError) {
            data.image_url = finalImageUrl
          }
        }
      } catch (imageError) {
        console.error('Error uploading recipe image:', imageError)
        // Don't fail the request if image upload fails
      }
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

