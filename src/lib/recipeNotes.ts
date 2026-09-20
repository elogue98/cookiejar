export type LegacyRecipeMetadata = {
  description?: unknown
  servings?: unknown
  prepTime?: unknown
  cookTime?: unknown
  totalTime?: unknown
  cuisine?: unknown
  mealType?: unknown
  nutrition?: unknown
}

export type ParsedRecipeNotes = {
  description?: string
  legacyMetadata: LegacyRecipeMetadata | null
}

const LEGACY_METADATA_KEYS = new Set([
  'description',
  'servings',
  'prepTime',
  'cookTime',
  'totalTime',
  'cuisine',
  'mealType',
  'nutrition',
])

function cleanDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  const normalized = trimmed.toLowerCase()
  if (normalized === 'null' || normalized === 'undefined' || normalized === 'n/a') {
    return undefined
  }

  return trimmed
}

export function parseRecipeNotes(notes: unknown): ParsedRecipeNotes {
  const text = cleanDescription(notes)
  if (!text) {
    return { description: undefined, legacyMetadata: null }
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).some((key) => LEGACY_METADATA_KEYS.has(key))
    ) {
      const legacyMetadata = parsed as LegacyRecipeMetadata
      return {
        description: cleanDescription(legacyMetadata.description),
        legacyMetadata,
      }
    }
  } catch {
    // Ordinary recipe notes are not JSON.
  }

  return { description: text, legacyMetadata: null }
}
