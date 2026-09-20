/**
 * The frozen vocabulary used by the recipe-tagging experiment.
 *
 * This is intentionally described as an experiment taxonomy, not as the
 * application's canonical tag contract. Existing routes still accept and
 * store open-ended tags.
 */
export const RECIPE_TAG_CUISINES = [
  'italian',
  'chinese',
  'japanese',
  'indian',
  'mexican',
  'thai',
  'french',
  'greek',
  'mediterranean',
  'american',
  'korean',
  'vietnamese',
  'spanish',
  'middle eastern',
  'caribbean',
] as const

export const RECIPE_TAG_METHODS = [
  'baked',
  'fried',
  'grilled',
  'roasted',
  'steamed',
  'boiled',
  'braised',
  'slow-cooked',
  'pressure-cooked',
  'raw',
  'marinated',
  'smoked',
] as const

export const RECIPE_TAG_DIETARY = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'paleo',
  'low-carb',
  'high-protein',
  'healthy',
  'comfort-food',
] as const

export const RECIPE_TAG_MAIN_INGREDIENTS = [
  'chicken',
  'beef',
  'pork',
  'fish',
  'salmon',
  'shrimp',
  'pasta',
  'rice',
  'potato',
  'tomato',
  'cheese',
  'bread',
  'cake',
  'cookie',
  'soup',
  'salad',
  'pizza',
  'burger',
  'sandwich',
  'curry',
  'stir-fry',
  'casserole',
] as const

export const RECIPE_TAG_TAXONOMY = [
  ...RECIPE_TAG_CUISINES,
  ...RECIPE_TAG_METHODS,
  ...RECIPE_TAG_DIETARY,
  ...RECIPE_TAG_MAIN_INGREDIENTS,
  'quick',
] as const

export type RecipeTag = (typeof RECIPE_TAG_TAXONOMY)[number]

export function isRecipeTag(value: string): value is RecipeTag {
  return (RECIPE_TAG_TAXONOMY as readonly string[]).includes(value)
}
