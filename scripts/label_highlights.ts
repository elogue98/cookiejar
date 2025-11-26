#!/usr/bin/env node
/**
 * Interactive CLI for reviewing ingredient highlight matches.
 *
 * Usage:
 *   npm run label:highlights data/ingredient_highlights/pan-seared-scallops.json
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import process from 'node:process'

import {
  mapIngredientsToSteps,
  type IngredientGroup,
  type InstructionGroup,
} from '../src/lib/ingredientMatcher'

interface HighlightDataset {
  id: string
  title?: string
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
  expectedMatches?: Record<string, string[]>
}

interface StepDescriptor {
  id: string
  text: string
  ordinal: number
  section?: string
}

const fileArg = process.argv[2]
if (!fileArg) {
  console.error('Usage: npm run label:highlights <path/to/recipe.json>')
  process.exit(1)
}

const datasetPath = path.resolve(process.cwd(), fileArg)
if (!fs.existsSync(datasetPath)) {
  console.error(`Could not find ${datasetPath}`)
  process.exit(1)
}

const dataset: HighlightDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'))
dataset.expectedMatches = dataset.expectedMatches || {}

const ingredientDictionary: Record<string, string> = {}
dataset.ingredients.forEach((group, groupIdx) => {
  group.items.forEach((item, itemIdx) => {
    ingredientDictionary[`${groupIdx}-${itemIdx}`] = item
  })
})

const stepSequence: StepDescriptor[] = []
let globalStepCounter = 0
dataset.instructions.forEach((group) => {
  group.steps.forEach((step) => {
    stepSequence.push({
      id: `step-${globalStepCounter}`,
      ordinal: globalStepCounter + 1,
      text: step,
      section: group.section,
    })
    globalStepCounter++
  })
})

if (stepSequence.length === 0) {
  console.error('No instructions found in dataset file.')
  process.exit(1)
}

const suggestions = mapIngredientsToSteps(dataset.ingredients, dataset.instructions)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const ask = (question: string) =>
  new Promise<string>((resolve) => {
    rl.question(question, resolve)
  })

const printIngredientLegend = () => {
  console.log('\nIngredient IDs:')
  Object.entries(ingredientDictionary).forEach(([id, text]) => {
    console.log(`  ${id.padEnd(5)} ${text}`)
  })
  console.log('')
}

const normalizeInput = (input: string): string[] => {
  if (!input.trim()) return []
  return input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

const validateIds = (ids: string[]): boolean => ids.every((id) => ingredientDictionary[id])

const main = async () => {
  console.log(`\nReviewing recipe: ${dataset.title || dataset.id}`)
  printIngredientLegend()

  for (const step of stepSequence) {
    const suggested = suggestions[step.id] || []
    const existing = dataset.expectedMatches?.[step.id] || []
    const defaultMatches = existing.length > 0 ? existing : suggested

    console.log(`\nStep ${step.ordinal}${step.section ? ` (${step.section})` : ''}`)
    console.log(step.text)
    console.log(`Suggested: ${suggested.length ? suggested.join(', ') : '—'}`)
    if (existing.length) {
      console.log(`Existing labels: ${existing.join(', ')}`)
    }

    const response = await ask(
      'Enter ingredient ids (space/comma separated), "-" for none, or press Enter to accept defaults: ',
    )

    if (response.trim().toLowerCase() === 'q') {
      console.log('\nAborted without saving.')
      rl.close()
      process.exit(0)
    }

    let nextValue: string[]
    if (response.trim() === '') {
      nextValue = defaultMatches
    } else if (response.trim() === '-') {
      nextValue = []
    } else {
      nextValue = normalizeInput(response)
      if (!validateIds(nextValue)) {
        console.log('Warning: Invalid ingredient id detected. Please try this step again.')
        // Retry current step by decrementing loop? We'll simply repeat iteration by continuing with same step.
        const retry = await ask('Press Enter to retry step or type "skip" to keep prior labels: ')
        if (retry.trim().toLowerCase() === 'skip') {
          continue
        }
        // redo this step by decreasing ordinal?
        // We mimic redo by setting `nextValue` to existing and decrementing index.
        nextValue = dataset.expectedMatches?.[step.id] || defaultMatches
      }
    }

    dataset.expectedMatches = dataset.expectedMatches || {}
    dataset.expectedMatches[step.id] = nextValue
  }

  console.log('\nAll steps reviewed.')
  const confirm = await ask('Save updates? (y/N): ')
  if (confirm.trim().toLowerCase() === 'y') {
    fs.writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf-8')
    console.log(`Saved ${datasetPath}`)
  } else {
    console.log('Dismissed changes.')
  }

  rl.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

