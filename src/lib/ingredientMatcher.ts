import { FRACTION_MAP, UNIT_ALIAS_TERMS } from './ingredientUnits'
import { loadLearnedModel, scoreWithModel } from './highlightModel'

export interface IngredientGroup {
  section: string
  items: string[]
}

export interface InstructionGroup {
  section: string
  steps: string[]
}

export interface IngredientMatcherOptions {
  minConfidence?: number
  useLearnedModel?: boolean
}

const UNIT_TOKENS = new Set(
  UNIT_ALIAS_TERMS.map((alias) => alias.toLowerCase()).map((alias) =>
    alias.replace(/[^\w\s]/g, ' ').trim(),
  ),
)

const SEASONING_TOKENS = new Set(['salt', 'pepper'])

const PREP_WORDS = new Set([
  'chopped',
  'sliced',
  'diced',
  'minced',
  'grated',
  'peeled',
  'shelled',
  'shucked',
  'deveined',
  'pitted',
  'seeded',
  'cored',
  'zested',
  'crushed',
  'finely',
  'roughly',
  'coarsely',
  'thinly',
  'thickly',
  'fresh',
  'dried',
  'ground',
  'whole',
  'large',
  'medium',
  'small',
  'extra',
  'virgin',
  'boneless',
  'skinless',
  'unsalted',
  'salted',
  'cold',
  'hot',
  'warm',
  'melted',
  'room',
  'temperature',
  'softened',
  'beaten',
  'whisked',
  'sifted',
  'divided',
  'separated',
  'optional',
  'garnish',
  'needed',
  'removed',
  'reserved',
  'drained',
  'rinsed',
  'cleaned',
  'trimmed',
  'halved',
  'quartered',
  'cubed',
  'chunks',
  'strips',
  'wedges',
  'scrubbed',
  'washed',
  'bruised',
  'leaves',
  'only',
  'shell',
  'shells',
  'skin',
  'skins',
  'bone',
  'bones',
  'seed',
  'seeds',
  'stem',
  'stems',
  'tail',
  'tails',
  'extract',
  'granulated',
  'powdered',
  'icing',
  'superfine',
  'plain',
  'all-purpose',
  'cooled',
  'cool',
  'chilled',
  'refrigerated',
  'leftover',
  'leftovers',
  'half',
  'halves',
  'third',
  'thirds',
  'plus',
  'more',
])

const STOP_WORDS = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'in', 'with', 'for', 'to', 'from', 'into', 'as'])
const HEAD_NOUN_IGNORE_WORDS = new Set([
  ...PREP_WORDS,
  ...STOP_WORDS,
  'into',
  'onto',
  'over',
  'under',
])

const SYNONYM_MAP: Record<string, string[]> = {
  bacon: ['lardon', 'lardons', 'pancetta'],
  scallop: ['scallops'],
  potato: ['potatoes', 'spud', 'spuds'],
  butter: ['butters', 'ghee'],
  milk: ['dairy'],
  sage: ['herb', 'herbs'],
  garlic: ['garlics', 'clove', 'cloves'],
  onion: ['onions', 'shallot', 'shallots', 'scallion', 'scallions', 'spring', 'green'],
  tomato: ['tomatoes'],
  oil: ['olive', 'oil'],
  shrimp: ['prawn', 'prawns'],
  prawn: ['shrimp', 'shrimps'],
  cilantro: ['coriander'],
  coriander: ['cilantro'],
  zucchini: ['courgette', 'courgettes'],
  courgette: ['zucchini', 'zucchinis'],
  eggplant: ['aubergine', 'aubergines'],
  aubergine: ['eggplant', 'eggplants'],
  pepper: ['bell', 'capsicum', 'capsicums'],
  arugula: ['rocket'],
  rocket: ['arugula'],
  yogurt: ['yoghurt', 'yogurt'],
  yoghurt: ['yogurt'],
  chilli: ['chili', 'chilies', 'chillies'],
  chili: ['chilli', 'chilies', 'chillies'],
  flour: ['all-purpose flour', 'plain flour'],
  sugar: ['caster', 'powdered', 'icing', 'confectioners'],
  corn: ['sweetcorn', 'kernels'],
  bicarbonate: ['baking', 'soda', 'bicarb'],
  soda: ['bicarbonate'],
  paprika: ['smoked paprika'],
  salt: ['salted'],
  salmon: ['fillet', 'filet'],
  noodle: ['noodles', 'udon', 'ramen', 'spaghetti'],
  tofu: ['bean curd'],
  chili: ['chilli', 'chile'],
  chilli: ['chili', 'chile'],
  sugar: ['brown sugar'],
  crisp: ['crisps'],
  prawn: ['shrimp', 'shrimps'],
  shrimp: ['prawn', 'prawns'],
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const FRACTION_REGEX = new RegExp(`[${Object.keys(FRACTION_MAP).map(escapeRegExp).join('')}]`, 'g')
const UNICODE_FRACTIONS = Object.keys(FRACTION_MAP)
const QUANTITY_REGEX = /(^|\s)\d+[\d\/\.]*\s*/g
const FRACTION_RANGE_REGEX = /\b\d+\s+\d\/\d\b|\b\d+\/\d+\b/g

function replaceUnicodeFractions(text: string): string {
  if (!UNICODE_FRACTIONS.some((fraction) => text.includes(fraction))) {
    return text
  }
  return text.replace(FRACTION_REGEX, (match) => FRACTION_MAP[match] || match)
}

function cleanIngredientText(text: string): string {
  let cleaned = replaceUnicodeFractions(text.toLowerCase())
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ')
  cleaned = cleaned.replace(FRACTION_RANGE_REGEX, ' ')
  cleaned = cleaned.replace(QUANTITY_REGEX, ' ')

  UNIT_TOKENS.forEach((unit) => {
    if (!unit) return
    const unitRegex = new RegExp(`\\b${escapeRegExp(unit)}\\b`, 'gi')
    cleaned = cleaned.replace(unitRegex, ' ')
  })

  PREP_WORDS.forEach((word) => {
    const prepRegex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi')
    cleaned = cleaned.replace(prepRegex, ' ')
  })

  STOP_WORDS.forEach((word) => {
    const stopRegex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi')
    cleaned = cleaned.replace(stopRegex, ' ')
  })

  cleaned = cleaned.replace(/[^\w\s]/g, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('ves')) return word.slice(0, -3) + 'f'
  if (word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function tokenize(text: string): string[] {
  return text
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .map(singularize)
}

function getHeadNoun(tokens: string[]): string | null {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const candidate = tokens[i]
    if (!candidate) continue
    if (candidate.length <= 1) continue
    if (HEAD_NOUN_IGNORE_WORDS.has(candidate)) continue
    return candidate
  }
  return tokens.length > 0 ? tokens[tokens.length - 1] : null
}

function expandSynonyms(token: string): string[] {
  return SYNONYM_MAP[token] || []
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[a.length][b.length]
}

function fuzzyTokenHit(token: string, stepTokens: string[]): boolean {
  if (token.length <= 3) return false
  for (const candidate of stepTokens) {
    const lengthGap = Math.abs(candidate.length - token.length)
    if (lengthGap > 2) continue
    if (token.length >= 5 && candidate.includes(token)) return true
    if (candidate.length >= 5 && token.includes(candidate)) return true
    if (editDistance(token, candidate) <= 1) return true
  }
  return false
}

function buildPhrases(tokens: string[]): string[] {
  const phrases: string[] = []
  for (let size = 2; size <= Math.min(3, tokens.length); size += 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      phrases.push(tokens.slice(i, i + size).join(' '))
    }
  }
  return phrases
}

interface ProcessedIngredient {
  id: string
  original: string
  tokens: string[]
  tokenSet: Set<string>
  headNoun: string | null
  phrases: string[]
  section?: string
  cleanLabel: string
  totalWeight: number
  tokenWeights: Map<string, number>
}

interface StepFeatures {
  id: string
  text: string
  tokens: string[]
  tokenSet: Set<string>
  synonymSet: Set<string>
  phrases: string[]
  section?: string
}

function normalizeSection(section?: string): string {
  return (section || '').trim().toLowerCase()
}

function sectionsAlign(stepSection?: string, ingredientSection?: string): boolean {
  if (!stepSection || !ingredientSection) return true
  const normalizedStep = normalizeSection(stepSection)
  const normalizedIngredient = normalizeSection(ingredientSection)
  if (!normalizedStep || !normalizedIngredient) return true

  if (normalizedStep === normalizedIngredient) return true
  const tokens1 = normalizedStep.split(' ').filter((token) => token.length > 3)
  const tokens2 = normalizedIngredient.split(' ').filter((token) => token.length > 3)

  return tokens1.some((token) => normalizedIngredient.includes(token)) || tokens2.some((token) => normalizedStep.includes(token))
}

function buildProcessedIngredients(groups: IngredientGroup[]): ProcessedIngredient[] {
  const processed: ProcessedIngredient[] = []
  const tokenCounts = new Map<string, number>()

  groups.forEach((group, groupIdx) => {
    group.items.forEach((item, itemIdx) => {
      const cleanLabel = cleanIngredientText(item)
      const tokens = tokenize(cleanLabel)
      if (tokens.length === 0) {
        return
      }
      const headNoun = getHeadNoun(tokens)
      tokens.forEach((token) => tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1))

      processed.push({
        id: `${groupIdx}-${itemIdx}`,
        original: item,
        tokens,
        tokenSet: new Set(tokens),
        headNoun,
        phrases: buildPhrases(tokens),
        section: group.section,
        cleanLabel,
        totalWeight: 0,
        tokenWeights: new Map<string, number>(),
      })
    })
  })

  processed.forEach((ingredient) => {
    let weightSum = 0
    ingredient.tokens.forEach((token) => {
      const freq = tokenCounts.get(token) || 1
      const weight = 1 / freq
      ingredient.tokenWeights.set(token, weight)
      weightSum += weight
    })
    ingredient.totalWeight = weightSum || ingredient.tokens.length
  })

  return processed
}

function buildStepFeatures(instructions: InstructionGroup[]): StepFeatures[] {
  const steps: StepFeatures[] = []
  let counter = 0
  instructions.forEach((group) => {
    group.steps.forEach((step) => {
      const lower = step.toLowerCase()
      const clean = lower.replace(/[^\w\s]/g, ' ')
      const tokens = tokenize(clean)
      const tokenSet = new Set(tokens)
      const synonymSet = new Set<string>()
      tokens.forEach((token) => {
        expandSynonyms(token).forEach((synonym) => synonymSet.add(synonym))
      })
      steps.push({
        id: `step-${counter}`,
        text: step,
        tokens,
        tokenSet,
        synonymSet,
        phrases: buildPhrases(tokens),
        section: group.section,
      })
      counter += 1
    })
  })
  return steps
}

function computeConfidence(
  matchedTokens: number,
  totalTokens: number,
  hasHeadNoun: boolean,
  hasPhrase: boolean,
  usedSynonym: boolean,
  usedFuzzy: boolean,
  hasUniqueHead: boolean,
  weightCoverage: number,
): number {
  if (totalTokens === 0) return 0
  const coverage = matchedTokens / totalTokens
  let confidence = coverage * 0.45 + weightCoverage * 0.25 + matchedTokens * 0.07
  if (hasHeadNoun) confidence += 0.18
  if (hasPhrase) confidence += 0.15
  if (usedSynonym) confidence += 0.05
  if (usedFuzzy) confidence += 0.05
  if (hasUniqueHead) confidence += 0.05
  return Math.min(1, confidence)
}

export type CandidateFeatures = {
  overlapRatio: number
  weightCoverage: number
  hasHeadNoun: number
  phraseHit: number
  synonymHit: number
  fuzzyHit: number
  uniqueHead: number
  tokenCount: number
  sectionAlign: number
  seasoning: number
}

export function buildCandidateFeatures(
  ingredient: ProcessedIngredient,
  step: StepFeatures,
  {
    matchedTokens,
    matchedWeight,
    hasHeadNoun,
    phraseMatch,
    usedSynonym,
    usedFuzzy,
    hasUniqueHead,
    sectionAligned,
    isSeasoning,
  }: {
    matchedTokens: number
    matchedWeight: number
    hasHeadNoun: boolean
    phraseMatch: boolean
    usedSynonym: boolean
    usedFuzzy: boolean
    hasUniqueHead: boolean
    sectionAligned: boolean
    isSeasoning: boolean
  },
): CandidateFeatures {
  const overlapRatio = ingredient.tokens.length > 0 ? matchedTokens / ingredient.tokens.length : 0
  const weightCoverage = ingredient.totalWeight > 0 ? matchedWeight / ingredient.totalWeight : 0
  return {
    overlapRatio,
    weightCoverage,
    hasHeadNoun: hasHeadNoun ? 1 : 0,
    phraseHit: phraseMatch ? 1 : 0,
    synonymHit: usedSynonym ? 1 : 0,
    fuzzyHit: usedFuzzy ? 1 : 0,
    uniqueHead: hasUniqueHead ? 1 : 0,
    tokenCount: ingredient.tokens.length,
    sectionAlign: sectionAligned ? 1 : 0,
    seasoning: isSeasoning ? 1 : 0,
  }
}

export function normalizeIngredientGroups(groups: IngredientGroup[]): IngredientGroup[] {
  return groups.map((group) => {
    const rawSection = group.section?.trim() || ''
    const cleanedSection = rawSection.replace(/^section\s*:\s*/i, '').trim()
    let normalizedSection = cleanedSection.replace(/[:.]\s*$/, '').trim()
    if (/^ingredients?$/i.test(normalizedSection)) {
      normalizedSection = ''
    }
    const cleanedItems = (group.items || [])
      .map((item) => (item || '').trim())
      .filter((item) => item.length > 0)
      .filter((item) => {
        if (!normalizedSection) return true
        return item.trim().toLowerCase() !== normalizedSection.toLowerCase()
      })

    return { section: normalizedSection ? cleanedSection : '', items: cleanedItems }
  })
}

export function normalizeInstructionGroups(groups: InstructionGroup[]): InstructionGroup[] {
  const result: InstructionGroup[] = []

  const looksLikeHeading = (value: string): string | null => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const noPunct = trimmed.replace(/[.:]+$/, '')
    const tokens = noPunct.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return null
    const allCaps = noPunct === noPunct.toUpperCase()
    const short = tokens.length <= 6
    if ((allCaps && short) || /:$/.test(trimmed)) {
      return noPunct
    }
    return null
  }

  groups.forEach((group) => {
    const rawSection = group.section?.trim() || ''
    const cleanedSection = rawSection.replace(/^section\s*:\s*/i, '').trim()
    let normalizedSection = cleanedSection.replace(/[:.]\s*$/, '').trim()
    if (/^(instructions?|directions?)$/i.test(normalizedSection)) {
      normalizedSection = ''
    }

    let currentSection = normalizedSection ? cleanedSection : ''
    let currentSteps: string[] = []

    const flush = () => {
      if (currentSteps.length === 0) return
      result.push({ section: currentSection, steps: currentSteps })
      currentSteps = []
    }

    (group.steps || []).forEach((step) => {
      const trimmedStep = (step || '').trim()
      if (!trimmedStep) return
      if (!currentSection && trimmedStep.toLowerCase() === normalizedSection.toLowerCase()) return

      const heading = looksLikeHeading(trimmedStep)
      if (heading) {
        flush()
        currentSection = heading
        return
      }

      currentSteps.push(trimmedStep)
    })

    flush()
  })

  return result
}

export function mapIngredientsToSteps(
  ingredients: IngredientGroup[],
  instructions: InstructionGroup[],
  options?: IngredientMatcherOptions,
): Record<string, string[]> {
  const processedIngredients = buildProcessedIngredients(ingredients)
  const headCounts = new Map<string, number>()
  processedIngredients.forEach((ingredient) => {
    if (!ingredient.headNoun) return
    headCounts.set(ingredient.headNoun, (headCounts.get(ingredient.headNoun) || 0) + 1)
  })
  const steps = buildStepFeatures(instructions)
  const minConfidence = options?.minConfidence ?? 0.35
  const learnedModel = (options?.useLearnedModel ?? false) ? loadLearnedModel() : null

  const mapping: Record<string, string[]> = {}

  steps.forEach((step) => {
    const matches: { id: string; confidence: number }[] = []
    processedIngredients.forEach((ingredient) => {
      if (!sectionsAlign(step.section, ingredient.section)) {
        return
      }
      const isSeasoning = ingredient.tokens.some((token) => SEASONING_TOKENS.has(token))
      const tokenCount = ingredient.tokens.length

      let matchedTokens = 0
      let hasHeadNoun = false
      let usedSynonym = false
      let usedFuzzy = false
      let matchedWeight = 0

      ingredient.tokens.forEach((token) => {
        if (step.tokenSet.has(token) || step.synonymSet.has(token)) {
          matchedTokens += 1
          matchedWeight += ingredient.tokenWeights.get(token) || 0
          if (ingredient.headNoun === token || SEASONING_TOKENS.has(token)) {
            hasHeadNoun = true
          }
        } else {
          const synonyms = expandSynonyms(token)
          if (synonyms.some((synonym) => step.tokenSet.has(synonym))) {
            matchedTokens += 1
            matchedWeight += ingredient.tokenWeights.get(token) || 0
            usedSynonym = true
          if (
            (ingredient.headNoun && synonyms.includes(ingredient.headNoun)) ||
            SEASONING_TOKENS.has(token)
          ) {
            hasHeadNoun = true
          }
        } else if (!SEASONING_TOKENS.has(token) && fuzzyTokenHit(token, step.tokens)) {
          matchedTokens += 1
          matchedWeight += ingredient.tokenWeights.get(token) || 0
          usedFuzzy = true
          if (ingredient.headNoun === token || SEASONING_TOKENS.has(token)) {
            hasHeadNoun = true
            }
          }
        }
      })

      if (!hasHeadNoun && ingredient.headNoun) {
        if (step.tokenSet.has(ingredient.headNoun) || step.synonymSet.has(ingredient.headNoun)) {
          hasHeadNoun = true
        } else if (expandSynonyms(ingredient.headNoun).some((synonym) => step.tokenSet.has(synonym))) {
          hasHeadNoun = true
          usedSynonym = true
        }
      }

      const phraseMatch =
        ingredient.phrases.length > 0 &&
        ingredient.phrases.some((phrase) => {
          const phraseRegex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i')
          return phraseRegex.test(step.text.toLowerCase())
        })

      if (matchedTokens === 0 && phraseMatch) {
        matchedTokens = 1
        matchedWeight += ingredient.tokenWeights.get(ingredient.tokens[0]) || 0
      }

      const sectionAligned = sectionsAlign(step.section, ingredient.section)
      const features = buildCandidateFeatures(ingredient, step, {
        matchedTokens,
        matchedWeight,
        hasHeadNoun,
        phraseMatch,
        usedSynonym,
        usedFuzzy,
        hasUniqueHead: ingredient.headNoun ? headCounts.get(ingredient.headNoun) === 1 : false,
        sectionAligned,
        isSeasoning,
      })

      const confidence = learnedModel
        ? 1 / (1 + Math.exp(-scoreWithModel(features, learnedModel)))
        : computeConfidence(
            matchedTokens,
            ingredient.tokens.length,
            hasHeadNoun,
            phraseMatch,
            usedSynonym,
            usedFuzzy,
            ingredient.headNoun ? headCounts.get(ingredient.headNoun) === 1 : false,
            ingredient.totalWeight ? matchedWeight / ingredient.totalWeight : 0,
          )

      let threshold = minConfidence
      if (isSeasoning) {
        threshold = minConfidence * 0.5
      } else if (tokenCount <= 3) {
        threshold = Math.max(0.2, minConfidence - 0.15)
      } else if (tokenCount <= 5) {
        threshold = minConfidence - 0.05
      }
      if (phraseMatch) {
        threshold -= 0.05
      }

      if (confidence >= threshold && matchedTokens > 0) {
        matches.push({ id: ingredient.id, confidence })
      }
    })

    matches.sort((a, b) => b.confidence - a.confidence)
    if (matches.length === 0) {
      // Fallback: relaxed overlap (no section gating, lower threshold)
      const stepTokens = new Set(step.tokens)
      const fallback: { id: string; score: number }[] = []
      processedIngredients.forEach((ingredient) => {
        let overlap = 0
        ingredient.tokens.forEach((t) => {
          if (t.length <= 2) return
          if (stepTokens.has(t)) {
            overlap += 1
          }
        })
        const ratio = ingredient.tokens.length ? overlap / ingredient.tokens.length : 0
        if (ratio >= 0.2) {
          fallback.push({ id: ingredient.id, score: ratio })
        }
      })
      fallback.sort((a, b) => b.score - a.score)
      mapping[step.id] = fallback.slice(0, 5).map((f) => f.id)
    } else {
      mapping[step.id] = matches.map((match) => match.id)
    }
  })

  return mapping
}
