#!/usr/bin/env node
/**
 * Uses the OpenAI model (via src/lib/ai.ts) to auto-generate expectedMatches
 * for highlight datasets. Only runs on files with empty or missing expectedMatches
 * unless --force is provided.
 *
 * Usage:
 *   npm run ai:auto-label                     # label unlabeled files
 *   npm run ai:auto-label path/to/file.json   # label specific file(s)
 *   npm run ai:auto-label -- --force          # overwrite existing expectedMatches
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { aiComplete } from '../src/lib/ai'

type IngredientGroup = { section?: string; items: string[] }
type InstructionGroup = { section?: string; steps: string[] }

type Dataset = {
  id: string
  title?: string
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
  expectedMatches?: Record<string, string[]>
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const fileArgs = args.filter((a) => a !== '--force')
const DATASET_DIR = path.join(process.cwd(), 'data/ingredient_highlights')

function listTargets(): string[] {
  if (fileArgs.length > 0) {
    return fileArgs.map((f) => path.resolve(process.cwd(), f))
  }
  if (!fs.existsSync(DATASET_DIR)) return []
  return fs
    .readdirSync(DATASET_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(DATASET_DIR, f))
}

function formatPrompt(dataset: Dataset): string {
  const ingredients: string[] = []
  dataset.ingredients.forEach((group, gIdx) => {
    group.items.forEach((item, iIdx) => {
      ingredients.push(`${gIdx}-${iIdx}: ${item}`)
    })
  })

  const steps: string[] = []
  let stepCounter = 0
  dataset.instructions.forEach((group) => {
    group.steps.forEach((step) => {
      steps.push(`step-${stepCounter}: ${step}`)
      stepCounter += 1
    })
  })

  return `You are labeling which ingredients apply to each instruction step for a recipe.
Return ONLY a JSON object mapping step ids to arrays of ingredient ids.

Ingredients (id: text):
${ingredients.join('\n')}

Steps (id: text):
${steps.join('\n')}

Output format example:
{
  "step-0": ["0-1", "0-3"],
  "step-1": []
}`
}

async function labelFile(filePath: string) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Dataset
  const hasLabels = data.expectedMatches && Object.keys(data.expectedMatches).length > 0
  if (hasLabels && !force) {
    console.log(`Skipping ${path.basename(filePath)} (labels present). Use --force to overwrite.`)
    return
  }

  const prompt = formatPrompt(data)
  const response = await aiComplete(
    [
      {
        role: 'system',
        content:
          'You are an ingredient-to-step tagger. Return only valid JSON mapping step ids to ingredient id arrays.',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0, response_format: { type: 'json_object' } },
  )

  let mapping: Record<string, string[]> = {}
  try {
    const parsed = JSON.parse(response)
    mapping = parsed
  } catch (err) {
    console.warn(`Failed to parse AI response for ${path.basename(filePath)}: ${(err as Error).message}`)
    return
  }

  data.expectedMatches = mapping
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`AI-labeled ${path.basename(filePath)} (${Object.keys(mapping).length} steps)`)
}

async function main() {
  const targets = listTargets()
  if (targets.length === 0) {
    console.log('No targets found.')
    return
  }
  for (const file of targets) {
    try {
      await labelFile(file)
    } catch (err) {
      console.warn(`Failed on ${file}: ${(err as Error).message}`)
    }
  }
  console.log('Done.')
}

main()
