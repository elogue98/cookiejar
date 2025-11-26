#!/usr/bin/env node
/**
 * Auto-label helper: fills expectedMatches using current matcher predictions
 * for any dataset files provided (or all with empty expectedMatches).
 *
 * Usage:
 *   npm run auto:label                       # auto-label files with empty expectedMatches
 *   npm run auto:label path/to/file1.json path/to/file2.json
 *
 * Existing expectedMatches are preserved unless --force is provided.
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
  expectedMatches?: Record<string, string[]>
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const fileArgs = args.filter((a) => a !== '--force')

const datasetDir = path.resolve(process.cwd(), 'data/ingredient_highlights')

function collectTargets(): string[] {
  if (fileArgs.length > 0) {
    return fileArgs.map((f) => path.resolve(process.cwd(), f))
  }
  return fs
    .readdirSync(datasetDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(datasetDir, f))
}

function autoLabel(filePath: string) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as HighlightDataset
  const hasLabels = payload.expectedMatches && Object.keys(payload.expectedMatches).length > 0
  if (hasLabels && !force) {
    console.log(`Skipping ${path.basename(filePath)} (labels already present)`)
    return
  }

  const ingredients = normalizeIngredientGroups(payload.ingredients || [])
  const instructions = normalizeInstructionGroups(payload.instructions || [])
  const mapping = mapIngredientsToSteps(ingredients, instructions)

  payload.expectedMatches = mapping
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  console.log(`Auto-labeled ${path.basename(filePath)} (${Object.keys(mapping).length} steps)`)
}

function main() {
  const targets = collectTargets()
  if (targets.length === 0) {
    console.log('No target files found.')
    return
  }
  targets.forEach((file) => {
    try {
      autoLabel(file)
    } catch (err) {
      console.warn(`Failed to label ${file}: ${(err as Error).message}`)
    }
  })
  console.log('\nDone. Consider reviewing labels with npm run label:highlights <file>.')
}

main()
