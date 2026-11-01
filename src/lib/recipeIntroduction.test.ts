import { expect, it } from 'vitest'
import { recipeImportOutputSchema } from './recipeIntroduction'

const recipe = {
  title: 'Roasted sausages', description: 'Gizzi Erskine writes: “Everyone loves sausages and easy dishes to use them in.”',
  sourceUrl: null, image: null, servings: 4, prepTime: null, cookTime: null, totalTime: null,
  cuisine: null, mealType: null, nutrition: null,
  ingredientSections: [{ section: '', items: ['8 sausages'] }],
  instructionSections: [{ section: '', steps: ['Roast the sausages.'] }], tags: [],
}

it('preserves an author introduction without rewriting it', () => {
  expect(recipeImportOutputSchema.parse(recipe).description).toBe(recipe.description)
})

it.each([null, '', '   '])('rejects a missing introduction before an import can be saved: %j', description => {
  expect(recipeImportOutputSchema.safeParse({ ...recipe, description }).success).toBe(false)
})
