import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { generateTagsForRecipe } from '@/lib/aiTagging'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import { parseRecipe } from '@/app/api/recipes/import-from-url/route'

/**
 * POST /api/import/url
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required and must be a string' },
        { status: 400 }
      )
    }

    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    let html: string
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })

      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
          { status: response.status }
        )
      }

      html = await response.text()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Parse recipe
    const parsed = await parseRecipe(html, url)

    // Generate AI tags
    let aiTags: string[] = []
    try {
      const ingredientsForAI = Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0 && typeof parsed.ingredients[0] === 'object' && 'section' in parsed.ingredients[0]
        ? (parsed.ingredients as { section: string; items: string[] }[]).flatMap(g => g.items)
        : (parsed.ingredients as string[])
      
      aiTags = await generateTagsForRecipe({
        title: parsed.title,
        ingredients: ingredientsForAI,
        instructions: parsed.instructions.length > 0 ? parsed.instructions.join('\n\n') : '',
      })
    } catch (error) {
      console.error('Error generating AI tags for imported recipe:', error)
    }

    // Prepare data for Supabase
    const recipeData = {
      title: parsed.title,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions.length > 0 ? parsed.instructions.join('\n\n') : 'No instructions found',
      tags: aiTags,
      source_url: url,
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

    // Upload optimized image if available
    let finalImageUrl: string | null = null
    if (parsed.imageUrl && data.id) {
      try {
        const imageResponse = await fetch(parsed.imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        if (imageResponse.ok) {
          const imageArrayBuffer = await imageResponse.arrayBuffer()
          const imageBuffer = Buffer.from(imageArrayBuffer)
          
          // Determine original extension for cleanup
          let extension = 'jpg'
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
          
          if (contentType.includes('png')) {
            extension = 'png'
          } else if (contentType.includes('webp')) {
            extension = 'webp'
          } else if (contentType.includes('gif')) {
            extension = 'gif'
          } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            extension = 'jpg'
          } else {
            const urlLower = parsed.imageUrl.toLowerCase()
            if (urlLower.includes('.png')) {
              extension = 'png'
            } else if (urlLower.includes('.webp')) {
              extension = 'webp'
            } else if (urlLower.includes('.gif')) {
              extension = 'gif'
            }
          }
          
          // Upload optimized image (utility handles optimization and cleanup)
          finalImageUrl = await uploadOptimizedImage(supabase, imageBuffer, data.id, extension)

          if (finalImageUrl) {
            const { error: updateError } = await supabase
              .from('recipes')
              .update({ image_url: finalImageUrl })
              .eq('id', data.id)

            if (!updateError) {
              data.image_url = finalImageUrl
            }
          }
        }
      } catch (imageError) {
        console.error('Error processing recipe image:', imageError)
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

