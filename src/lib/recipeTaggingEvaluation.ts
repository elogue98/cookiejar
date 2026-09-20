import { z } from 'zod'

import {
  isRecipeTag,
  RECIPE_TAG_TAXONOMY,
  type RecipeTag,
} from '@/lib/recipeTagTaxonomy'

export type RecipeTagEvaluationCase = {
  id: string
  title: string
  ingredients: string[]
  instructions: string
  expectedTags: RecipeTag[]
}

export type RecipeTagFixtureReference = {
  id: string
  fixture: string
  expectedTags: RecipeTag[]
}

export type RecipeTagEvaluationPrediction = {
  tags: string[]
  status?: 'matched' | 'uncertain' | 'no_match' | 'unavailable'
  source?: 'keyword-fallback' | 'openai' | 'typesafe'
  probabilities?: Record<string, number>
  unavailableReason?: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  latencyMs?: number
  model?: string
}

export type TagMetrics = {
  precision: number
  recall: number
  f1: number
  support: number
}

export type RecipeTaggingMetrics = {
  totalCases: number
  scoredCases: number
  micro: Omit<TagMetrics, 'support'>
  macro: Omit<TagMetrics, 'support'>
  perTag: Record<string, TagMetrics>
  exactSetMatchRate: number
  meanJaccard: number
  outOfTaxonomyRate: number
  availabilityRate: number
  coverageRate: number
  abstentionRate: number
  selectivePrecision: number | null
  brierScore: number | null
  outcomeCounts: Record<'matched' | 'uncertain' | 'no_match' | 'unavailable', number>
  unavailableReasons: Record<string, number>
  latencyMs: { p50: number | null; p95: number | null }
  totalInputTokens: number
  totalOutputTokens: number
  models: string[]
  sourceCounts: Record<string, number>
  contradictoryCaseCount: number
  contradictoryCaseRate: number
}

const recipeTagEvaluationCaseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    ingredients: z.array(z.string()),
    instructions: z.string(),
    expectedTags: z.array(z.string()).refine(
      (tags) => tags.every(isRecipeTag),
      'expectedTags must use only the frozen recipe-tag taxonomy',
    ),
  })
  .strict()
  .transform((value) => ({ ...value, expectedTags: value.expectedTags as RecipeTag[] }))

export function parseRecipeTagEvaluationCases(value: unknown): RecipeTagEvaluationCase[] {
  return z.array(recipeTagEvaluationCaseSchema).parse(value)
}

const recipeTagFixtureReferenceSchema = z
  .object({
    id: z.string().min(1),
    fixture: z.string().min(1),
    expectedTags: z.array(z.string()).refine(
      (tags) => tags.every(isRecipeTag),
      'expectedTags must use only the frozen recipe-tag taxonomy',
    ),
  })
  .strict()
  .transform((value) => ({ ...value, expectedTags: value.expectedTags as RecipeTag[] }))

export function parseRecipeTagFixtureReferences(value: unknown): RecipeTagFixtureReference[] {
  return z.array(recipeTagFixtureReferenceSchema).parse(value)
}

const CONTRADICTORY_TAG_PAIRS = [
  ['vegetarian', 'chicken'],
  ['vegetarian', 'beef'],
  ['vegetarian', 'pork'],
  ['vegetarian', 'fish'],
  ['vegetarian', 'salmon'],
  ['vegetarian', 'shrimp'],
  ['vegan', 'chicken'],
  ['vegan', 'beef'],
  ['vegan', 'pork'],
  ['vegan', 'fish'],
  ['vegan', 'salmon'],
  ['vegan', 'shrimp'],
  ['vegan', 'cheese'],
  ['dairy-free', 'cheese'],
] as const

export function findContradictoryRecipeTags(tags: readonly string[]): Array<[string, string]> {
  const normalized = new Set(normalizeTags(tags))
  return CONTRADICTORY_TAG_PAIRS.filter(([first, second]) => normalized.has(first) && normalized.has(second))
    .map(([first, second]) => [first, second])
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

function f1(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)
  return sorted[index]
}

function normalizeTags(tags: readonly string[]): string[] {
  return Array.from(
    new Set(tags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean)),
  )
}

export function calculateRecipeTaggingMetrics(
  cases: readonly RecipeTagEvaluationCase[],
  predictions: readonly RecipeTagEvaluationPrediction[],
): RecipeTaggingMetrics {
  if (cases.length !== predictions.length) {
    throw new Error(`Expected one prediction per case, got ${predictions.length} for ${cases.length} cases`)
  }

  let totalTruePositive = 0
  let totalFalsePositive = 0
  let totalFalseNegative = 0
  let exactMatches = 0
  let jaccardTotal = 0
  let scoredCases = 0
  let predictedTagCount = 0
  let outOfTaxonomyCount = 0
  let availableCases = 0
  let coveredCases = 0
  let uncertainCases = 0
  let selectiveTruePositive = 0
  let selectivePredicted = 0
  let brierTotal = 0
  let brierCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  const latencies: number[] = []
  const models = new Set<string>()
  const sourceCounts: Record<string, number> = {}
  const outcomeCounts = { matched: 0, uncertain: 0, no_match: 0, unavailable: 0 }
  const unavailableReasons: Record<string, number> = {}
  let contradictoryCaseCount = 0

  const perTagCounts: Record<string, { tp: number; fp: number; fn: number }> = Object.fromEntries(
    RECIPE_TAG_TAXONOMY.map((tag) => [tag, { tp: 0, fp: 0, fn: 0 }]),
  )

  cases.forEach((evaluationCase, index) => {
    const prediction = predictions[index]
    if (prediction.source) sourceCounts[prediction.source] = (sourceCounts[prediction.source] ?? 0) + 1
    if (prediction.status) outcomeCounts[prediction.status] += 1
    if (prediction.latencyMs !== undefined && Number.isFinite(prediction.latencyMs)) {
      latencies.push(prediction.latencyMs)
    }
    if (prediction.status === 'unavailable') {
      const reason = prediction.unavailableReason ?? 'unknown'
      unavailableReasons[reason] = (unavailableReasons[reason] ?? 0) + 1
      return
    }

    scoredCases += 1
    if (prediction.model) models.add(prediction.model)
    if (prediction.usage) {
      totalInputTokens += prediction.usage.input_tokens
      totalOutputTokens += prediction.usage.output_tokens
    }

    const expected = new Set(normalizeTags(evaluationCase.expectedTags))
    const predicted = normalizeTags(prediction.tags)
    const predictedSet = new Set(predicted)
    if (findContradictoryRecipeTags(predicted).length > 0) contradictoryCaseCount += 1
    const truePositive = predicted.filter((tag) => expected.has(tag)).length
    const falsePositive = predicted.filter((tag) => !expected.has(tag)).length
    const falseNegative = Array.from(expected).filter((tag) => !predictedSet.has(tag)).length
    totalTruePositive += truePositive
    totalFalsePositive += falsePositive
    totalFalseNegative += falseNegative
    predictedTagCount += predicted.length
    outOfTaxonomyCount += predicted.filter((tag) => !isRecipeTag(tag)).length

    if (predictedSet.size === expected.size && Array.from(predictedSet).every((tag) => expected.has(tag))) {
      exactMatches += 1
    }
    const unionSize = new Set([...expected, ...predictedSet]).size
    jaccardTotal += unionSize === 0 ? 1 : ratio(truePositive, unionSize)

    RECIPE_TAG_TAXONOMY.forEach((tag) => {
      const expectedPositive = expected.has(tag)
      const predictedPositive = predictedSet.has(tag)
      if (expectedPositive && predictedPositive) perTagCounts[tag].tp += 1
      if (!expectedPositive && predictedPositive) perTagCounts[tag].fp += 1
      if (expectedPositive && !predictedPositive) perTagCounts[tag].fn += 1
    })

    availableCases += 1
    if (prediction.status !== 'uncertain') coveredCases += 1
    if (prediction.status === 'uncertain') uncertainCases += 1
    if (prediction.status === undefined || prediction.status === 'matched') {
      selectiveTruePositive += truePositive
      selectivePredicted += predicted.length
    }

    if (prediction.probabilities) {
      Object.entries(prediction.probabilities).forEach(([tag, probability]) => {
        if (!isRecipeTag(tag) || !Number.isFinite(probability)) return
        brierTotal += (probability - (expected.has(tag) ? 1 : 0)) ** 2
        brierCount += 1
      })
    }
  })

  const microPrecision = ratio(totalTruePositive, totalTruePositive + totalFalsePositive)
  const microRecall = ratio(totalTruePositive, totalTruePositive + totalFalseNegative)
  const perTag: Record<string, TagMetrics> = {}
  RECIPE_TAG_TAXONOMY.forEach((tag) => {
    const counts = perTagCounts[tag]
    const precision = ratio(counts.tp, counts.tp + counts.fp)
    const recall = ratio(counts.tp, counts.tp + counts.fn)
    perTag[tag] = {
      precision,
      recall,
      f1: f1(precision, recall),
      support: counts.tp + counts.fn,
    }
  })

  const supportedMetrics = Object.values(perTag).filter((metric) => metric.support > 0)
  const macroPrecision = supportedMetrics.length
    ? supportedMetrics.reduce((sum, metric) => sum + metric.precision, 0) / supportedMetrics.length
    : 0
  const macroRecall = supportedMetrics.length
    ? supportedMetrics.reduce((sum, metric) => sum + metric.recall, 0) / supportedMetrics.length
    : 0
  const macroF1 = supportedMetrics.length
    ? supportedMetrics.reduce((sum, metric) => sum + metric.f1, 0) / supportedMetrics.length
    : 0

  return {
    totalCases: cases.length,
    scoredCases,
    micro: {
      precision: microPrecision,
      recall: microRecall,
      f1: f1(microPrecision, microRecall),
    },
    macro: {
      precision: macroPrecision,
      recall: macroRecall,
      f1: macroF1,
    },
    perTag,
    exactSetMatchRate: ratio(exactMatches, scoredCases),
    meanJaccard: ratio(jaccardTotal, scoredCases),
    outOfTaxonomyRate: ratio(outOfTaxonomyCount, predictedTagCount),
    availabilityRate: ratio(availableCases, cases.length),
    coverageRate: ratio(coveredCases, cases.length),
    abstentionRate: ratio(uncertainCases, availableCases),
    selectivePrecision: selectivePredicted === 0 ? null : selectiveTruePositive / selectivePredicted,
    brierScore: brierCount === 0 ? null : brierTotal / brierCount,
    outcomeCounts,
    unavailableReasons,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    totalInputTokens,
    totalOutputTokens,
    models: Array.from(models),
    sourceCounts,
    contradictoryCaseCount,
    contradictoryCaseRate: ratio(contradictoryCaseCount, scoredCases),
  }
}
