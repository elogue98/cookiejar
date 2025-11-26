import {
  MetricConversion,
  appendMetricMeasurement,
  appendMetricMeasurementWithAI,
} from './ingredientUnits'

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

// Generic headers that should be removed if they're the only section
const GENERIC_INGREDIENT_HEADERS = [
  'ingredients',
  'ingredient',
  'what you need',
  'you will need',
  'shopping list',
]

const GENERIC_INSTRUCTION_HEADERS = [
  'instructions',
  'instruction',
  'method',
  'directions',
  'direction',
  'steps',
  'how to make',
  'preparation',
]

function isGenericHeader(text: string, genericList: string[]): boolean {
  const normalized = text.toLowerCase().trim().replace(/[:\s]+$/, '')
  return genericList.includes(normalized)
}

type IngredientNormalizationOptions = {
  enableAiConversions?: boolean
  skipConversions?: boolean
}

export async function normalizeIngredientSections(
  sections: IngredientSectionInput[],
  options?: IngredientNormalizationOptions
) {
  const enableAi = options?.enableAiConversions ?? true
  const skipConversions = options?.skipConversions ?? false
  const aiCache: Map<string, MetricConversion> | undefined = enableAi
    ? new Map()
    : undefined

  const results = []

  for (const section of sections) {
    const sectionText = section.section?.trim() || ''
    const processedItems: string[] = []

    for (const rawItem of section.items) {
      const trimmedItem = rawItem.trim()
      if (!trimmedItem) {
        continue
      }

      const itemNormalized = trimmedItem.toLowerCase().trim().replace(/[:\s]+$/, '')
      if (itemNormalized === sectionText.toLowerCase().trim().replace(/[:\s]+$/, '')) {
        continue
      }

      const converted = skipConversions
        ? trimmedItem
        : enableAi
        ? await appendMetricMeasurementWithAI(trimmedItem, { cache: aiCache })
        : appendMetricMeasurement(trimmedItem)

      processedItems.push(converted)
    }

    if (processedItems.length === 0) {
      continue
    }

    const shouldRemoveGeneric =
      sections.length === 1 && isGenericHeader(sectionText, GENERIC_INGREDIENT_HEADERS)

    results.push({
      section: shouldRemoveGeneric ? '' : sectionText,
      items: processedItems,
    })
  }

  return results
}

export function normalizeInstructionSections(
  sections: InstructionSectionInput[]
) {
  return sections
    .map((section) => {
      const sectionText = section.section?.trim() || ''
      const steps = section.steps
        .map((step) => step.trim())
        .filter(Boolean)
        // Remove steps that are just the section header repeated
        .filter((step) => {
          const stepNormalized = step.toLowerCase().trim().replace(/[:\s]+$/, '')
          return stepNormalized !== sectionText.toLowerCase().trim().replace(/[:\s]+$/, '')
        })
      
      // If section is generic and it's the only section, remove the section header
      const shouldRemoveGeneric = sections.length === 1 && isGenericHeader(sectionText, GENERIC_INSTRUCTION_HEADERS)
      
      return {
        section: shouldRemoveGeneric ? '' : sectionText,
        steps,
      }
    })
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
