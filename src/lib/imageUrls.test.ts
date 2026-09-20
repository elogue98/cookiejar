import { describe, expect, it, vi } from 'vitest'

import { createSignedRecipeImageUrl } from './imageUrls'

describe('createSignedRecipeImageUrl', () => {
  it('returns a one-hour signed URL for a stored recipe image path', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/recipe.jpg' },
      error: null,
    })
    const client = { storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }

    await expect(createSignedRecipeImageUrl(client as never, 'recipes/recipe-1-optimized.jpg'))
      .resolves.toBe('https://signed.example/recipe.jpg')
    expect(createSignedUrl).toHaveBeenCalledWith('recipes/recipe-1-optimized.jpg', 60 * 60)
  })

  it('signs legacy GIF paths that were backfilled into private storage', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/legacy.gif' },
      error: null,
    })
    const client = { storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }

    await expect(createSignedRecipeImageUrl(client as never, 'recipes/legacy.gif'))
      .resolves.toBe('https://signed.example/legacy.gif')
  })

  it('does not sign arbitrary public URLs', async () => {
    const client = { storage: { from: vi.fn() } }

    await expect(createSignedRecipeImageUrl(client as never, 'https://attacker.example/image.jpg'))
      .rejects.toThrow('Invalid recipe image path')
    await expect(createSignedRecipeImageUrl(client as never, 'recipes/nested/image.jpg'))
      .rejects.toThrow('Invalid recipe image path')
    expect(client.storage.from).not.toHaveBeenCalled()
  })
})
