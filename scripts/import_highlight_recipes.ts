#!/usr/bin/env node
/**
 * Bulk importer that accepts a comma-separated list of recipe URLs, fetches
 * them with the universal parser, writes highlight dataset JSON files, and
 * optionally launches the labeling workflow for each entry.
 *
 * Usage:
 *   npm run import:highlights "https://foo.com, https://bar.com"
 *   npm run import:highlights --skip-label "https://foo.com, https://bar.com"
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

import type { IngredientGroup, InstructionGroup } from '@/lib/ingredientMatcher'
import { parseRecipe, type ParsedRecipe } from '@/app/api/recipes/import-from-url/route'

const DATASET_DIR = path.resolve(process.cwd(), 'data/ingredient_highlights')
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

const ensureUniqueFilename = (baseSlug: string) => {
  let slug = baseSlug || 'recipe'
  let attempt = 1
  while (fs.existsSync(path.join(DATASET_DIR, `${slug}.json`))) {
    slug = `${baseSlug}-${attempt}`
    attempt += 1
  }
  return slug
}

const toIngredientGroups = (input: ParsedRecipe['ingredients']): IngredientGroup[] => {
  if (
    Array.isArray(input) &&
    input.length > 0 &&
    typeof input[0] === 'object' &&
    input[0] !== null &&
    'items' in input[0]
  ) {
    return (input as { section?: string; items: string[] }[]).map((group) => ({
      section: group.section || '',
      items: (group.items || []).map((item) => item.trim()).filter(Boolean),
    }))
  }
  const items = (input as string[]) || []
  return [
    {
      section: '',
      items: items.map((item) => item.trim()).filter(Boolean),
    },
  ]
}

const toInstructionGroups = (steps: string[]): InstructionGroup[] => [
  {
    section: '',
    steps: steps.map((step) => step.trim()).filter(Boolean),
  },
]

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

const runLabelCli = (filePath: string) => {
  console.log(`\nLaunching labeler for ${path.basename(filePath)}...`)
  const result = spawnSync('npm', ['run', 'label:highlights', filePath], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  if (result.status !== 0) {
    console.warn(`Labeling script exited with code ${result.status} for ${filePath}`)
  }
}

const parseUrlList = (arg: string | undefined) => {
  if (!arg) return []
  return arg
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
}

async function main() {
  const args = process.argv.slice(2)
  const flagArgs = args.filter((arg) => arg.startsWith('--'))
  const rawArg = args
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')
    .trim()
  const urls = parseUrlList(rawArg)
  const skipLabelEnv = (process.env.SKIP_LABEL || '').toLowerCase()
  const shouldLabel =
    !flagArgs.includes('--skip-label') &&
    !flagArgs.includes('--no-label') &&
    skipLabelEnv !== '1' &&
    skipLabelEnv !== 'true'

  if (urls.length === 0) {
    console.error('Please provide a comma-separated list of URLs.')
    process.exit(1)
  }

  if (!fs.existsSync(DATASET_DIR)) {
    fs.mkdirSync(DATASET_DIR, { recursive: true })
  }

  for (const url of urls) {
    console.log(`\nProcessing ${url}`)
    try {
      const html = await fetchHtml(url)
      const parsed = await parseRecipe(html, url)
      let fallbackHost = 'recipe'
      try {
        fallbackHost = new URL(url).hostname
      } catch {
        // ignore
      }
      const slug = ensureUniqueFilename(slugify(parsed.title || fallbackHost))
      const targetPath = path.join(DATASET_DIR, `${slug}.json`)

      const payload = {
        id: slug,
        title: parsed.title,
        sourceUrl: url,
        ingredients: toIngredientGroups(parsed.ingredients),
        instructions: toInstructionGroups(parsed.instructions),
        expectedMatches: {},
      }

      fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
      console.log(`Saved ${targetPath}`)
      if (shouldLabel) {
        runLabelCli(targetPath)
      } else {
        console.log('Skipping labeling (SKIP_LABEL or --skip-label detected).')
      }
    } catch (error) {
      console.error(`Failed to import ${url}: ${(error as Error).message}`)
    }
  }

  console.log('\nDone. Run `npm run eval:highlights` when ready to see accuracy numbers.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
