import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { ApiError, apiErrorResponse } from '@/lib/apiErrors'

/**
 * DELETE /api/recipes/[id]/delete
 * 
 * Deletes a recipe from the database and removes its image from storage.
 * 
 * Steps:
 * 1. Fetch recipe to get the private storage path
 * 2. Delete DB row from recipes table
 * 3. Delete image from Storage if exists
 * 
 * Returns: { success: boolean, error?: string }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const rateLimitError = await checkApiRateLimit(auth.profile!.profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recipe ID is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Step 1: Fetch recipe to get the private storage path
    const { data: recipe, error: fetchError } = await supabase
      .from('recipes')
      .select('id, image_path')
      .eq('id', id)
      .single()

    if (fetchError || !recipe) {
      return NextResponse.json(
        { success: false, error: 'Recipe not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Step 2: Delete the stored image only when the path matches the app's
    // controlled namespace. Never turn arbitrary database content into a path.
    const imagePath = typeof recipe.image_path === 'string' && /^recipes\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(recipe.image_path)
      ? recipe.image_path
      : null
    
    try {
      if (!imagePath) {
        // Legacy rows may not have a private image path yet.
      } else {
      const { error: storageError } = await supabase.storage
        .from('recipe-images')
        .remove([imagePath])

      // Log storage errors but don't fail the request if image doesn't exist
      if (storageError) {
        console.warn('Error deleting image from storage (may not exist):', storageError.message)
        // Continue with DB deletion even if image deletion fails
      }
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
        { success: false, error: 'Could not delete recipe', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return apiErrorResponse(error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Could not delete recipe'))
  }
}
