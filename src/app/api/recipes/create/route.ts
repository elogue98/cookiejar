import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { generateTagsForRecipe } from '@/lib/aiTagging'

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
  try {
    const body = await req.json()
    const { title, ingredients, instructions, tags, rating, notes, userId } = body

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
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
      aiTags = await generateTagsForRecipe({
        title: title.trim(),
        ingredients: ingredients || [],
        instructions: instructions || '',
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
      const ratingNum = typeof rating === 'string' ? parseInt(rating, 10) : Number(rating)
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
        return NextResponse.json(
          { success: false, error: 'Rating must be a number between 1 and 10' },
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
