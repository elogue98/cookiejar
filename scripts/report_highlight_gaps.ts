#!/usr/bin/env node
/**
 * Quick QA report to spot weak highlight coverage in the dataset.
 *
 * Usage:
 *   npm run report:highlights            # scans data/ingredient_highlights
 *   npm run report:highlights path/to/dir
 *
 * It prints per-recipe stats:
 * - steps with zero predicted matches
 * - ingredients that never get matched anywhere
 * - optional JSON output with --json
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  mapIngredientsToSteps,
  normalizeIngredientGroups,
  normalizeInstructionGroups,
  type IngredientGroup,
  type InstructionGroup,
} from '../src/lib/ingredientMatcher'

type HighlightDataset = {
  id: string
  title?: string
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
}

type RecipeReport = {
  id: string
  title?: string
  zeroMatchSteps: { id: string; text: string }[]
  unusedIngredients: { id: string; text: string }[]
}

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

function loadDatasets(dir: string): HighlightDataset[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
      return payload as HighlightDataset
    })
}

function analyze(dataset: HighlightDataset): RecipeReport {
  const ingredients = normalizeIngredientGroups(dataset.ingredients || [])
  const instructions = normalizeInstructionGroups(dataset.instructions || [])
  const mapping = mapIngredientsToSteps(ingredients, instructions)

  const zeroMatchSteps: { id: string; text: string }[] = []
  const usedIngredients = new Set<string>()
  let stepCounter = 0

  instructions.forEach((group) => {
    group.steps.forEach((step) => {
      const stepId = `step-${stepCounter}`
      const matches = mapping[stepId] || []
      if (matches.length === 0) {
        zeroMatchSteps.push({ id: stepId, text: step })
      }
      matches.forEach((m) => usedIngredients.add(m))
      stepCounter += 1
    })
  })

  const unusedIngredients: { id: string; text: string }[] = []
  ingredients.forEach((group, gIdx) => {
    group.items.forEach((item, iIdx) => {
      const id = `${gIdx}-${iIdx}`
      if (!usedIngredients.has(id)) {
        unusedIngredients.push({ id, text: item })
      }
    })
  })

  return {
    id: dataset.id,
    title: dataset.title,
    zeroMatchSteps,
    unusedIngredients,
  }
}

function main() {
  const datasets = loadDatasets(datasetDir)
  const reports = datasets.map(analyze)

  if (emitJson) {
    console.log(JSON.stringify(reports, null, 2))
    return
  }

  console.log(`Scanned ${reports.length} recipes from ${datasetDir}\n`)
  reports.forEach((report) => {
    const hasIssues = report.zeroMatchSteps.length > 0 || report.unusedIngredients.length > 0
    if (!hasIssues) return
    console.log(`- ${report.title || report.id}`)
    if (report.zeroMatchSteps.length > 0) {
      console.log(`  Steps with zero matches (${report.zeroMatchSteps.length}):`)
      report.zeroMatchSteps.slice(0, 5).forEach((s) => {
        console.log(`    • ${s.id}: ${s.text}`)
      })
      if (report.zeroMatchSteps.length > 5) {
        console.log(`    …and ${report.zeroMatchSteps.length - 5} more`)
      }
    }
    if (report.unusedIngredients.length > 0) {
      console.log(`  Unused ingredients (${report.unusedIngredients.length}):`)
      report.unusedIngredients.slice(0, 5).forEach((ing) => {
        console.log(`    • ${ing.id}: ${ing.text}`)
      })
      if (report.unusedIngredients.length > 5) {
        console.log(`    …and ${report.unusedIngredients.length - 5} more`)
      }
    }
    console.log('')
  })
}

main()
