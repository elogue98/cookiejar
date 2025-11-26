/**
 * Utility helpers for evaluating ingredient highlighting accuracy against a
 * labeled dataset stored under `data/ingredient_highlights`.
 *
 * Node-only module – prefer using via the CLI in `scripts/eval_highlights.ts`.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  mapIngredientsToSteps,
  normalizeIngredientGroups,
  normalizeInstructionGroups,
  type IngredientGroup,
  type InstructionGroup,
} from './ingredientMatcher'

export interface HighlightSample {
  id: string
  title?: string
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
  expectedMatches: Record<string, string[]>
}

export interface RecipeMetrics {
  id: string
  title?: string
  totalSteps: number
  tp: number
  fp: number
  fn: number
  precision: number
  recall: number
  f1: number
}

export interface EvaluationResult {
  samples: RecipeMetrics[]
  aggregate: {
    totalRecipes: number
    macroPrecision: number
    macroRecall: number
    macroF1: number
    microPrecision: number
    microRecall: number
    microF1: number
    totalTP: number
    totalFP: number
    totalFN: number
    skippedUnlabeled: number
  }
}

const safeDivide = (numerator: number, denominator: number) => {
  if (denominator === 0) return numerator === 0 ? 1 : 0
  return numerator / denominator
}

const calculateF1 = (precision: number, recall: number) => {
  const denom = precision + recall
  if (denom === 0) return 0
  return (2 * precision * recall) / denom
}

export function loadHighlightSamples(datasetDir: string): HighlightSample[] {
  const resolvedDir = path.resolve(datasetDir)
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Dataset directory not found: ${resolvedDir}`)
  }

  const files = fs
    .readdirSync(resolvedDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(resolvedDir, file))

  return files.map((filePath) => {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return {
      ...payload,
      expectedMatches: payload.expectedMatches || {},
    } as HighlightSample
  })
}

export function evaluateSamples(samples: HighlightSample[]): EvaluationResult {
  const recipeMetrics: RecipeMetrics[] = []
  let totalTP = 0
  let totalFP = 0
  let totalFN = 0

  samples.forEach((sample) => {
    const ingredients = normalizeIngredientGroups(sample.ingredients)
    const instructions = normalizeInstructionGroups(sample.instructions)
    const predicted = mapIngredientsToSteps(ingredients, instructions)
    let tp = 0
    let fp = 0
    let fn = 0

    const allStepIds = new Set([
      ...Object.keys(sample.expectedMatches || {}),
      ...Object.keys(predicted),
    ])

    allStepIds.forEach((stepId) => {
      const gt = new Set(sample.expectedMatches?.[stepId] || [])
      const guess = new Set(predicted[stepId] || [])

      guess.forEach((id) => {
        if (gt.has(id)) {
          tp++
        } else {
          fp++
        }
      })

      gt.forEach((id) => {
        if (!guess.has(id)) {
          fn++
        }
      })
    })

    const precision = safeDivide(tp, tp + fp)
    const recall = safeDivide(tp, tp + fn)
    const f1 = calculateF1(precision, recall)

    totalTP += tp
    totalFP += fp
    totalFN += fn

    recipeMetrics.push({
      id: sample.id,
      title: sample.title,
      totalSteps: sample.instructions.reduce((sum, group) => sum + group.steps.length, 0),
      tp,
      fp,
      fn,
      precision,
      recall,
      f1,
    })
  })

  const macroPrecision = safeDivide(
    recipeMetrics.reduce((sum, r) => sum + r.precision, 0),
    recipeMetrics.length,
  )
  const macroRecall = safeDivide(
    recipeMetrics.reduce((sum, r) => sum + r.recall, 0),
    recipeMetrics.length,
  )

  const macroF1 = calculateF1(macroPrecision, macroRecall)
  const microPrecision = safeDivide(totalTP, totalTP + totalFP)
  const microRecall = safeDivide(totalTP, totalTP + totalFN)
  const microF1 = calculateF1(microPrecision, microRecall)

  return {
    samples: recipeMetrics,
    aggregate: {
      totalRecipes: recipeMetrics.length,
      macroPrecision,
      macroRecall,
      macroF1,
      microPrecision,
      microRecall,
      microF1,
      totalTP,
      totalFP,
      totalFN,
      skippedUnlabeled: 0,
    },
  }
}

export function evaluateHighlightDir(datasetDir: string): EvaluationResult {
  const samples = loadHighlightSamples(datasetDir)
  const labeled = samples.filter(
    (sample) => sample.expectedMatches && Object.keys(sample.expectedMatches).length > 0,
  )

  if (labeled.length === 0) {
    return {
      samples: [],
      aggregate: {
        totalRecipes: 0,
        macroPrecision: 0,
        macroRecall: 0,
        macroF1: 0,
        microPrecision: 0,
        microRecall: 0,
        microF1: 0,
        totalTP: 0,
        totalFP: 0,
        totalFN: 0,
        skippedUnlabeled: samples.length,
      },
    }
  }

  const result = evaluateSamples(labeled)
  result.aggregate.skippedUnlabeled = samples.length - labeled.length
  return result
}
