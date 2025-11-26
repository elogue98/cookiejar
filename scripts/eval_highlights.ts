#!/usr/bin/env node
/**
 * Dataset evaluation runner. Prints aggregate precision/recall metrics for the
 * highlight matcher using labeled recipes found under
 * `data/ingredient_highlights` by default.
 *
 * Usage:
 *   npm run eval:highlights
 *   npm run eval:highlights data/ingredient_highlights -- --json
 */
import path from 'node:path'
import process from 'node:process'

import { evaluateHighlightDir } from '../src/lib/highlightEvaluation'

const args = process.argv.slice(2)
let datasetDir = path.resolve(process.cwd(), 'data/ingredient_highlights')
let emitJson = false

args.forEach((arg) => {
  if (arg === '--json') {
    emitJson = true
  } else {
    datasetDir = path.resolve(process.cwd(), arg)
  }
})

try {
  const result = evaluateHighlightDir(datasetDir)
  if (emitJson) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }

  console.log(`Evaluated ${result.aggregate.totalRecipes} labeled recipes from ${datasetDir}`)
  if (result.aggregate.skippedUnlabeled > 0) {
    console.log(`Skipped ${result.aggregate.skippedUnlabeled} unlabeled recipes (expectedMatches empty).`)
  }
  console.log('')
  console.log('Per-recipe metrics:')
  result.samples.forEach((sample) => {
    const pct = (value: number) => `${(value * 100).toFixed(1)}%`
    console.log(
      `- ${sample.title || sample.id}: P=${pct(sample.precision)} R=${pct(sample.recall)} F1=${pct(sample.f1)} (TP=${sample.tp}, FP=${sample.fp}, FN=${sample.fn})`,
    )
  })

  const pct = (value: number) => `${(value * 100).toFixed(1)}%`
  console.log('\nAggregate:')
  console.log(`  Macro Precision: ${pct(result.aggregate.macroPrecision)}`)
  console.log(`  Macro Recall:    ${pct(result.aggregate.macroRecall)}`)
  console.log(`  Macro F1:        ${pct(result.aggregate.macroF1)}`)
  console.log(`  Micro Precision: ${pct(result.aggregate.microPrecision)}`)
  console.log(`  Micro Recall:    ${pct(result.aggregate.microRecall)}`)
  console.log(`  Micro F1:        ${pct(result.aggregate.microF1)}`)
  console.log(
    `  Totals: TP=${result.aggregate.totalTP}, FP=${result.aggregate.totalFP}, FN=${result.aggregate.totalFN}`,
  )
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
