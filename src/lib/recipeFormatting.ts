export type IngredientSectionInput = {
  section?: string | null
  items: string[]
}

export type InstructionSectionInput = {
  section?: string | null
  steps: string[]
}

export type RecipeMetadataSource = {
  description?: string | null
  servings?: number | null
  prepTime?: string | null
  cookTime?: string | null
  totalTime?: string | null
  cuisine?: string | null
  mealType?: string | null
  nutrition?: {
    calories?: number | null
    protein?: number | null
    fat?: number | null
    carbs?: number | null
  } | null
}

export function normalizeIngredientSections(
  sections: IngredientSectionInput[]
) {
  return sections
    .map((section) => ({
      section: section.section?.trim() || '',
      items: section.items.map((item) => item.trim()).filter(Boolean),
    }))
    .filter((section) => section.items.length > 0)
}

export function normalizeInstructionSections(
  sections: InstructionSectionInput[]
) {
  return sections
    .map((section) => ({
      section: section.section?.trim() || '',
      steps: section.steps.map((step) => step.trim()).filter(Boolean),
    }))
    .filter((section) => section.steps.length > 0)
}

export function formatMetadataForNotes(
  source: RecipeMetadataSource
): string {
  const metadata: Record<string, unknown> = {}

  if (source.description) metadata.description = source.description
  if (source.servings) metadata.servings = source.servings
  if (source.prepTime) metadata.prepTime = source.prepTime
  if (source.cookTime) metadata.cookTime = source.cookTime
  if (source.totalTime) metadata.totalTime = source.totalTime
  if (source.cuisine) metadata.cuisine = source.cuisine
  if (source.mealType) metadata.mealType = source.mealType
  if (source.nutrition) metadata.nutrition = source.nutrition

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata, null, 2) : ''
}

