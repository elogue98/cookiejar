import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'

/**
 * PUT /api/recipes/[id]
 * 
 * Updates an existing recipe in the Supabase recipes table.
 * 
 * Body: { title, ingredients, instructions, tags, rating, notes }
 * Returns: { success: boolean, data?: Recipe, error?: string }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Parse request body
    const body = await req.json()
    const { title, ingredients, instructions, tags, rating, notes, source_url, cookbookSource } = body

    // Get Supabase client
    const supabase = createServerClient()

    // For partial updates (e.g., rating only), fetch existing recipe first
    let existingRecipe = null
    if (!title) {
      const { data: existing, error: fetchError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !existing) {
        return NextResponse.json(
          { success: false, error: 'Recipe not found' },
          { status: 404 }
        )
      }
      existingRecipe = existing
    }

    // Validate title if provided
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Title cannot be empty' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: {
      title?: string
      ingredients?: string[]
      instructions?: string | null
      tags?: string[]
      rating?: number | null
      notes?: string | null
      source_url?: string | null
      cookbooksource?: string | null
    } = {}

    // Only include title if provided
    if (title !== undefined) {
      updateData.title = title.trim()
    }

    // Handle ingredients - convert string to array if needed
    if (ingredients !== undefined) {
      if (typeof ingredients === 'string') {
        updateData.ingredients = ingredients
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
      } else if (Array.isArray(ingredients)) {
        updateData.ingredients = ingredients
      } else {
        updateData.ingredients = []
      }
    }

    // Handle instructions
    if (instructions !== undefined) {
      updateData.instructions = instructions && typeof instructions === 'string' 
        ? instructions.trim() || null 
        : null
    }

    // Handle tags - convert comma-separated string to array if needed
    if (tags !== undefined) {
      if (typeof tags === 'string') {
        updateData.tags = tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      } else if (Array.isArray(tags)) {
        updateData.tags = tags
      } else {
        updateData.tags = []
      }
    }

    // Handle rating - validate it's between 1-10
    if (rating !== undefined) {
      if (rating === null || rating === '') {
        updateData.rating = null
      } else {
        const ratingNum = typeof rating === 'string' ? parseInt(rating, 10) : rating
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
          return NextResponse.json(
            { success: false, error: 'Rating must be a number between 1 and 10' },
            { status: 400 }
          )
        }
        updateData.rating = ratingNum
      }
    }

    // Handle notes
    if (notes !== undefined) {
      updateData.notes = notes && typeof notes === 'string' 
        ? notes.trim() || null 
        : null
    }

    // Handle source_url
    if (source_url !== undefined) {
      updateData.source_url = source_url && typeof source_url === 'string' 
        ? source_url.trim() || null 
        : null
    }

    // Handle cookbookSource (database column is lowercase: cookbooksource)
    if (cookbookSource !== undefined) {
      updateData.cookbooksource = cookbookSource && typeof cookbookSource === 'string' 
        ? cookbookSource.trim() || null 
        : null
    }

    // Ensure at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update in Supabase using server client (bypasses RLS)
    const { data, error } = await supabase
      .from('recipes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Recipe not found' },
        { status: 404 }
      )
    }

    // Return the updated record
    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

