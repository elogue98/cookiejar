type MeasurementKind = 'volume' | 'mass'

type UnitId =
  | 'teaspoon'
  | 'tablespoon'
  | 'fluid_ounce'
  | 'cup'
  | 'pint'
  | 'quart'
  | 'gallon'
  | 'ounce'
  | 'pound'
  | 'stick'

type UnitDefinition = {
  id: UnitId
  kind: MeasurementKind
  metricUnit: 'ml' | 'g'
  ratio: number // multiplier to convert unit quantity to metric base unit
  aliases: string[]
}

type ConversionConfidence = 'high' | 'medium' | 'low'

export type MetricConversion = {
  metricUnit: 'ml' | 'g'
  ratio: number
  confidence: ConversionConfidence
  source: 'override' | 'default' | 'heuristic' | 'ai'
}

type Measurement = {
  unit: UnitDefinition
  values: number[]
  ingredientText: string
}

type MatchedUnit = {
  definition: UnitDefinition
  raw: string
}

type ConversionAnalysis = {
  measurement: Measurement
  conversion: MetricConversion
}

type AiConversionInput = {
  unit: UnitDefinition
  ingredient: string
  line: string
}

export type AiConversionProvider = (
  input: AiConversionInput
) => Promise<MetricConversion | null>

type AppendMetricOptions = {
  cache?: Map<string, MetricConversion>
  aiProvider?: AiConversionProvider
}

const FRACTION_MAP: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

const APPROX_PREFIX = /^(?:about|approximately|approx\.?|around|roughly|nearly)\s+/i
const METRIC_PAREN_PATTERN =
  /\((?:[^)]*\b(?:ml|millilit(er|re)s?|g|grams?|grammes?|kg|kilograms?|l|liters?|litres?)\b[^)]*)\)/i

const OPTIONAL_ADJECTIVE = /^(?:heaping|packed|scant|level|rounded|generous|heaped)\s+/i

const UNIT_DEFINITIONS: UnitDefinition[] = [
  {
    id: 'teaspoon',
    kind: 'volume',
    metricUnit: 'ml',
    ratio: 5,
    aliases: ['teaspoon', 'teaspoons', 'tsp', 'tsps'],
  },
  {
    id: 'tablespoon',
    kind: 'volume',
    metricUnit: 'ml',
    ratio: 15,
    aliases: ['tablespoon', 'tablespoons', 'tbsp', 'tbsps'],
  },
  {
    id: 'fluid_ounce',
    kind: 'volume',
    metricUnit: 'ml',
    ratio: 30,
    aliases: ['fluid ounce', 'fluid ounces', 'fl oz', 'floz', 'fl. oz'],
  },
  {
    id: 'cup',
    kind: 'volume',
    metricUnit: 'ml',
    ratio: 240,
    aliases: ['cup', 'cups'],
  },
  {
    id: 'pint',
    kind: 'volume',
    metricUnit: 'ml',
    ratio: 475,
    aliases: ['pint', 'pints', 'pt', 'pts'],
  },
  {
    id: 'quart',
    kind: 'volume',
    metricUnit: 'ml',
    ratio: 950,
    aliases: ['quart', 'quarts', 'qt', 'qts'],
  },
  {
    id: 'gallon',
    kind: 'volume',
    metricUnit: 'ml',
    ratio: 3800,
    aliases: ['gallon', 'gallons', 'gal', 'gals'],
  },
  {
    id: 'ounce',
    kind: 'mass',
    metricUnit: 'g',
    ratio: 28,
    aliases: ['ounce', 'ounces', 'oz', 'ozs'],
  },
  {
    id: 'pound',
    kind: 'mass',
    metricUnit: 'g',
    ratio: 454,
    aliases: ['pound', 'pounds', 'lb', 'lbs'],
  },
  {
    id: 'stick',
    kind: 'mass',
    metricUnit: 'g',
    ratio: 113,
    aliases: ['stick', 'sticks'],
  },
]

type UnitAlias = {
  alias: string
  definition: UnitDefinition
}

const UNIT_ALIASES: UnitAlias[] = UNIT_DEFINITIONS.flatMap((definition) =>
  definition.aliases.map((alias) => ({
    alias,
    definition,
  }))
).sort((a, b) => b.alias.length - a.alias.length)

type IngredientOverride = {
  pattern: RegExp
  conversions: Partial<Record<UnitId, { metricUnit: 'ml' | 'g'; ratio: number }>>
}

const INGREDIENT_OVERRIDES: IngredientOverride[] = [
  {
    pattern:
      /\b(arborio|basmati|jasmine|sushi|brown|white)?\s*rice\b|\b(quinoa|farro|barley|bulgur|risotto|freekeh|millet|oats|polenta)\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 200 },
      tablespoon: { metricUnit: 'g', ratio: 13 },
      teaspoon: { metricUnit: 'g', ratio: 4 },
    },
  },
  {
    pattern: /\bflour\b|\bmeal\b|\bcornstarch\b|\bbreadcrumbs?\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 125 },
      tablespoon: { metricUnit: 'g', ratio: 8 },
      teaspoon: { metricUnit: 'g', ratio: 3 },
    },
  },
  {
    pattern: /\bsugar\b|\bbrown sugar\b|\bpowdered sugar\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 200 },
      tablespoon: { metricUnit: 'g', ratio: 13 },
      teaspoon: { metricUnit: 'g', ratio: 4 },
    },
  },
  {
    pattern: /\bpowder\b|\bspice\b|\bseasoning\b|\bsalt\b|\bpepper\b/i,
    conversions: {
      tablespoon: { metricUnit: 'g', ratio: 15 },
      teaspoon: { metricUnit: 'g', ratio: 5 },
    },
  },
  {
    pattern: /\bcheese\b|\bmozzarella\b|\bcheddar\b|\bparmesan\b|\bfeta\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 100 },
    },
  },
  {
    pattern: /\b(spinach|kale|arugula|greens?|lettuce|chard|collards?|mizuna|mesclun|spring mix)\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 30 },
    },
  },
  {
    pattern: /\bherbs?\b|\bparsley\b|\bcilantro\b|\bbasil\b|\bmint\b|\bdill\b|\bchives\b|\bthyme\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 25 },
      tablespoon: { metricUnit: 'g', ratio: 4 },
      teaspoon: { metricUnit: 'g', ratio: 1 },
    },
  },
  {
    pattern: /\b(berries|strawberries|blueberries|raspberries|blackberries)\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 140 },
    },
  },
  {
    pattern: /\b(mushrooms?|zucchini|squash|carrots?|celery|cucumber|tomatoes?)\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 110 },
    },
  },
  {
    pattern: /\b(nuts?|almonds?|cashews?|pecans?|walnuts?|peanuts?)\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 125 },
    },
  },
  {
    pattern: /\b(beans?|lentils?)\b/i,
    conversions: {
      cup: { metricUnit: 'g', ratio: 170 },
    },
  },
]

const LIQUID_KEYWORDS = [
  /\b(stock|broth|water|milk|cream|buttermilk|half-and-half|juice|sauce|syrup|nectar)\b/i,
  /\b(oil|vinegar|wine|rum|vodka|tequila|bourbon|whiskey|beer)\b/i,
  /\b(soy sauce|fish sauce|coconut milk|coconut water)\b/i,
  /\b(honey|molasses|maple)\b/i,
]

const SOLID_KEYWORDS = [
  /\b(pasta|noodles|macaroni|spaghetti|penne|rigatoni)\b/i,
  /\b(potatoes?|yams?|beets?|parsnips?)\b/i,
  /\b(chicken|beef|pork|tofu|tempeh|seitan)\b/i,
  /\b(vegetables?|veggies?|greens?|salad)\b/i,
  /\b(fruit|apple|pear|banana|mango|pineapple)\b/i,
]

const DEFAULT_SOLID_RATIOS: Partial<Record<UnitId, number>> = {
  cup: 120,
  tablespoon: 8,
  teaspoon: 3,
}

const RANGE_SEPARATOR_PATTERN = /\s*(?:to|through|thru|or)\s*/gi

/**
 * Append a metric conversion snippet using heuristics only (synchronous).
 */
export function appendMetricMeasurement(line: string): string {
  if (!line || METRIC_PAREN_PATTERN.test(line)) {
    return line
  }

  const analysis = analyzeLine(line)
  if (!analysis) {
    return line
  }

  return formatLineWithConversion(line, analysis.measurement, analysis.conversion)
}

/**
 * Append a metric conversion snippet with optional AI fallback for ambiguous cases.
 */
export async function appendMetricMeasurementWithAI(
  line: string,
  options?: AppendMetricOptions
): Promise<string> {
  if (!line || METRIC_PAREN_PATTERN.test(line)) {
    return line
  }

  const analysis = analyzeLine(line)
  if (!analysis) {
    return line
  }

  let conversion = analysis.conversion

  if (
    analysis.measurement.unit.kind === 'volume' &&
    conversion.confidence === 'low'
  ) {
    const aiConversion = await getAiConversion(line, analysis.measurement, options)
    if (aiConversion) {
      conversion = aiConversion
    }
  }

  return formatLineWithConversion(line, analysis.measurement, conversion)
}

function analyzeLine(line: string): ConversionAnalysis | null {
  const trimmed = line.replace(/^[\s•*-]+/, '').trim()
  if (!trimmed) {
    return null
  }

  const measurement = parseMeasurement(trimmed)
  if (!measurement) {
    return null
  }

  const conversion = determineConversion(trimmed, measurement)
  if (!conversion) {
    return null
  }

  return { measurement, conversion }
}

function formatLineWithConversion(
  originalLine: string,
  measurement: Measurement,
  conversion: MetricConversion
): string {
  const metricValues = measurement.values.map((value) =>
    Math.round(value * conversion.ratio)
  )

  if (metricValues.length === 0 || metricValues.some((value) => Number.isNaN(value))) {
    return originalLine
  }

  const metricText =
    metricValues.length === 1
      ? `${metricValues[0]} ${conversion.metricUnit}`
      : `${metricValues[0]}-${metricValues[1]} ${conversion.metricUnit}`

  const trailingWhitespace = originalLine.match(/\s*$/)?.[0] ?? ''
  const base = trailingWhitespace
    ? originalLine.slice(0, -trailingWhitespace.length)
    : originalLine

  return `${base} (${metricText})${trailingWhitespace}`
}

function parseMeasurement(text: string): Measurement | null {
  let working = text.replace(APPROX_PREFIX, '').trim()
  working = working.replace(/(\d)\s*-?\s*ish\b/gi, '$1')
  if (!working) {
    return null
  }

  const quantityMatch = matchQuantity(working)
  if (!quantityMatch) {
    return null
  }

  const values = parseQuantityRange(quantityMatch.quantity)
  if (!values || values.length === 0) {
    return null
  }

  const remainder = working.slice(quantityMatch.length).trimStart()
  if (!remainder) {
    return null
  }

  const unitMatch = matchUnit(remainder)
  if (!unitMatch) {
    return null
  }

  const ingredientText = remainder.slice(unitMatch.raw.length).trim()

  return {
    unit: unitMatch.definition,
    values,
    ingredientText,
  }
}

function matchQuantity(text: string):
  | {
      quantity: string
      length: number
    }
  | null {
  const quantityPattern = new RegExp(
    `^(?<quantity>(?:\\d+(?:\\s+\\d+\\/\\d+)?|\\d*\\/\\d+|[${Object.keys(FRACTION_MAP).join(
      ''
    )}]|\\d+(?:\\.\\d+)?)(?:\\s*(?:-|–|—|to|through|thru|or)\\s*(?:\\d+(?:\\s+\\d+\\/\\d+)?|\\d*\\/\\d+|[${Object.keys(
      FRACTION_MAP
    ).join('')}]|\\d+(?:\\.\\d+)?))?)`,
    'i'
  )
  const match = text.match(quantityPattern)
  if (!match?.groups?.quantity) {
    return null
  }

  const quantity = cleanupQuantityText(match.groups.quantity)

  return {
    quantity,
    length: match[0].length,
  }
}

function cleanupQuantityText(text: string): string {
  let normalized = text
    .replace(/(\d)-(?=\d+\/\d+)/g, '$1 ') // handle 1-1/2 => 1 1/2
    .replace(/–|—|−/g, '-') // normalize dashes
  normalized = normalized.replace(/(\d)-ish\b/gi, '$1')
  normalized = normalized.replace(/(\d)ish\b/gi, '$1')
  return normalized.trim()
}

function parseQuantityRange(quantityText: string): number[] | null {
  let working = replaceUnicodeFractions(quantityText)
  working = working.replace(RANGE_SEPARATOR_PATTERN, '-')
  working = working.replace(/-+/g, '-').trim()

  if (!working) {
    return null
  }

  const rangeParts = working.split('-')

  if (rangeParts.length === 2) {
    const start = parseSingleQuantity(rangeParts[0])
    const end = parseSingleQuantity(rangeParts[1])
    if (isNumber(start) && isNumber(end)) {
      return [start, end]
    }
  }

  const single = parseSingleQuantity(working)
  return isNumber(single) ? [single] : null
}

function parseSingleQuantity(value: string): number | null {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    return null
  }

  const parts = cleaned.split(' ')
  let total = 0

  for (const part of parts) {
    if (!part) continue
    if (/^\d+\/\d+$/.test(part)) {
      const [num, den] = part.split('/')
      const numerator = Number(num)
      const denominator = Number(den)
      if (!denominator) {
        return null
      }
      total += numerator / denominator
      continue
    }

    if (/^\d+(\.\d+)?$/.test(part)) {
      total += Number(part)
      continue
    }

    return null
  }

  return total
}

function replaceUnicodeFractions(text: string): string {
  return text.replace(/(\d)?([¼½¾⅓⅔⅛⅜⅝⅞])/g, (_, whole, frac) => {
    const replacement = FRACTION_MAP[frac] || frac
    return whole ? `${whole} ${replacement}` : replacement
  })
}

function matchUnit(text: string): MatchedUnit | null {
  let working = text.replace(/^[,.:()\s-]+/, '')
  if (!working) {
    return null
  }

  while (OPTIONAL_ADJECTIVE.test(working)) {
    working = working.replace(OPTIONAL_ADJECTIVE, '')
  }

  for (const entry of UNIT_ALIASES) {
    const regex = new RegExp(`^${escapeRegex(entry.alias)}\\b`, 'i')
    const match = working.match(regex)
    if (match) {
      return {
        definition: entry.definition,
        raw: match[0],
      }
    }
  }

  return null
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function determineConversion(
  line: string,
  measurement: Measurement
): MetricConversion | null {
  const { unit, ingredientText } = measurement
  const normalized = line.toLowerCase()

  for (const override of INGREDIENT_OVERRIDES) {
    if (override.pattern.test(normalized)) {
      const conversion = override.conversions[unit.id]
      if (conversion) {
        return { ...conversion, confidence: 'high', source: 'override' }
      }
    }
  }

  if (unit.kind === 'mass') {
    return {
      metricUnit: unit.metricUnit,
      ratio: unit.ratio,
      confidence: 'high',
      source: 'default',
    }
  }

  if (isLiquid(normalized)) {
    return {
      metricUnit: unit.metricUnit,
      ratio: unit.ratio,
      confidence: 'high',
      source: 'heuristic',
    }
  }

  if (isSolid(normalized)) {
    const ratio = DEFAULT_SOLID_RATIOS[unit.id]
    if (ratio) {
      return {
        metricUnit: 'g',
        ratio,
        confidence: 'medium',
        source: 'heuristic',
      }
    }
  }

  return {
    metricUnit: unit.metricUnit,
    ratio: unit.ratio,
    confidence: 'low',
    source: 'default',
  }
}

function isLiquid(text: string): boolean {
  return LIQUID_KEYWORDS.some((pattern) => pattern.test(text))
}

function isSolid(text: string): boolean {
  return (
    INGREDIENT_OVERRIDES.some((override) => override.pattern.test(text)) ||
    SOLID_KEYWORDS.some((pattern) => pattern.test(text))
  )
}

async function getAiConversion(
  line: string,
  measurement: Measurement,
  options?: AppendMetricOptions
): Promise<MetricConversion | null> {
  if (!options?.aiProvider && !process.env.OPENAI_API_KEY) {
    return null
  }

  const ingredientKey = (measurement.ingredientText || line).toLowerCase()
  const cacheKey = `${measurement.unit.id}::${ingredientKey}`
  const cache = options?.cache
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey) ?? null
  }

  const provider =
    options?.aiProvider ?? (await getDefaultAiProvider())

  if (!provider) {
    return null
  }

  try {
    const conversion = await provider({
      unit: measurement.unit,
      ingredient: measurement.ingredientText || line,
      line,
    })

    if (conversion && cache) {
      cache.set(cacheKey, conversion)
    }

    return conversion
  } catch (error) {
    console.warn('[ingredientUnits] AI conversion failed:', error)
    return null
  }
}

let defaultAiProviderPromise:
  | Promise<AiConversionProvider | null>
  | null = null

async function getDefaultAiProvider(): Promise<AiConversionProvider | null> {
  if (defaultAiProviderPromise) {
    return defaultAiProviderPromise
  }

  defaultAiProviderPromise = (async () => {
    if (!process.env.OPENAI_API_KEY) {
      return null
    }

    const { aiComplete } = await import('./ai')

    const provider: AiConversionProvider = async (input) => {
      const systemPrompt =
        'You convert US recipe measurements to metric. Decide whether an ingredient measured in US units should be expressed in milliliters (liquids) or grams (solids). Return JSON with keys metricUnit ("ml" or "g") and valuePerUnit (metric amount for ONE original unit such as 1 cup or 1 tablespoon). Keep values as whole numbers.'

      const userPrompt = `Ingredient line: "${input.line}"
Unit: ${input.unit.id}
Ingredient focus: ${input.ingredient}

Respond with: {"metricUnit":"g","valuePerUnit":30}`

      const response = await aiComplete(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }
      )

      try {
        const parsed = JSON.parse(response)
        const unit =
          parsed.metricUnit === 'g' ? 'g' : parsed.metricUnit === 'ml' ? 'ml' : null
        const value = Number(parsed.valuePerUnit)

        if (!unit || !Number.isFinite(value) || value <= 0) {
          return null
        }

        return {
          metricUnit: unit,
          ratio: Math.round(value),
          confidence: 'high',
          source: 'ai',
        }
      } catch {
        return null
      }
    }

    return provider
  })()

  return defaultAiProviderPromise
}


