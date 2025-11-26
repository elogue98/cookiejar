#!/usr/bin/env node
/**
 * Learns a lightweight linear model for ingredient highlighting from labeled datasets.
 * Uses simple logistic regression (SGD) on hand-crafted features (token overlap, phrase hit, etc.).
 *
 * Usage:
 *   npm run train:highlights
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  normalizeIngredientGroups,
  normalizeInstructionGroups,
  type IngredientGroup,
  type InstructionGroup,
  type CandidateFeatures,
} from '../src/lib/ingredientMatcher'
import { type LearnedModel } from '../src/lib/highlightModel'

type HighlightDataset = {
  id: string
  title?: string
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
  expectedMatches?: Record<string, string[]>
}

const DATASET_DIR = path.join(process.cwd(), 'data/ingredient_highlights')
const MODEL_PATH = path.join(DATASET_DIR, 'highlight_model.json')

const SYNONYM_MAP: Record<string, string[]> = {
  bacon: ['lardon', 'lardons', 'pancetta'],
  scallop: ['scallops'],
  potato: ['potatoes', 'spud', 'spuds'],
  butter: ['butters', 'ghee'],
  milk: ['dairy'],
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
  chilli: ['chili', 'chilies', 'chillies'],
  chili: ['chilli', 'chilies', 'chillies'],
  flour: ['all-purpose', 'plain', 'all-purpose flour', 'plain flour'],
  sugar: ['brown', 'caster', 'powdered', 'icing', 'confectioners'],
  corn: ['sweetcorn', 'kernels'],
  bicarbonate: ['baking', 'soda', 'bicarb'],
  soda: ['bicarbonate'],
  paprika: ['smoked paprika'],
  salt: ['salted'],
  salmon: ['fillet', 'filet'],
  noodle: ['noodles', 'udon', 'ramen', 'spaghetti'],
  tofu: ['bean curd'],
}

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
const SEASONING_TOKENS = new Set(['salt', 'pepper'])

function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('ves')) return word.slice(0, -3) + 'f'
  if (word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanIngredient(item: string): string[] {
  let cleaned = cleanText(item)
  PREP_WORDS.forEach((w) => {
    cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ')
  })
  STOP_WORDS.forEach((w) => {
    cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ')
  })
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  return cleaned
    .split(' ')
    .map((t) => singularize(t.trim()))
    .filter((t) => t.length > 1)
}

function expandSynonyms(token: string): string[] {
  return SYNONYM_MAP[token] || []
}

function phraseList(tokens: string[]): string[] {
  const phrases: string[] = []
  for (let size = 2; size <= Math.min(3, tokens.length); size += 1) {
    for (let i = 0; i <= tokens.length - size; i += 1) {
      phrases.push(tokens.slice(i, i + size).join(' '))
    }
  }
  return phrases
}

function buildFeatures(
  ingText: string,
  stepText: string,
  ingredientSection?: string,
  stepSection?: string,
): CandidateFeatures {
  const ingTokens = cleanIngredient(ingText)
  const stepTokens = cleanText(stepText)
    .split(' ')
    .map((t) => singularize(t.trim()))
    .filter((t) => t.length > 1)

  const stepSet = new Set(stepTokens)
  let matchedTokens = 0
  let matchedWeight = 0
  let hasHead = false
  let usedSyn = false
  const usedFuzzy = false
  const headNoun = ingTokens.length > 0 ? ingTokens[ingTokens.length - 1] : null

  ingTokens.forEach((token) => {
    if (stepSet.has(token)) {
      matchedTokens += 1
      matchedWeight += 1
      if (headNoun === token) hasHead = true
    } else {
      const syns = expandSynonyms(token)
      if (syns.some((s) => stepSet.has(s))) {
        matchedTokens += 1
        matchedWeight += 1
        usedSyn = true
        if (syns.includes(headNoun || '')) hasHead = true
      }
    }
  })

  const phrases = phraseList(ingTokens)
  const lowerStep = cleanText(stepText)
  const phraseHit = phrases.some((p) => new RegExp(`\\b${p}\\b`, 'i').test(lowerStep))
  if (matchedTokens === 0 && phraseHit) {
    matchedTokens = 1
    matchedWeight = 1
  }

  const sectionAlign =
    ingredientSection && stepSection
      ? cleanText(ingredientSection) === cleanText(stepSection) ||
        cleanText(ingredientSection).split(' ').some((t) => cleanText(stepSection).includes(t))
      : true

  const features: CandidateFeatures = {
    overlapRatio: ingTokens.length ? matchedTokens / ingTokens.length : 0,
    weightCoverage: ingTokens.length ? matchedWeight / ingTokens.length : 0,
    hasHeadNoun: hasHead ? 1 : 0,
    phraseHit: phraseHit ? 1 : 0,
    synonymHit: usedSyn ? 1 : 0,
    fuzzyHit: usedFuzzy ? 1 : 0,
    uniqueHead: 0,
    tokenCount: ingTokens.length,
    sectionAlign: sectionAlign ? 1 : 0,
    seasoning: ingTokens.some((t) => SEASONING_TOKENS.has(t)) ? 1 : 0,
  }
  return features
}

type Example = { features: CandidateFeatures; label: number }

function collectExamples(dataset: HighlightDataset): Example[] {
  const ing = normalizeIngredientGroups(dataset.ingredients || [])
  const instr = normalizeInstructionGroups(dataset.instructions || [])
  const expected = dataset.expectedMatches || {}
  const examples: Example[] = []
  let stepCounter = 0

  instr.forEach((group) => {
    group.steps.forEach((step) => {
      const stepId = `step-${stepCounter}`
      const gold = new Set(expected[stepId] || [])
      ing.forEach((ingGroup, gIdx) => {
        ingGroup.items.forEach((item, iIdx) => {
          const ingId = `${gIdx}-${iIdx}`
          const label = gold.has(ingId) ? 1 : 0
          const feat = buildFeatures(item, step, ingGroup.section, group.section)
          examples.push({ features: feat, label })
        })
      })
      stepCounter += 1
    })
  })
  return examples
}

function loadDatasets(): HighlightDataset[] {
  if (!fs.existsSync(DATASET_DIR)) return []
  return fs
    .readdirSync(DATASET_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DATASET_DIR, file), 'utf-8')) as HighlightDataset
      } catch {
        return null
      }
    })
    .filter(Boolean) as HighlightDataset[]
}

function trainLogistic(examples: Example[], epochs = 15, lr = 0.05): LearnedModel {
  const keys = Object.keys(examples[0].features) as (keyof CandidateFeatures)[]
  const weights = keys.reduce<Record<keyof CandidateFeatures, number>>((acc, key) => {
    acc[key] = 0
    return acc
  }, {} as Record<keyof CandidateFeatures, number>)
  let bias = 0

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const ex of examples) {
      const x = keys.map((k) => ex.features[k] || 0)
      const z = x.reduce((sum, val, idx) => sum + val * (weights[keys[idx]] || 0), bias)
      const p = 1 / (1 + Math.exp(-z))
      const error = ex.label - p
      keys.forEach((k, idx) => {
        weights[k] += lr * error * x[idx]
      })
      bias += lr * error
    }
  }

  return { weights, bias }
}

function main() {
  const datasets = loadDatasets().filter(
    (d) => d.expectedMatches && Object.keys(d.expectedMatches || {}).length > 0,
  )
  if (datasets.length === 0) {
    console.error('No labeled datasets with expectedMatches found.')
    process.exit(1)
  }

  const examples = datasets.flatMap(collectExamples)
  if (examples.length === 0) {
    console.error('No training examples produced.')
    process.exit(1)
  }

  const model = trainLogistic(examples, 15, 0.03)
  fs.writeFileSync(MODEL_PATH, JSON.stringify(model, null, 2) + '\n', 'utf-8')
  console.log(`Saved learned model to ${MODEL_PATH} using ${examples.length} examples from ${datasets.length} recipes.`)
}

main()
