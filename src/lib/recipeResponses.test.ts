import { describe, expect, it, vi } from 'vitest'

import { toRecipeResponse } from './recipeResponses'

describe('toRecipeResponse', () => {
  it('never returns a legacy public URL and returns a signed URL for a private path', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/recipe.jpg' },
      error: null,
    })
    const supabase = { storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }

    await expect(toRecipeResponse(supabase, {
      id: 'recipe-1',
      image_path: 'recipes/recipe-1-optimized.jpg',
      image_url: 'https://public.example/old.jpg',
    })).resolves.toMatchObject({
      image_path: 'recipes/recipe-1-optimized.jpg',
      imageUrl: 'https://signed.example/recipe.jpg',
      image_url: 'https://signed.example/recipe.jpg',
    })
    expect(createSignedUrl).toHaveBeenCalledWith('recipes/recipe-1-optimized.jpg', 3600)
  })

  it('returns null image fields when a recipe has no private image path', async () => {
    await expect(toRecipeResponse({ storage: { from: vi.fn() } }, {
      id: 'recipe-1',
      image_url: 'https://public.example/old.jpg',
    })).resolves.toMatchObject({ image_path: null, imageUrl: null, image_url: null })
  })
})
