import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'

/**
 * DELETE /api/recipes/[id]/delete
 * 
 * Deletes a recipe from the database and removes its image from storage.
 * 
 * Steps:
 * 1. Fetch recipe to get image_url/storage path
 * 2. Delete DB row from recipes table
 * 3. Delete image from Storage if exists
 * 
 * Returns: { success: boolean, error?: string }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recipe ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Step 1: Fetch recipe to get image_url
    const { data: recipe, error: fetchError } = await supabase
      .from('recipes')
      .select('id, image_url')
      .eq('id', id)
      .single()

    if (fetchError || !recipe) {
      return NextResponse.json(
        { success: false, error: 'Recipe not found' },
        { status: 404 }
      )
    }

    // Step 2: Delete image from Storage if it exists
    // The image path format is: recipes/{id}.jpg
    const imagePath = `recipes/${id}.jpg`
    
    try {
      const { error: storageError } = await supabase.storage
        .from('recipe-images')
        .remove([imagePath])

      // Log storage errors but don't fail the request if image doesn't exist
      if (storageError) {
        console.warn('Error deleting image from storage (may not exist):', storageError.message)
        // Continue with DB deletion even if image deletion fails
      }
    } catch (storageErr) {
      console.warn('Unexpected error deleting image:', storageErr)
      // Continue with DB deletion
    }

    // Step 3: Delete DB row
    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Supabase delete error:', deleteError)
      return NextResponse.json(
        { success: false, error: `Database error: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true },
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

