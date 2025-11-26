import { aiComplete } from '@/lib/ai'

type IngredientSection = {
  section?: string | null
  items: string[]
}

type InstructionSection = {
  section?: string | null
  steps: string[]
}

type NutritionInfo = {
  calories?: number | null
  protein?: number | null
  fat?: number | null
  carbs?: number | null
}

export type MetadataAwareRecipe = {
  title?: string | null
  description?: string | null
  ingredientSections: IngredientSection[]
  instructionSections: InstructionSection[]
  servings?: number | null
  prepTime?: string | null
  cookTime?: string | null
  totalTime?: string | null
  cuisine?: string | null
  mealType?: string | null
  nutrition?: NutritionInfo | null
  [key: string]: unknown
}

type MetadataCompletionResponse = {
  servings?: number | string | null
  prepTime?: string | null
  cookTime?: string | null
  totalTime?: string | null
  cuisine?: string | null
  mealType?: string | null
  nutrition?: {
    calories?: number | string | null
    protein?: number | string | null
    fat?: number | string | null
    carbs?: number | string | null
  } | null
}

const DEFAULT_NUTRITION = {
  calories: 350,
  protein: 18,
  fat: 14,
  carbs: 32,
}

const MINUTES_REGEX = /(\d+(?:\.\d+)?)\s*(minutes?|mins?|m)\b/i
const HOURS_REGEX = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i

const isNutritionMissing = (nutrition?: NutritionInfo | null) => {
  if (!nutrition) return true
  return (
    nutrition.calories == null ||
    nutrition.protein == null ||
    nutrition.fat == null ||
    nutrition.carbs == null
  )
}

const toPositiveInt = (value: unknown): number | null => {
  if (value == null) return null
  const num = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : Number(value)
  if (!Number.isFinite(num)) return null
  const rounded = Math.max(1, Math.round(num))
  return rounded
}

const normalizeTimeString = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value.trim().replace(/\s+/g, ' ')
}

const parseMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null
  let minutes = 0
  const hourMatch = value.match(HOURS_REGEX)
  if (hourMatch) {
    minutes += Math.round(parseFloat(hourMatch[1]) * 60)
  }
  const minuteMatch = value.match(MINUTES_REGEX)
  if (minuteMatch) {
    minutes += Math.round(parseFloat(minuteMatch[1]))
  }
  if (minutes === 0) return null
  return minutes
}

const minutesToTimeString = (minutes: number | null): string | null => {
  if (!minutes || minutes <= 0) return null
  if (minutes < 60) {
    return `${minutes} minutes`
  }
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hrs} hour${hrs > 1 ? 's' : ''}`
  }
  return `${hrs} hour${hrs > 1 ? 's' : ''} ${mins} minutes`
}

const estimateServingsFromTitle = (title?: string | null): number => {
  if (!title) return 4
  const lower = title.toLowerCase()
  if (/(loaf|bread)/.test(lower)) return 12
  if (/(cake|brownie|sheet cake|traybake)/.test(lower)) return 12
  if (/(pie|tart|quiche)/.test(lower)) return 8
  if (/(muffin|cupcake)/.test(lower)) return 12
  if (/(cookie|biscuit|scone)/.test(lower)) return 12
  if (/(soup|stew|curry|chili)/.test(lower)) return 6
  if (/(salad)/.test(lower)) return 4
  if (/(pasta|noodle)/.test(lower)) return 4
  return 4
}

const defaultNutritionForServings = (servings: number): NutritionInfo => {
  Math.max(servings, 1) // ensure positive in case we later scale nutrition
  return {
    calories: DEFAULT_NUTRITION.calories,
    protein: DEFAULT_NUTRITION.protein,
    fat: DEFAULT_NUTRITION.fat,
    carbs: DEFAULT_NUTRITION.carbs,
  }
}

const formatMetadataPrompt = (
  recipe: MetadataAwareRecipe,
  originalContent: string
) => {
  const ingredients = recipe.ingredientSections
    .flatMap((section) => {
      const header = section.section ? `${section.section}: ` : ''
      return section.items.map((item) => `${header}${item}`)
    })
    .slice(0, 40)
    .join('\n')

  const instructions = recipe.instructionSections
    .flatMap((section) => {
      const header = section.section ? `${section.section}: ` : ''
      return section.steps.map((step, idx) => `${header}${idx + 1}. ${step}`)
    })
    .slice(0, 40)
    .join('\n')

  const truncatedContent = originalContent.slice(0, 6000)

  return `You are a culinary assistant that fills in missing metadata for recipes. Use the title, ingredients, instructions, and original content to ESTIMATE the following fields if they are missing:

- servings (number of people or pieces; breads/cakes loaves = 12, pies = 8, cookies/muffins = 12, default mains = 4-6)
- prepTime (how long to prep ingredients)
- cookTime (active cooking)
- totalTime (overall duration; if not explicit, prep + cook)
- cuisine and mealType if you can infer them
- nutrition per serving (calories, protein grams, fat grams, carbs grams). ALWAYS provide realistic estimates, even if you must approximate based on ingredients.

Return strict JSON with:
{
  "servings": number,
  "prepTime": "string time like '15 minutes'",
  "cookTime": "string",
  "totalTime": "string",
  "cuisine": "string or null",
  "mealType": "string or null",
  "nutrition": { "calories": number, "protein": number, "fat": number, "carbs": number }
}

Title: ${recipe.title || 'Untitled'}

Ingredients:
${ingredients}

Instructions:
${instructions}

Original Content Snippet:
${truncatedContent}`
}

const parseMetadataResponse = (raw: string): MetadataCompletionResponse | null => {
  try {
    return JSON.parse(raw)
  } catch {
    const match =
      raw.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[1] || match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

export async function ensureMetadataCompleteness<T extends MetadataAwareRecipe>(
  recipe: T,
  originalContent: string
): Promise<T> {
  const needsServings = !recipe.servings || recipe.servings <= 0
  const needsPrep = !recipe.prepTime
  const needsCook = !recipe.cookTime
  const needsTotal = !recipe.totalTime
  const needsNutrition = isNutritionMissing(recipe.nutrition)

  if (!needsServings && !needsPrep && !needsCook && !needsTotal && !needsNutrition) {
    return recipe
  }

  let metadata: MetadataCompletionResponse | null = null
  try {
    const response = await aiComplete(
      [
        {
          role: 'system',
          content: 'You are an exacting culinary metadata assistant.',
        },
        {
          role: 'user',
          content: formatMetadataPrompt(recipe, originalContent),
        },
      ],
      {
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      }
    )
    metadata = response ? parseMetadataResponse(response) : null
  } catch (error) {
    console.error('Metadata completion request failed:', error)
  }

  const enriched: MetadataAwareRecipe = { ...recipe }

  if (needsServings) {
    enriched.servings =
      toPositiveInt(metadata?.servings) ??
      estimateServingsFromTitle(recipe.title)
  }

  if (needsPrep) {
    enriched.prepTime =
      normalizeTimeString(metadata?.prepTime) ?? '15 minutes'
  }

  if (needsCook) {
    enriched.cookTime =
      normalizeTimeString(metadata?.cookTime) ?? '30 minutes'
  }

  if (needsTotal) {
    const metaTotal = normalizeTimeString(metadata?.totalTime)
    if (metaTotal) {
      enriched.totalTime = metaTotal
    } else {
      const prepMinutes = parseMinutes(enriched.prepTime) ?? 15
      const cookMinutes = parseMinutes(enriched.cookTime) ?? 30
      enriched.totalTime = minutesToTimeString(prepMinutes + cookMinutes) ?? '45 minutes'
    }
  }

  if (needsNutrition) {
    const calories = toPositiveInt(metadata?.nutrition?.calories)
    const protein = toPositiveInt(metadata?.nutrition?.protein)
    const fat = toPositiveInt(metadata?.nutrition?.fat)
    const carbs = toPositiveInt(metadata?.nutrition?.carbs)

    if (calories && protein && fat && carbs) {
      enriched.nutrition = {
        calories,
        protein,
        fat,
        carbs,
      }
    } else {
      const servings = enriched.servings ?? estimateServingsFromTitle(recipe.title)
      enriched.nutrition = defaultNutritionForServings(servings)
    }
  }

  return enriched as T
}
