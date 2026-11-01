import { describe, expect, it, vi } from 'vitest'

import { createSignedRecipeImageUrl, createSignedRecipeImageUrls } from './imageUrls'

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

describe('createSignedRecipeImageUrls', () => {
  it('signs a collection in one request, deduplicating and excluding invalid paths', async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({ data: [
      { path: 'recipes/a.jpg', signedUrl: 'https://signed.example/a', error: null },
      { path: 'recipes/b.gif', signedUrl: 'https://signed.example/b', error: null },
    ], error: null })
    const client = { storage: { from: vi.fn().mockReturnValue({ createSignedUrls }) } }
    const result = await createSignedRecipeImageUrls(client, [
      'recipes/a.jpg', 'recipes/b.gif', 'recipes/a.jpg', null,
      'https://attacker.example/image.jpg', 'recipes/../a.jpg', 'recipes/nested/a.jpg',
    ])
    expect(createSignedUrls).toHaveBeenCalledExactlyOnceWith(['recipes/a.jpg', 'recipes/b.gif'], 3600)
    expect(result.get('recipes/a.jpg')).toBe('https://signed.example/a')
    expect(result.get('recipes/b.gif')).toBe('https://signed.example/b')
    expect(result.size).toBe(2)
  })

  it('avoids a storage request when there are no valid images', async () => {
    const client = { storage: { from: vi.fn() } }
    expect((await createSignedRecipeImageUrls(client as never, [null, 'invalid'])).size).toBe(0)
    expect(client.storage.from).not.toHaveBeenCalled()
  })

  it('keeps available images when another image is missing', async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({ data: [
      { path: 'recipes/missing.jpg', signedUrl: '', error: 'not found' },
      { path: 'recipes/a.jpg', signedUrl: 'https://signed.example/a', error: null },
    ], error: null })
    const client = { storage: { from: vi.fn().mockReturnValue({ createSignedUrls }) } }
    const result = await createSignedRecipeImageUrls(client, ['recipes/missing.jpg', 'recipes/a.jpg'])
    expect(result.has('recipes/missing.jpg')).toBe(false)
    expect(result.get('recipes/a.jpg')).toBe('https://signed.example/a')
  })

  it.each(['returned', 'thrown'])('allows recipes to load after a %s storage failure', async failure => {
    const createSignedUrls = vi.fn()
    if (failure === 'returned') createSignedUrls.mockResolvedValue({ data: null, error: new Error('offline') })
    else createSignedUrls.mockRejectedValue(new Error('offline'))
    const client = { storage: { from: vi.fn().mockReturnValue({ createSignedUrls }) } }
    expect((await createSignedRecipeImageUrls(client, ['recipes/a.jpg'])).size).toBe(0)
  })
})
