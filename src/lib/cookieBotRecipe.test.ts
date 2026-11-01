import { describe, expect, it } from 'vitest'
import { chatHistory, recipeChanges, recipeProposalSchema } from './cookieBotRecipe'
const recipe = {
  title: 'Bread',
  ingredients: [{ section: '', items: ['450g flour'] }],
  instructions: [{ section: '', steps: ['Bake.'] }],
  tags: ['bread'],
  servings: 12,
}
describe('CookieBot recipe and history boundaries', () => {
  it('shows a proposed clearing of servings rather than hiding it', () => {
    expect(recipeChanges(recipe, { ...recipe, servings: null })).toContainEqual({
      label: 'Servings',
      before: ['12'],
      after: ['Not specified'],
    })
  })
  it('previews changed fields including servings without modifying the original recipe', () => {
    const proposal = {
      ...recipe,
      ingredients: [{ section: '', items: ['225g flour'] }],
      servings: 6,
    }
    expect(recipeChanges(recipe, proposal).map((c) => c.label)).toEqual(['Ingredients', 'Servings'])
    expect(recipe.ingredients[0].items).toEqual(['450g flour'])
    expect(recipeChanges(recipe, recipe)).toEqual([])
  })
  it('validates generated proposals and rejects malformed ingredient groups', () => {
    expect(recipeProposalSchema.safeParse(recipe).success).toBe(true)
    expect(
      recipeProposalSchema.safeParse({ ...recipe, ingredients: [{ items: [42] }] }).success,
    ).toBe(false)
    expect(recipeProposalSchema.safeParse({ ...recipe, servings: -1 }).success).toBe(false)
  })
  it('excludes interrupted answers and preserves only completed conversational pairs', () => {
    expect(
      chatHistory([
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Partial', status: 'stopped' },
        { role: 'user', content: 'Second' },
        { role: 'assistant', content: 'Complete', status: 'complete' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Second' },
      { role: 'assistant', content: 'Complete' },
    ])
  })
  it('bounds history size without splitting pairs', () => {
    const messages = Array.from({ length: 20 }, () => [
      { role: 'user' as const, content: 'x'.repeat(4000) },
      { role: 'assistant' as const, content: 'y'.repeat(6000), status: 'complete' as const },
    ]).flat()
    const history = chatHistory(messages)
    expect(history.length % 2).toBe(0)
    expect(history.length).toBeLessThanOrEqual(20)
    expect(history.reduce((total, m) => total + m.content.length, 0)).toBeLessThanOrEqual(36000)
    expect(history.every((m) => m.content.length <= 4000)).toBe(true)
  })
})
