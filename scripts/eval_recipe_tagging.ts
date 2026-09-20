#!/usr/bin/env node
/**
 * Evaluates the frozen recipe-tagging experiment on synthetic, hand-labeled
 * fixtures. TypeSafe calls require --live; the default path is local-only.
 *
 * Usage:
 *   npm run eval:recipe-tags
 *   npm run eval:recipe-tags -- --include-repo
 *   npm run eval:recipe-tags -- --live
 *   npm run eval:recipe-tags -- --include-repo --current-ai --live --json
 */
import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { z } from 'zod'

import {
  generateKeywordTagsForRecipe,
  generateTagsForRecipeForEvaluation,
} from '../src/lib/aiTagging'
import {
  calculateRecipeTaggingMetrics,
  parseRecipeTagEvaluationCases,
  parseRecipeTagFixtureReferences,
  type RecipeTagEvaluationCase,
  type RecipeTagEvaluationPrediction,
} from '../src/lib/recipeTaggingEvaluation'
import {
  classifyTypeSafeProbabilities,
  normalizeRecipeTaggingState,
  projectTagsToRecipeTaxonomy,
  TYPE_SAFE_TAG_THRESHOLDS,
  type TypeSafeThresholds,
} from '../src/lib/typesafeRecipeTagging'
import { evaluateRecipeTagsWithTypeSafe } from '../src/lib/typesafeRecipeTaggingServer'

const args = process.argv.slice(2)
const runLive = args.includes('--live')
const runCurrentAi = args.includes('--current-ai')
const includeRepositoryFixtures = args.includes('--include-repo')
const emitJson = args.includes('--json')
const datasetPath = path.resolve(process.cwd(), 'data/recipe_tagging/evaluation.json')
const repositoryManifestPath = path.resolve(process.cwd(), 'data/recipe_tagging/repository_cases.json')
const repositoryFixtureDir = path.resolve(process.cwd(), 'data/ingredient_highlights')

const recipeHighlightFixtureSchema = z.object({
  title: z.string().optional(),
  ingredients: z.array(z.object({ items: z.array(z.string()) })),
  instructions: z.array(z.object({ steps: z.array(z.string()) })),
})

function loadCases(): RecipeTagEvaluationCase[] {
  const parsed = JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as unknown
  const syntheticCases = parseRecipeTagEvaluationCases(parsed)
  if (!includeRepositoryFixtures) return syntheticCases

  const manifest = parseRecipeTagFixtureReferences(
    JSON.parse(fs.readFileSync(repositoryManifestPath, 'utf8')) as unknown,
  )
  const repositoryCases = manifest.map((reference) => {
    if (path.basename(reference.fixture) !== reference.fixture) {
      throw new Error(`Repository fixture must be a file name: ${reference.fixture}`)
    }
    const fixturePath = path.join(repositoryFixtureDir, reference.fixture)
    const fixture = recipeHighlightFixtureSchema.parse(
      JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as unknown,
    )
    return {
      id: reference.id,
      title: fixture.title ?? reference.id,
      ingredients: fixture.ingredients.flatMap((group) => group.items),
      instructions: fixture.instructions.flatMap((group) => group.steps).join(' '),
      expectedTags: reference.expectedTags,
    }
  })

  return [...repositoryCases, ...syntheticCases]
}

function inputFor(evaluationCase: RecipeTagEvaluationCase) {
  return normalizeRecipeTaggingState({
    title: evaluationCase.title,
    ingredients: evaluationCase.ingredients,
    instructions: evaluationCase.instructions,
  })
}

function printMetrics(label: string, metrics: ReturnType<typeof calculateRecipeTaggingMetrics>) {
  const pct = (value: number | null) => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`)
  console.log(label)
  console.log(`  Micro P/R/F1: ${pct(metrics.micro.precision)} / ${pct(metrics.micro.recall)} / ${pct(metrics.micro.f1)}`)
  console.log(`  Macro P/R/F1: ${pct(metrics.macro.precision)} / ${pct(metrics.macro.recall)} / ${pct(metrics.macro.f1)}`)
  console.log(`  Exact set: ${pct(metrics.exactSetMatchRate)}  Jaccard: ${pct(metrics.meanJaccard)}`)
  console.log(`  OOV: ${pct(metrics.outOfTaxonomyRate)}  Availability: ${pct(metrics.availabilityRate)}`)
  console.log(`  Coverage: ${pct(metrics.coverageRate)}  Abstention: ${pct(metrics.abstentionRate)}`)
  console.log(`  Selective precision: ${pct(metrics.selectivePrecision)}  Brier: ${metrics.brierScore?.toFixed(4) ?? 'n/a'}`)
  console.log(`  Outcomes: ${JSON.stringify(metrics.outcomeCounts)}  Unavailable: ${JSON.stringify(metrics.unavailableReasons)}`)
  console.log(`  Sources: ${JSON.stringify(metrics.sourceCounts)}`)
  console.log(`  Latency p50/p95: ${metrics.latencyMs.p50?.toFixed(1) ?? 'n/a'} / ${metrics.latencyMs.p95?.toFixed(1) ?? 'n/a'} ms  Tokens: ${metrics.totalInputTokens} in / ${metrics.totalOutputTokens} out`)
  console.log(`  Contradictory cases: ${metrics.contradictoryCaseCount} (${pct(metrics.contradictoryCaseRate)})`)
  if (metrics.models.length > 0) console.log(`  Models: ${metrics.models.join(', ')}`)
}

type TypeSafeRun = {
  result: Awaited<ReturnType<typeof evaluateRecipeTagsWithTypeSafe>>
  latencyMs: number
}

function predictionFromTypeSafeRun(
  run: TypeSafeRun,
  thresholds: TypeSafeThresholds = TYPE_SAFE_TAG_THRESHOLDS,
): RecipeTagEvaluationPrediction {
  if (run.result.source === 'unavailable') {
    return {
      source: 'typesafe',
      tags: [],
      status: 'unavailable',
      unavailableReason: run.result.reason,
      latencyMs: run.latencyMs,
    }
  }

  const decision = classifyTypeSafeProbabilities(run.result.probabilities, thresholds)
  return {
    source: 'typesafe',
    tags: decision.tags,
    status: decision.status,
    probabilities: run.result.probabilities,
    usage: run.result.usage,
    latencyMs: run.latencyMs,
    model: run.result.model,
  }
}

async function main() {
  if (runCurrentAi && !runLive) {
    throw new Error('--current-ai requires --live because it calls the external OpenAI service')
  }
  if (runCurrentAi && !process.env.OPENAI_API_KEY) {
    throw new Error('--current-ai requires OPENAI_API_KEY; refusing to label keyword fallback as OpenAI output')
  }

  const cases = loadCases()
  const baselinePredictions: RecipeTagEvaluationPrediction[] = runCurrentAi
    ? await Promise.all(
        cases.map(async (evaluationCase) => {
          const result = await generateTagsForRecipeForEvaluation(inputFor(evaluationCase))
          return result.source === 'openai'
            ? { source: 'openai' as const, tags: result.tags }
            : { source: 'openai' as const, tags: [], status: 'unavailable' as const, unavailableReason: result.reason }
        }),
      )
    : cases.map((evaluationCase) => ({
        source: 'keyword-fallback' as const,
        tags: generateKeywordTagsForRecipe(inputFor(evaluationCase)),
      }))
  const projectedBaselinePredictions = baselinePredictions.map((prediction) => ({
    ...prediction,
    tags: projectTagsToRecipeTaxonomy(prediction.tags),
  }))

  if (!runLive) {
    const output = {
      dataset: datasetPath,
      cases: cases.length,
      baseline: calculateRecipeTaggingMetrics(cases, baselinePredictions),
      projectedBaseline: calculateRecipeTaggingMetrics(cases, projectedBaselinePredictions),
      typesafe: null,
      baselineMode: runCurrentAi ? 'current-ai' : 'keyword-fallback',
      includeRepositoryFixtures,
      note: runCurrentAi
        ? 'TypeSafe was not called. Add --live to collect TypeSafe metrics on the same synthetic fixtures.'
        : 'TypeSafe and the OpenAI-backed current tagger were not called. Add --current-ai and/or --live explicitly.',
    }
    if (emitJson) {
      console.log(JSON.stringify(output, null, 2))
      return
    }
    console.log(`Evaluated ${cases.length} recipe-tagging cases (${includeRepositoryFixtures ? 'repository fixtures + synthetic controls' : 'synthetic controls'})`)
    printMetrics('Current keyword fallback (raw output)', output.baseline)
    printMetrics('Current keyword fallback (taxonomy-projected)', output.projectedBaseline)
    console.log(`\nTypeSafe was not called. Add --live to collect API metrics on these synthetic fixtures.`)
    return
  }

  const typeSafeRuns: TypeSafeRun[] = []
  for (const evaluationCase of cases) {
    const startedAt = performance.now()
    const result = await evaluateRecipeTagsWithTypeSafe(inputFor(evaluationCase))
    typeSafeRuns.push({ result, latencyMs: performance.now() - startedAt })
  }

  const typeSafePredictions = typeSafeRuns.map((run) => predictionFromTypeSafeRun(run))
  const thresholdSweeps = [0.7, 0.8, 0.9].map((accept) => {
    const thresholds = { accept, reject: 1 - accept }
    return {
      thresholds,
      metrics: calculateRecipeTaggingMetrics(
        cases,
        typeSafeRuns.map((run) => predictionFromTypeSafeRun(run, thresholds)),
      ),
    }
  })

  const output = {
    dataset: datasetPath,
    cases: cases.length,
    baseline: calculateRecipeTaggingMetrics(cases, baselinePredictions),
    projectedBaseline: calculateRecipeTaggingMetrics(cases, projectedBaselinePredictions),
    typesafe: calculateRecipeTaggingMetrics(cases, typeSafePredictions),
    thresholdSweeps,
    baselineMode: runCurrentAi ? 'current-ai' : 'keyword-fallback',
    includeRepositoryFixtures,
    typeSafeThresholds: TYPE_SAFE_TAG_THRESHOLDS,
  }
  if (emitJson) {
    console.log(JSON.stringify(output, null, 2))
    return
  }

  console.log(`Evaluated ${cases.length} recipe-tagging cases (${includeRepositoryFixtures ? 'repository fixtures + synthetic controls' : 'synthetic controls'})`)
  printMetrics('Current keyword fallback (raw output)', output.baseline)
  printMetrics('Current keyword fallback (taxonomy-projected)', output.projectedBaseline)
  printMetrics('TypeSafe (thresholded Noul output)', output.typesafe)
  thresholdSweeps.forEach((sweep) => {
    console.log(`\nTypeSafe threshold sweep accept=${sweep.thresholds.accept.toFixed(2)} reject=${sweep.thresholds.reject.toFixed(2)}`)
    printMetrics('TypeSafe sweep', sweep.metrics)
  })
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
