import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Home from './page'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), sign: vi.fn() }))
vi.mock('@/lib/serverPageAuth', () => ({ requireFamilyPage: mocks.auth }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/lib/imageUrls', () => ({ createSignedRecipeImageUrls: mocks.sign }))
vi.mock('./components/HomePageContent', () => ({ default: () => null }))

const recipe = { id: 'r1', rating: 2, image_path: 'recipes/a.jpg', created_by: 'u1' }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => {
  let resolve!: (value: { data: unknown; error: null }) => void
  const promise = new Promise<{ data: unknown; error: null }>(r => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('React', React)
  mocks.auth.mockResolvedValue({ profileId: 'u1' })
  mocks.sign.mockResolvedValue(new Map([['recipes/a.jpg', 'https://signed.example/a']]))
})

afterEach(() => vi.unstubAllGlobals())

describe('homepage loading', () => {
  it('starts recipes and ratings together and signs images while creators are loading', async () => {
    const recipes = deferred()
    const ratings = deferred()
    const creators = deferred()
    const started: string[] = []
    mocks.from.mockImplementation(table => ({ select: () => {
      if (table === 'recipes') return { order: () => { started.push(table); return recipes.promise } }
      if (table === 'ratings') { started.push(table); return ratings.promise }
      return { in: () => { started.push(table); return creators.promise } }
    } }))
    const page = Home()
    await flush()
    expect(started).toEqual(['recipes', 'ratings'])
    recipes.resolve({ data: [recipe], error: null })
    await flush()
    expect(mocks.sign).toHaveBeenCalledWith(expect.anything(), ['recipes/a.jpg'])
    expect(started).toContain('users')
    ratings.resolve({ data: [{ recipe_id: 'r1', rating: 5 }, { recipe_id: 'r1', rating: 4 }], error: null })
    creators.resolve({ data: [{ id: 'u1', name: 'Test', avatar_url: '' }], error: null })
    const result = await page
    expect(result.props.recipes[0]).toMatchObject({ rating: 4.5, image_url: 'https://signed.example/a', creator: { id: 'u1' } })
  })

  it('preserves recipe fallbacks when ratings, creators and images are unavailable', async () => {
    mocks.from.mockImplementation(table => ({ select: () => {
      if (table === 'recipes') return { order: async () => ({ data: [recipe], error: null }) }
      if (table === 'ratings') return Promise.resolve({ data: null, error: { code: '42P01', message: 'does not exist' } })
      return { in: async () => ({ data: null, error: { code: 'unavailable' } }) }
    } }))
    mocks.sign.mockResolvedValue(new Map())
    const result = await Home()
    expect(result.props.recipes[0]).toMatchObject({ rating: 2, creator: null, image_url: null })
    expect(result.props.errorMessage).toBeNull()
  })

  it('does not fetch private data if family authorization fails', async () => {
    mocks.auth.mockRejectedValue(new Error('redirect'))
    await expect(Home()).rejects.toThrow('redirect')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.sign).not.toHaveBeenCalled()
  })
})
