import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { uploadOptimizedImage } from '@/lib/imageOptimization'

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
    const { title, ingredients, instructions, tags, cookbookSource, metadataNotes, imageBuffer, imageMimeType } = body

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

    // Prepare recipe data
    const recipeData = {
      title: title.trim(),
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      instructions: instructions || null,
      tags: Array.isArray(tags) ? tags : [],
      cookbooksource: cookbookSource && cookbookSource.trim() ? cookbookSource.trim() : null,
      notes: metadataNotes && typeof metadataNotes === 'string' && metadataNotes.trim() ? metadataNotes.trim() : null,
    }

    // Insert into Supabase
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('recipes')
      .insert(recipeData)
      .select()
      .single()

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

