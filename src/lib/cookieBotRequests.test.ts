import { describe, expect, it, vi } from 'vitest'
import { prepareRecipeProposal, applyRecipeProposal } from './cookieBotRequests'
const recipe = {
  title: 'Bread',
  ingredients: [{ section: '', items: ['450g flour'] }],
  instructions: [{ section: '', steps: ['Bake'] }],
  tags: [],
  servings: 12,
}
describe('explicit recipe changes', () => {
  it('generating a preview never writes a recipe', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true, mutatedRecipe: recipe })))
    expect(
      await prepareRecipeProposal(
        'r1',
        recipe,
        'Halve it',
        [],
        new AbortController().signal,
        fetcher,
      ),
    ).toEqual(recipe)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][0]).toBe('/api/recipe-mutate')
    expect(fetcher.mock.calls[0][1].method).toBe('POST')
  })
  it('only an explicit apply sends a validated structured update including servings', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    await applyRecipeProposal('r1', recipe, new AbortController().signal, fetcher)
    expect(fetcher.mock.calls[0][0]).toBe('/api/recipes/r1')
    expect(fetcher.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(recipe)
  })
  it('does not save invalid provider output', async () => {
    const fetcher = vi.fn()
    await expect(
      applyRecipeProposal(
        'r1',
        { ...recipe, ingredients: null } as never,
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
