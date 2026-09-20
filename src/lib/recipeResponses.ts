import { createSignedRecipeImageUrl, type SignedStorageClient } from './imageUrls'

type RecipeRecord = Record<string, unknown>

/**
 * Remove the legacy public image URL from API output and replace it with a
 * short-lived signed URL backed by the private image_path column.
 */
export async function toRecipeResponse(
  supabase: SignedStorageClient,
  recipe: RecipeRecord,
): Promise<RecipeRecord> {
  const safeRecipe = Object.fromEntries(
    Object.entries(recipe).filter(([key]) => key !== 'image_url'),
  ) as RecipeRecord
  const imagePath = typeof safeRecipe.image_path === 'string' ? safeRecipe.image_path : null
  let imageUrl: string | null = null

  if (imagePath) {
    try {
      imageUrl = await createSignedRecipeImageUrl(supabase, imagePath)
    } catch {
      imageUrl = null
    }
  }

  return {
    ...safeRecipe,
    image_path: imagePath,
    imageUrl,
    // Keep the existing app clients compatible while ensuring it is signed.
    image_url: imageUrl,
  }
}
