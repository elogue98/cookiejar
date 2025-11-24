import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabaseClient'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import { aiComplete } from '@/lib/ai'
import { ensureMetadataCompleteness } from '@/lib/metadataCompletion'
import {
  normalizeIngredientSections,
  normalizeInstructionSections,
  formatMetadataForNotes,
} from '@/lib/recipeFormatting'
import { generateTagsForRecipe } from '@/lib/aiTagging'
import OpenAI from 'openai'
import * as cheerio from 'cheerio'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

type StructuredListSection = {
  section?: string | null
  items: string[]
}

type StructuredInstructionSection = {
  section?: string | null
  steps: string[]
}

type WprmStructuredData = {
  ingredientSections: StructuredListSection[]
  instructionSections: StructuredInstructionSection[]
}

type JsonLdRecipe = {
  '@type'?: string | string[]
  image?: JsonLdImage
  recipeIngredient?: unknown
  recipeInstructions?: unknown
  description?: string
  recipeYield?: string | number | (string | number)[]
  prepTime?: string
  cookTime?: string
  totalTime?: string
  recipeCuisine?: string | string[]
  recipeCategory?: string | string[]
  nutrition?: JsonLdNutrition
  nutritionInformation?: JsonLdNutrition
  [key: string]: unknown
}

type JsonLdNutrition = {
  calories?: string | number
  calorieContent?: string | number
  proteinContent?: string | number
  protein?: string | number
  fatContent?: string | number
  fat?: string | number
  carbohydrateContent?: string | number
  carbs?: string | number
  [key: string]: unknown
}

type JsonLdImage =
  | string
  | { url?: string | null }
  | Array<string | { url?: string | null }>

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const matchesSchemaType = (value: unknown, target: string): boolean => {
  if (typeof value === 'string') {
    return (
      value === target ||
      value === `http://schema.org/${target}` ||
      value === `https://schema.org/${target}`
    )
  }

  if (Array.isArray(value)) {
    return value.some((entry) => matchesSchemaType(entry, target))
  }

  return false
}

const findRecipeNode = (data: unknown): JsonLdRecipe | null => {
  if (Array.isArray(data)) {
    for (const entry of data) {
      const match = findRecipeNode(entry)
      if (match) {
        return match
      }
    }
    return null
  }

  if (isObject(data)) {
    const node = data as JsonLdRecipe
    if (matchesSchemaType(node['@type'], 'Recipe')) {
      return node
    }
  }

  return null
}

const resolveImageUrl = (value: unknown, baseUrl: string): string | null => {
  if (typeof value === 'string') {
    try {
      return new URL(value, baseUrl).href
    } catch {
      return null
    }
  }

  if (isObject(value) && typeof value.url === 'string') {
    try {
      return new URL(value.url, baseUrl).href
    } catch {
      return null
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveImageUrl(entry, baseUrl)
      if (resolved) {
        return resolved
      }
    }
  }

  return null
}

const FRACTION_CHARACTERS = '¼½¾⅓⅔⅛⅜⅝⅞'
const QUANTITY_PATTERN = new RegExp(`[0-9${FRACTION_CHARACTERS}\\/]+`)

function normalizeText(value?: string | null): string {
  if (!value) return ''
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatNotes(notes: string): string {
  if (!notes) return ''
  const trimmed = notes.trim()
  if (!trimmed) return ''
  return /^\(.*\)$/.test(trimmed) ? trimmed : `(${trimmed})`
}

function extractWprmStructuredData(html: string): WprmStructuredData | null {
  const $ = cheerio.load(html)

  const ingredientSections: StructuredListSection[] = []
  const instructionSections: StructuredInstructionSection[] = []

  const startIngredientSection = (name?: string | null) => {
    const normalizedName = normalizeText(name)
    const section: StructuredListSection = {
      section: normalizedName || undefined,
      items: [],
    }
    ingredientSections.push(section)
    return section
  }

  const ingredientContainers = $('.wprm-recipe-ingredients-container')
  if (ingredientContainers.length > 0) {
    ingredientContainers.each((_, container) => {
      $(container)
        .find('.wprm-recipe-ingredient-group')
        .each((__, group) => {
          let currentSection: StructuredListSection | null = null

          const ensureSection = () => {
            if (!currentSection) {
              currentSection = startIngredientSection()
            }
            return currentSection
          }

          const explicitGroupName = normalizeText(
            $(group)
              .find('.wprm-recipe-group-name, .wprm-recipe-ingredient-group-name')
              .first()
              .text()
          )
          if (explicitGroupName) {
            currentSection = startIngredientSection(explicitGroupName)
          }

          $(group)
            .find('.wprm-recipe-ingredient')
            .each((___, ingredient) => {
              const $ingredient = $(ingredient)
              const amount = normalizeText(
                $ingredient.find('.wprm-recipe-ingredient-amount').text()
              )
              const unit = normalizeText(
                $ingredient.find('.wprm-recipe-ingredient-unit').text()
              )
              const name = normalizeText(
                $ingredient.find('.wprm-recipe-ingredient-name').text()
              )
              const notes = normalizeText(
                $ingredient.find('.wprm-recipe-ingredient-notes').text()
              )

              const hasStrongOnly =
                !amount &&
                !unit &&
                !notes &&
                !!name &&
                $ingredient
                  .find('.wprm-recipe-ingredient-name strong, .wprm-recipe-ingredient-name b')
                  .length > 0

              if (hasStrongOnly) {
                currentSection = startIngredientSection(name)
                return
              }

              if (!amount && !unit && !name && !notes) {
                return
              }

              const targetSection = ensureSection()
              const parts = [amount, unit, name].filter(Boolean)
              let ingredientLine = parts.join(' ').replace(/\s+,/g, ',').trim()
              if (!ingredientLine) {
                ingredientLine = notes || ''
              }

              const formattedNotes = formatNotes(notes)
              if (formattedNotes) {
                ingredientLine = `${ingredientLine} ${formattedNotes}`.trim()
              }

              if (ingredientLine) {
                targetSection.items.push(ingredientLine)
              }
            })
        })
    })
  }

  const instructionContainers = $('.wprm-recipe-instructions-container')
  if (instructionContainers.length > 0) {
    instructionContainers.each((_, container) => {
      $(container)
        .find('.wprm-recipe-instruction-group')
        .each((__, group) => {
          const sectionName = normalizeText(
            $(group)
              .find('.wprm-recipe-group-name, .wprm-recipe-instruction-group-name')
              .first()
              .text()
          )

          const steps: string[] = []
          $(group)
            .find('.wprm-recipe-instruction')
            .each((___, instruction) => {
              const raw =
                $(instruction).find('.wprm-recipe-instruction-text').text() ||
                $(instruction).text()
              const stepText = normalizeText(raw)
              if (stepText) {
                steps.push(stepText)
              }
            })

          if (steps.length > 0) {
            instructionSections.push({
              section: sectionName || undefined,
              steps,
            })
          }
        })
    })
  }

  const filteredIngredients = ingredientSections
    .map((section) => ({
      section: section.section,
      items: section.items.filter((item) => !!item),
    }))
    .filter((section) => section.items.length > 0)

  const filteredInstructions = instructionSections
    .map((section) => ({
      section: section.section,
      steps: section.steps.filter((step) => !!step),
    }))
    .filter((section) => section.steps.length > 0)

  if (filteredIngredients.length === 0 && filteredInstructions.length === 0) {
    return null
  }

  return {
    ingredientSections: filteredIngredients,
    instructionSections: filteredInstructions,
  }
}

/**
 * Zod schema for AI-extracted recipe structure
 */
const RecipeExtractionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  image: z.string().url().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  prepTime: z.string().optional().nullable(), // e.g., "15 minutes", "PT15M"
  cookTime: z.string().optional().nullable(),
  totalTime: z.string().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  mealType: z.string().optional().nullable(), // e.g., "breakfast", "dinner", "dessert"
  nutrition: z.object({
    calories: z.number().int().nonnegative().optional().nullable(),
    protein: z.number().nonnegative().optional().nullable(), // in grams
    fat: z.number().nonnegative().optional().nullable(), // in grams
    carbs: z.number().nonnegative().optional().nullable(), // in grams
  }).optional().nullable(),
  ingredientSections: z.array(z.object({
    section: z.string().optional().nullable(),
    items: z.array(z.string().min(1)),
  })).min(1, 'At least one ingredient section is required'),
  instructionSections: z.array(z.object({
    section: z.string().optional().nullable(),
    steps: z.array(z.string().min(1)),
  })).min(1, 'At least one instruction section is required'),
  tags: z.array(z.string()).optional().nullable(),
})

type RecipeExtraction = z.infer<typeof RecipeExtractionSchema>

/**
 * Extract image URL from HTML (similar to old scraper)
 */
function extractImageFromHTML(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html)
  
  // Try JSON-LD image first
  const scripts = $('script[type="application/ld+json"]')
  let schemaImageUrl: string | null = null
  
  scripts.each((_, el) => {
    try {
      const jsonData = JSON.parse($(el).html() || '{}')
      const foundRecipe = findRecipeNode(jsonData)
      if (foundRecipe && foundRecipe.image !== undefined) {
        const resolved = resolveImageUrl(foundRecipe.image, baseUrl)
        if (resolved) {
          schemaImageUrl = resolved
          return false
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    return undefined
  })
  
  if (schemaImageUrl) {
    return schemaImageUrl
  }
  
  // Try og:image meta tag
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) {
    try {
      return new URL(ogImage, baseUrl).href
    } catch {
      return null
    }
  }
  
  // Try schema.org image microdata
  const schemaImage = $('[itemprop="image"]').attr('content') || $('[itemprop="image"] img').attr('src')
  if (schemaImage) {
    try {
      return new URL(schemaImage, baseUrl).href
    } catch {
      return null
    }
  }
  
  // Fallback to first large image (skip small icons)
  const images = $('img')
  for (let i = 0; i < images.length; i++) {
    const img = $(images[i])
    const src = img.attr('src')
    const width = parseInt(img.attr('width') || '0')
    const height = parseInt(img.attr('height') || '0')
    
    // Skip small images (likely icons)
    if (width > 200 && height > 200 && src) {
      try {
        return new URL(src, baseUrl).href
      } catch {
        continue
      }
    }
  }
  
  // Last resort: first img tag
  const firstImg = $('img').first().attr('src')
  if (firstImg) {
    try {
      return new URL(firstImg, baseUrl).href
    } catch {
      return null
    }
  }
  
  return null
}

/**
 * Extract text content from HTML, including JSON-LD metadata
 */
function extractTextFromHTML(html: string): string {
  const ensureArray = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value
    if (value === undefined || value === null) return []
    return [value]
  }

  const flattenJsonLdInstructions = (entries: unknown): string[] => {
    const lines: string[] = []

    const addEntry = (entry: unknown, depth = 0, index?: number) => {
      if (entry === undefined || entry === null) return

      if (typeof entry === 'string') {
        const prefix = depth === 0 && typeof index === 'number' ? `${index + 1}.` : '-'
        lines.push(`${prefix} ${entry.trim()}`)
        return
      }

      if (typeof entry !== 'object') return

      const record = entry as Record<string, unknown>

      const types = ensureArray(record['@type']).map((type) => String(type))
      if (types.includes('HowToSection')) {
        const nameCandidate =
          record['name'] ?? record['heading'] ?? record['section'] ?? record['text']
        const name = typeof nameCandidate === 'string' ? nameCandidate.trim() : ''
        if (name) {
          lines.push(`=== ${name} ===`)
        }
        const children = ensureArray(record['itemListElement'] ?? record['steps'])
        children.forEach((child, childIdx) => addEntry(child, depth + 1, childIdx))
        return
      }

      const textCandidate =
        record['text'] ?? record['description'] ?? record['name'] ?? record['step']
      if (typeof textCandidate === 'string' && textCandidate.trim()) {
        const prefix = depth === 0 && typeof index === 'number' ? `${index + 1}.` : '-'
        lines.push(`${prefix} ${textCandidate.trim()}`)
      }

      const children = ensureArray(record['itemListElement'] ?? record['steps'])
      if (children.length > 0) {
        children.forEach((child, childIdx) => addEntry(child, depth + 1, childIdx))
      }
    }

    ensureArray(entries).forEach((entry, idx) => addEntry(entry, 0, idx))
    return lines
  }

  const $ = cheerio.load(html)
  
  // First, extract JSON-LD Recipe schema metadata if present
  const scripts = $('script[type="application/ld+json"]')
  let recipeMetadata: JsonLdRecipe | null = null
  
  scripts.each((_, el) => {
    try {
      const jsonData = JSON.parse($(el).html() || '{}')
      const recipe = findRecipeNode(jsonData)
      
      if (recipe) {
        recipeMetadata = recipe
        return false
      }
    } catch {
      // Ignore JSON parse errors
    }

    return undefined
  })
  
  // Build metadata text from JSON-LD if found
  let metadataText = ''
  if (recipeMetadata) {
    const metadata = recipeMetadata as JsonLdRecipe
    const metadataParts: string[] = []
    if (metadata.description) metadataParts.push(`Description: ${metadata.description}`)
    if (metadata.recipeYield) metadataParts.push(`Servings: ${metadata.recipeYield}`)
    if (metadata.prepTime) metadataParts.push(`Prep Time: ${metadata.prepTime}`)
    if (metadata.cookTime) metadataParts.push(`Cook Time: ${metadata.cookTime}`)
    if (metadata.totalTime) metadataParts.push(`Total Time: ${metadata.totalTime}`)
    if (metadata.recipeCuisine) {
      const cuisine = Array.isArray(metadata.recipeCuisine) 
        ? metadata.recipeCuisine.join(', ') 
        : metadata.recipeCuisine
      metadataParts.push(`Cuisine: ${cuisine}`)
    }
    if (metadata.recipeCategory) {
      const category = Array.isArray(metadata.recipeCategory) 
        ? metadata.recipeCategory.join(', ') 
        : metadata.recipeCategory
      metadataParts.push(`Category: ${category}`)
    }
    // Extract nutrition - handle both direct nutrition object and nutrition property
    const nutrition = (metadata.nutrition || metadata.nutritionInformation) as JsonLdNutrition | string | null
    if (nutrition) {
      const nutritionParts: string[] = []
      
      // Handle different schema.org formats
      // Calories can be: calories, calorieContent, or in a NutritionInformation object
      const calories =
        (typeof nutrition === 'object' && nutrition
          ? nutrition.calories || nutrition.calorieContent
          : null) ||
        (typeof nutrition === 'string' && nutrition.includes('calories') ? nutrition : null)
      if (calories) {
        // Extract number from string if needed (e.g., "250 calories" -> 250)
        const calMatch = String(calories).match(/(\d+)/)
        if (calMatch) nutritionParts.push(`Calories: ${calMatch[1]}`)
      }
      
      // Protein
      const protein =
        typeof nutrition === 'object' && nutrition
          ? nutrition.proteinContent || nutrition.protein
          : null
      if (protein) {
        const protMatch = String(protein).match(/([\d.]+)/)
        if (protMatch) nutritionParts.push(`Protein: ${protMatch[1]}g`)
      }
      
      // Fat
      const fat =
        typeof nutrition === 'object' && nutrition
          ? nutrition.fatContent || nutrition.fat
          : null
      if (fat) {
        const fatMatch = String(fat).match(/([\d.]+)/)
        if (fatMatch) nutritionParts.push(`Fat: ${fatMatch[1]}g`)
      }
      
      // Carbs
      const carbs =
        typeof nutrition === 'object' && nutrition
          ? nutrition.carbohydrateContent || nutrition.carbohydrates || nutrition.carbs
          : null
      if (carbs) {
        const carbsMatch = String(carbs).match(/([\d.]+)/)
        if (carbsMatch) nutritionParts.push(`Carbs: ${carbsMatch[1]}g`)
      }
      
      if (nutritionParts.length > 0) {
        metadataParts.push(`Nutrition (per serving): ${nutritionParts.join(', ')}`)
      }
    }
    
    if (metadataParts.length > 0) {
      metadataText = '\n\nRECIPE METADATA:\n' + metadataParts.join('\n') + '\n'
    }

    const structuredParts: string[] = []

    const ingredientLines = ensureArray(metadata.recipeIngredient)
      .map((item) => {
        if (!item) return ''
        if (typeof item === 'string') return item
        if (typeof item === 'object' && 'text' in item && item.text) return String(item.text)
        if (typeof item === 'object' && 'name' in item && item.name) return String(item.name)
        return ''
      })
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    if (ingredientLines.length > 0) {
      structuredParts.push('INGREDIENTS (SCHEMA):\n' + ingredientLines.map((line) => `- ${line}`).join('\n'))
    }

    const instructionLines = flattenJsonLdInstructions(metadata.recipeInstructions)
    if (instructionLines.length > 0) {
      structuredParts.push('INSTRUCTIONS (SCHEMA):\n' + instructionLines.join('\n'))
    }

    if (structuredParts.length > 0) {
      metadataText += `${metadataText ? '\n' : '\n\n'}STRUCTURED RECIPE DATA:\n${structuredParts.join('\n\n')}\n`
    }
  }
  
  // Also look for nutrition in the page HTML - extract nutrition facts tables
  // Do this BEFORE removing script tags so we can find tables
  const nutritionTables = $('table[class*="nutrition"], .nutrition-facts, [class*="nutrition-info"], [id*="nutrition"], [class*="nutritional"], [data-nutrition]')
  if (nutritionTables.length > 0 && !metadataText.includes('Nutrition')) {
    nutritionTables.each((_, table) => {
      const tableText = $(table).text()
      const calMatch = tableText.match(/calories?[:\s]+(\d+)/i)
      const protMatch = tableText.match(/protein[:\s]+([\d.]+)\s*g/i)
      const fatMatch = tableText.match(/fat[:\s]+([\d.]+)\s*g/i)
      const carbsMatch = tableText.match(/(?:carb|carbohydrate)[:\s]+([\d.]+)\s*g/i)
      
      const extraParts: string[] = []
      if (calMatch) extraParts.push(`Calories: ${calMatch[1]}`)
      if (protMatch) extraParts.push(`Protein: ${protMatch[1]}g`)
      if (fatMatch) extraParts.push(`Fat: ${fatMatch[1]}g`)
      if (carbsMatch) extraParts.push(`Carbs: ${carbsMatch[1]}g`)
      
      if (extraParts.length > 0) {
        if (!metadataText) {
          metadataText = '\n\nRECIPE METADATA:\n'
        }
        metadataText += `Nutrition (per serving): ${extraParts.join(', ')}\n`
        return false // break after first match
      }
    })
  }
  
  const mainContent = $('main, article, [role="main"], .content, .post-content, .entry-content').first()
  const fallbackRoot = $('body').length > 0 ? $('body') : $.root()
  const rawContentHtml = mainContent.length > 0
    ? mainContent.html() || ''
    : fallbackRoot.html() || html
  
  const $content = cheerio.load(rawContentHtml || '')
  
  $content('script, style, noscript').remove()
  $content('br').replaceWith('\n')
  
  $content('h1, h2, h3, h4, h5, h6').each((_, element) => {
    const headingText = $content(element).text().replace(/\s+/g, ' ').trim()
    if (!headingText) {
      $content(element).remove()
      return
    }
    $content(element).replaceWith(`\n\n=== ${headingText} ===\n`)
  })
  
  const headingLikeSelectors = ['p', 'div', 'section', 'article']
  headingLikeSelectors.forEach((selector) => {
    $content(selector).each((_, el) => {
      const $el = $content(el)
      const elementText = $el.text().replace(/\s+/g, ' ').trim()
      if (!elementText) {
        $el.remove()
        return
      }
      if ($el.children().length === 1) {
        const firstChild = $el.children().first()
        const firstChildNode = firstChild.get(0) as cheerio.Element | undefined
        const tagName =
          firstChildNode && firstChildNode.type === 'tag'
            ? (firstChildNode.name || '').toLowerCase()
            : ''
        const childText = firstChild.text().replace(/\s+/g, ' ').trim()
        if (childText && childText === elementText && ['strong', 'b'].includes(tagName)) {
          $el.replaceWith(`\n\n=== ${childText} ===\n`)
        }
      }
    })
  })
  
  const detectListHeading = ($li: cheerio.Cheerio, text: string): string | null => {
    if (!text) return null
    const strongText = $li.find('strong, b').text().replace(/\s+/g, ' ').trim()
    if (!strongText) return null
    const normalizedStrong = strongText.replace(/[:\s]+$/, '').trim()
    const normalizedText = text.replace(/[:\s]+$/, '').trim()
    if (!normalizedStrong || normalizedStrong !== normalizedText) return null
    if (QUANTITY_PATTERN.test(normalizedStrong)) return null
    return strongText.trim()
  }

  $content('ul, ol').each((_, list) => {
    const $list = $content(list)
    const items: string[] = []
    const listNode = $list.get(0) as cheerio.Element | undefined
    const tagName =
      listNode && listNode.type === 'tag'
        ? (listNode.name || '').toLowerCase()
        : ''
    const isOrdered = tagName === 'ol'
    let orderedIndex = 0
    
    $list.children('li').each((_, li) => {
      const $li = $content(li)
      const itemText = $li.text().replace(/\s+/g, ' ').trim()
      if (!itemText) return
      const headingText = detectListHeading($li, itemText)
      if (headingText) {
        items.push(`=== ${headingText} ===`)
        return
      }
      if (isOrdered) {
        orderedIndex += 1
      }
      const prefix = isOrdered ? `${orderedIndex}. ` : '- '
      items.push(`${prefix}${itemText}`)
    })
    
    if (items.length > 0) {
      $list.replaceWith(`\n${items.join('\n')}\n`)
    } else {
      $list.remove()
    }
  })
  
  // Convert remaining paragraphs to explicit lines
  $content('p').each((_, paragraph) => {
    const $paragraph = $content(paragraph)
    const text = $paragraph.text().replace(/\s+/g, ' ').trim()
    if (!text) {
      $paragraph.remove()
      return
    }
    $paragraph.replaceWith(`\n${text}\n`)
  })
  
  let text = $content.root().text()
  text = text.replace(/\u00a0/g, ' ')
  text = text.replace(/\r/g, '')
  text = text.replace(/[ \t]+\n/g, '\n')
  text = text.replace(/\n[ \t]+/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]{2,}/g, ' ')
  text = text.trim()
  
  if (metadataText) {
    text = `${metadataText}${text}`
  }
  
  if (text.length > 8000) {
    text = text.substring(0, 8000) + '...'
  }
  
  return text
}

/**
 * Extract recipe using GPT-4o Mini with structured prompt
 */
async function extractRecipeWithAI(content: string, contentType: 'html' | 'text' | 'image_ocr'): Promise<RecipeExtraction> {
  const systemPrompt = `You are the CookieJar Recipe AI Assistant. Your job is to take a user-submitted recipe (ingredients + instructions + optional metadata) and normalize it into CookieJar's structured format.

### RULES:

1. **NEVER change existing instructions.**
   - If instructions are present (even if messy or poorly formatted), ONLY clean, reformat, and restructure them.
   - NEVER remove steps, reorder steps, change quantities mentioned, or alter the content.
   - Preserve the exact meaning and sequence of what the user provided.

2. **Generate instructions ONLY if they are completely missing or extremely minimal.**
   - If instructions are missing or very incomplete (e.g., just "bake at 350" with no other steps), generate detailed, comprehensive instructions based on the ingredients and recipe title.
   - Generated instructions MUST be thorough and step-by-step, not just high-level summaries.
   - Include all necessary steps: preparation, mixing/combining ingredients, cooking/baking methods, temperatures, times, and finishing steps.
   - Break down complex steps into clear, actionable instructions (e.g., don't just say "mix the batter" - specify what to mix, in what order, and how).
   - Use standard cooking techniques and logical steps based on the ingredients provided.
   - This is the ONLY case where you should generate new content.

3. **NEVER remove quantities, reorder steps, or change values from existing instructions.**

4. **SECTION GROUPS (CRITICAL)** 
   - When the source recipe uses subheadings like "For the crust", "Make the filling", or "Assembly", preserve them as distinct ingredientSections and instructionSections in the same order.
   - Section titles may appear as headings, bold/strong lines before lists, or JSON-LD HowToSection names—capture the exact wording (punctuation and casing).
   - Attach ingredients/steps to the most recent heading. Only invent a generic heading if multiple groups are clearly separated but unlabeled.
   - NEVER include generic section headers as the first step (e.g., don't put "Instructions" as step 1, "Ingredients" as the first item)
   - If the only section header is a generic one like "Instructions", "Ingredients", "Method", "Directions", leave the section field empty

5. **If the user wants changes (e.g., 'use 0.5 tbsp coconut oil'), you MUST:**
   - Confirm the specific change
   - Apply ONLY that change to the original recipe
   - Return the final structured JSON for storage

6. **OUTPUT FORMAT (ALWAYS)**
Include ALL fields that have values. Omit optional fields if not found. Use null for explicitly empty values.
{
  "title": "Recipe Title (REQUIRED)",
  "description": "Recipe description if present, otherwise omit",
  "sourceUrl": "Original URL if provided, otherwise omit",
  "image": "Image URL if found, otherwise omit",
  "servings": 4,
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "totalTime": "45 minutes",
  "cuisine": "Italian",
  "mealType": "dinner",
  "nutrition": {
    "calories": 250,
    "protein": 10.5,
    "fat": 8.0,
    "carbs": 35.0
  },
  "ingredientSections": [
    { "section": "For the dough", "items": ["2 cups flour", "1 cup water"] }
  ],
  "instructionSections": [
    { "section": "Preparation", "steps": ["Step 1", "Step 2"] }
  ],
  "tags": ["tag1", "tag2"]
}

**CRITICAL: NUTRITION IS MANDATORY**: 
1. FIRST: Try to find nutrition information in the content and extract it
2. IF NOT FOUND: You MUST calculate it from the ingredients - this is REQUIRED, not optional:
   - Estimate nutrition for EACH ingredient based on the quantity specified
   - Sum up all ingredients' nutrition values
   - Divide by number of servings to get per-serving values
   - Round appropriately (calories to nearest 5-10, macros to nearest 0.5-1g)
   - ALWAYS include the calculated nutrition object
3. Use your knowledge of food nutrition values to make reasonable estimates
4. Even rough estimates are better than no nutrition information
5. The nutrition object should ALWAYS be included with at least calories

Examples:
- If you see "250 calories per serving" → {"nutrition": {"calories": 250}}
- If you see "Calories: 250, Protein: 10g" → {"nutrition": {"calories": 250, "protein": 10}}
- If you see a nutrition table with all values → include all in the nutrition object
- If NO nutrition found but you have ingredients and servings → calculate and include {"nutrition": {"calories": 205, "protein": 2, "fat": 8, "carbs": 33}}

7. **If instructions are messy but present**, rewrite them cleanly while preserving all steps and content exactly as provided.

8. **If the user submits images**, extract OCR → format the extracted text.

9. **Be warm, helpful, and funny, but NEVER change existing recipe content.**

10. **METADATA EXTRACTION (CRITICAL)**: Extract ALL available metadata from the content:
   - **description**: Recipe description or summary if present
   - **servings**: REQUIRED - Number of servings/portions the recipe yields:
     * CRITICAL: Understand the difference between "makes" and "serves":
       - "Makes 1 loaf" → 12 servings (slices), NOT 1!
       - "Makes 1 cake" → 10 servings (slices), NOT 1!
       - "Makes 1 pie" → 8 servings (slices), NOT 1!
       - "Makes 12 cookies" → 12 servings
       - "Serves 4" → 4 servings
       - "Yield: 6" → 6 servings
     * When recipe "makes" one whole item, estimate serving count:
       - Breads/loaves: 10-16 slices per loaf
       - Cakes: 10-12 slices per cake
       - Pies: 8 slices per pie
       - Individual items (cookies/muffins): count those items
     * If unclear, estimate: main dishes 4-6, sides 4-6
     * NEVER use 1 serving for whole baked goods!
   - **prepTime**: Preparation time (e.g., "15 minutes", "PT15M", "15 mins", "2 hours")
     * If not explicitly stated, estimate based on recipe complexity:
       - Simple recipes (salads, quick stir-fries, sandwiches): 5-10 minutes
       - Medium recipes (pasta dishes, basic mains, simple soups): 15-20 minutes
       - Complex recipes (stews, braises, baked goods, multi-component dishes): 20-30 minutes
   - **cookTime**: Cooking time (e.g., "30 minutes", "PT30M", "30 mins", "20 mins")
     * If not explicitly stated, estimate based on recipe type:
       - Quick cooking (stir-fries, sautés, quick fish): 10-15 minutes
       - Standard cooking (baked chicken, pasta, pan-fried items): 20-30 minutes
       - Slow cooking (stews, braises, roasts, breads): 45-90 minutes
   - **totalTime**: Total time if explicitly stated, otherwise calculate from prepTime + cookTime
   - **cuisine**: Cuisine type if mentioned (e.g., "Italian", "Mexican", "Asian", "American")
   - **mealType**: Meal type if mentioned (e.g., "breakfast", "lunch", "dinner", "dessert", "snack")
   - **nutrition**: Extract or CALCULATE nutrition facts - THIS IS VERY IMPORTANT:
     
     **STEP 1: Try to extract from content first**
     - Look for "Calories: 250" or "250 calories" or "250 kcal"
     - Look for "Protein: 10g" or "10g protein" or "Protein 10 grams"
     - Look for "Fat: 8g" or "8g fat" or "Fat 8 grams"
     - Look for "Carbs: 35g" or "35g carbs" or "Carbohydrates 35 grams"
     - Look for nutrition facts tables, nutrition labels, or nutrition information sections
     - Extract numbers even if format varies (e.g., "250 cal", "10 g protein", etc.)
     - Always extract per-serving values
     
     **STEP 2: If nutrition is NOT found, CALCULATE it from ingredients**
     - Use your knowledge of ingredient nutrition to estimate:
       * For each ingredient, estimate calories, protein, fat, and carbs per unit
       * Consider the quantity/amount specified (e.g., "2 cups flour", "1 tbsp butter")
       * Sum up all ingredients' nutrition values
       * Divide by the number of servings to get per-serving values
     - Example calculation approach:
       * "2 cups all-purpose flour" ≈ 900 calories, 25g protein, 2g fat, 190g carbs
       * "1 cup sugar" ≈ 770 calories, 0g protein, 0g fat, 200g carbs
       * "1/2 cup butter" ≈ 800 calories, 1g protein, 90g fat, 0g carbs
       * Total: 2470 calories, 26g protein, 92g fat, 390g carbs
       * For 12 servings: 206 calories, 2.2g protein, 7.7g fat, 32.5g carbs per serving
     - Round to reasonable numbers (calories to nearest 5-10, macros to nearest 0.5-1g)
     - Be reasonable with estimates - it's better to be approximately right than missing
     
     **ALWAYS include nutrition object if you can extract OR calculate it**
   - **image**: Recipe image URL if present in the content
   - **sourceUrl**: Original source URL if provided
   
   Extract metadata that is EXPLICITLY stated in the content. Look for common patterns like:
   - "Serves 4" or "Makes 4 servings" or "Yield: 4"
   - "Prep time: 15 minutes" or "Preparation: 15 mins" or "Prep: 2 hours"
   - "Cook time: 30 minutes" or "Cooking: 30 mins" or "Cook: 20 mins"
   - "Total time: 45 minutes" or "Total: 2 hours 20 mins"
   - Nutrition facts tables, nutrition labels, or sections with "Nutrition" in the heading
   - "Calories: 250 per serving" or "250 calories per serving" or "250 kcal"
   - "Protein: 10g" or "10 grams protein" or "Protein 10g"
   - "Fat: 8g" or "8 grams fat" or "Total fat 8g"
   - "Carbs: 35g" or "35 grams carbs" or "Carbohydrates 35g"
   - "Cuisine: Italian" or mentions in description

11. **For tags**: Generate tags based on what's actually in the recipe (ingredients, cooking methods mentioned, etc.), but keep them relevant and accurate.

Return ONLY valid JSON, no markdown, no explanations.`

  const userPrompt = contentType === 'html'
    ? `Extract the recipe from this HTML content. Focus on the main recipe content and ignore navigation, ads, and other page elements.

IMPORTANT: 
1. If instructions exist, preserve them exactly (only clean formatting). If instructions are completely missing or extremely minimal, generate detailed, comprehensive step-by-step instructions based on the ingredients - include all preparation, mixing, cooking, and finishing steps with specific details.

2. Extract ALL available metadata from the page:
   - Recipe description/summary
   - **Servings (REQUIRED)**: 
     * CRITICAL: "Makes 1 loaf/cake/pie" means multiple servings, NOT 1!
       - "Makes 1 loaf" → 12 servings (slices)
       - "Makes 1 cake" → 10 servings (slices)
       - "Makes 1 pie" → 8 servings (slices)
       - "Makes 12 cookies" → 12 servings
       - "Serves 4" → 4 servings
     * When recipe "makes" ONE whole baked good, estimate slices/portions
     * NEVER use 1 serving for breads, cakes, pies, or other baked goods!
   - Prep time, cook time, and total time
   - Cuisine type and meal type if mentioned
   - **Nutrition information (MANDATORY - MUST ALWAYS BE INCLUDED)**: 
     * FIRST: Look carefully for nutrition facts in the content:
       - Nutrition facts tables or nutrition labels
       - Text like "Calories: 250" or "250 calories per serving"
       - "Protein: 10g" or "10g protein"
       - "Fat: 8g" or "8g fat" or "Total fat 8g"
       - "Carbs: 35g" or "35g carbs" or "Carbohydrates 35g"
       - Any section with "Nutrition" in the heading
       - Extract the numbers even if the format varies
     * SECOND: If nutrition is NOT found, YOU MUST CALCULATE it from the ingredients:
       - Estimate nutrition for EACH ingredient based on quantities (use your knowledge)
       - Sum all ingredients' nutrition values
       - Divide by number of servings to get per-serving values
       - Round appropriately (calories to nearest 5-10, macros to nearest 0.5-1g)
       - ALWAYS include nutrition - rough estimates are better than nothing
       - At minimum, ALWAYS include calories
   - Recipe image URL
   - Any other metadata fields that are explicitly stated

3. SECTION GROUPS (CRITICAL):
   - Detect ingredient and instruction subheadings (headings, bold/strong lines before lists, JSON-LD HowToSection names, etc.) and output them as the \`section\` field.
   - Keep the original order, casing, and punctuation of each heading.
   - Attach each list/step to the most recent heading. Only invent a short descriptive heading when separate blocks are clearly unlabeled.
   - IMPORTANT: If the only section header is generic like "Instructions", "Ingredients", "Method", or "Directions", leave section empty and don't include it as a step/item.

HTML Content:
${content.substring(0, 8000)}`
    : contentType === 'image_ocr'
    ? `Extract the recipe from this OCR text extracted from an image. The text may have formatting issues, handwriting artifacts, or screenshot formatting - be flexible and intelligent in parsing.

Handle:
- Handwritten notes with messy formatting
- Screenshots with mixed text layouts
- Missing or unclear section headers
- Inconsistent spacing and line breaks
- Nutrition facts embedded in text (extract macros if present)

IMPORTANT: 
1. If instructions exist, preserve them exactly (only clean formatting). If instructions are completely missing or extremely minimal, generate detailed, comprehensive step-by-step instructions based on the ingredients - include all preparation, mixing, cooking, and finishing steps with specific details.

2. Extract ALL available metadata from the text:
   - Recipe description/summary
   - **Servings (REQUIRED)**: 
     * CRITICAL: "Makes 1 loaf" → 12 servings (NOT 1!), "Makes 1 cake" → 10 servings (NOT 1!)
     * When recipe "makes" one whole item, estimate portions from that item
     * NEVER use 1 serving for breads, cakes, pies!
   - Prep time, cook time, and total time
   - Cuisine type and meal type if mentioned
   - **Nutrition information (MANDATORY - MUST ALWAYS BE INCLUDED)**:
     * FIRST: Look for nutrition facts in the text (calories, protein, fat, carbs per serving)
     * SECOND: If NOT found, YOU MUST CALCULATE from ingredients:
       - Estimate nutrition for EACH ingredient based on quantities (use your knowledge)
       - Sum all ingredients' nutrition values
       - Divide by number of servings to get per-serving values
       - Round appropriately and ALWAYS include calculated nutrition
       - At minimum, ALWAYS include calories
   - Any other metadata fields that are explicitly stated

3. SECTION GROUPS (CRITICAL):
   - Use headings, bolded lines, or obvious separators in the OCR text to determine ingredient/instruction sections.
   - Preserve the exact wording/casing for each heading and keep sections in order.
   - If multiple blocks are clearly separate but unlabeled, infer a short descriptive heading (e.g., "Topping", "Assembly") instead of leaving sections blank.

OCR Text:
${content.substring(0, 8000)}`
    : `Extract the recipe from this pasted text content. The text may be from any source: copied recipes, handwritten notes converted to text, screenshots, etc.

Handle:
- Any text format, even if messy or poorly structured
- Auto-detect sections even if not explicitly labeled
- Extract nutrition/macros from text if mentioned

IMPORTANT: 
1. If instructions exist, preserve them exactly (only clean formatting). If instructions are completely missing or extremely minimal, generate detailed, comprehensive step-by-step instructions based on the ingredients - include all preparation, mixing, cooking, and finishing steps with specific details.

2. Extract ALL available metadata from the text:
   - Recipe description/summary
   - **Servings (REQUIRED)**: 
     * CRITICAL: "Makes 1 loaf" → 12 servings (NOT 1!), "Makes 1 cake" → 10 servings (NOT 1!)
     * When recipe "makes" one whole item, estimate portions from that item
     * NEVER use 1 serving for breads, cakes, pies!
   - Prep time, cook time, and total time
   - Cuisine type and meal type if mentioned
   - **Nutrition information (MANDATORY - MUST ALWAYS BE INCLUDED)**:
     * FIRST: Look for nutrition facts in the text (calories, protein, fat, carbs per serving)
     * SECOND: If NOT found, YOU MUST CALCULATE from ingredients:
       - Estimate nutrition for EACH ingredient based on quantities (use your knowledge)
       - Sum all ingredients' nutrition values
       - Divide by number of servings to get per-serving values
       - Round appropriately and ALWAYS include calculated nutrition
       - At minimum, ALWAYS include calories
   - Any other metadata fields that are explicitly stated

3. SECTION GROUPS (CRITICAL):
   - Look for headings, bold/uppercase lines, obvious separators, or JSON-style section labels and map them to ingredient/instruction sections.
   - Keep the heading text exactly as provided, in the same order.
   - Only create a new heading if the content clearly contains multiple unlabeled groups that would confuse the user without a label.

Text Content:
${content.substring(0, 8000)}`

  const response = await aiComplete(
    [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    {
      temperature: 0.2, // Low temperature for consistent extraction
      max_tokens: 4000, // Enough for full recipe
      response_format: { type: 'json_object' },
    }
  )

  if (!response) {
    throw new Error('No response from AI')
  }

  // Parse JSON response
  let parsed: unknown
  try {
    parsed = JSON.parse(response)
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                     response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      } catch {
        throw new Error('Failed to parse JSON from AI response')
      }
    } else {
      throw new Error('No valid JSON found in AI response')
    }
  }

  // Note: We no longer check for errors here since we allow generating instructions when missing

  // Validate with zod schema
  const validated = RecipeExtractionSchema.parse(parsed)

  // Ensure metadata completeness (servings, times, nutrition)
  const enriched = await ensureMetadataCompleteness(validated, content)
  
  return enriched
}

/**
 * POST /api/import/ai
 * 
 * Accepts either FormData or JSON:
 * FormData:
 * - url: string (HTML will be fetched)
 * - html: string (raw HTML content)
 * - text: string (pasted text or OCR text)
 * - image: File (image file, will extract OCR text first)
 * 
 * JSON:
 * - url: string (HTML will be fetched)
 * - html: string (raw HTML content)
 * - text: string (pasted text)
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let url: string | null = null
    let html: string | null = null
    let text: string | null = null
    let imageFile: File | null = null
    let userId: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (for file uploads)
      const formData = await req.formData()
      url = formData.get('url') as string | null
      html = formData.get('html') as string | null
      text = formData.get('text') as string | null
      imageFile = formData.get('image') as File | null
      userId = formData.get('userId') as string | null
    } else {
      // Handle JSON
      const body = await req.json()
      url = body.url || null
      html = body.html || null
      text = body.text || null
      userId = body.userId || null
    }

    // Determine content source
    let content: string
    let contentSourceType: 'html' | 'text' | 'image_ocr'
    let sourceUrl: string | null = null
    let imageUrl: string | null = null
    let imageBuffer: Buffer | null = null // Store image buffer for later upload
    let wprmStructuredData: WprmStructuredData | null = null

    if (url) {
      // Fetch HTML from URL
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        if (!response.ok) {
          return NextResponse.json(
            { success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
            { status: response.status }
          )
        }

        const htmlContent = await response.text()
        wprmStructuredData = extractWprmStructuredData(htmlContent)
        content = extractTextFromHTML(htmlContent)
        contentSourceType = 'html'
        sourceUrl = url
        
        // Extract image from HTML as fallback (AI might miss it)
        const extractedImageUrl = extractImageFromHTML(htmlContent, url)
        if (extractedImageUrl) {
          imageUrl = extractedImageUrl
        }
      } catch (error) {
        return NextResponse.json(
          { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 500 }
        )
      }
    } else if (html) {
      // Use provided HTML
      wprmStructuredData = extractWprmStructuredData(html)
      content = extractTextFromHTML(html)
      contentSourceType = 'html'
    } else if (imageFile) {
      // Extract text from image using OpenAI Vision
      try {
        const arrayBuffer = await imageFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64Image = buffer.toString('base64')
        const mimeType = imageFile.type || 'image/jpeg'

        // Use OpenAI Vision API directly (aiComplete doesn't support images)
        const visionResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert OCR assistant specialized in recipe extraction. Extract all text from the image, preserving structure and formatting. Handle handwritten notes, screenshots, and printed recipes with equal accuracy.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this recipe image. This may be a handwritten note, screenshot, cookbook photo, or printed recipe card. Preserve the structure - include ingredient lists, instructions, nutrition facts, and any other recipe information. Handle messy formatting, unclear handwriting, and mixed layouts intelligently. Return only the extracted text content.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 3000, // Increased for longer recipes
        })

        const visionText = visionResponse.choices[0]?.message?.content

        if (!visionText) {
          return NextResponse.json(
            { success: false, error: 'Failed to extract text from image' },
            { status: 500 }
          )
        }

        content = visionText
        contentSourceType = 'image_ocr'
        imageBuffer = buffer // Store for later upload
      } catch (error) {
        return NextResponse.json(
          { success: false, error: `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 500 }
        )
      }
    } else if (text) {
      // Use provided text
      content = text
      contentSourceType = 'text'
    } else {
      return NextResponse.json(
        { success: false, error: 'One of url, html, text, or image must be provided' },
        { status: 400 }
      )
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No content extracted from provided source' },
        { status: 400 }
      )
    }

    // Extract recipe using AI
    let extractedRecipe: RecipeExtraction
    try {
      extractedRecipe = await extractRecipeWithAI(content, contentSourceType)
    } catch (error) {
      console.error('Error extracting recipe with AI:', error)
      return NextResponse.json(
        { success: false, error: `Failed to extract recipe: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    if (wprmStructuredData) {
      const overrides: Partial<RecipeExtraction> = {}
      if (wprmStructuredData.ingredientSections.length > 0) {
        overrides.ingredientSections = wprmStructuredData.ingredientSections
      }
      if (wprmStructuredData.instructionSections.length > 0) {
        overrides.instructionSections = wprmStructuredData.instructionSections
      }

      if (Object.keys(overrides).length > 0) {
        extractedRecipe = { ...extractedRecipe, ...overrides }
      }
    }

    // Use sourceUrl from extracted recipe if available, otherwise use provided URL
    const finalSourceUrl = extractedRecipe.sourceUrl || sourceUrl
    
    // Prepare recipe data for Supabase (store structured sections to keep headers)
    const ingredients = await normalizeIngredientSections(
      extractedRecipe.ingredientSections
    )
    const instructions = normalizeInstructionSections(extractedRecipe.instructionSections)
    const metadataNotes = formatMetadataForNotes(extractedRecipe)

    const normalizeTag = (tag: unknown) =>
      typeof tag === 'string' ? tag.toLowerCase().trim().replace(/\s+/g, ' ') : ''

    const ingredientsForTagging = ingredients.flatMap((section) => section.items)
    const instructionsForTagging = instructions
      .map((section) => {
        const prefix = section.section ? `${section.section}: ` : ''
        return `${prefix}${section.steps.join(' ')}`
      })
      .join('\n')

    let tags = Array.from(
      new Set(
        (extractedRecipe.tags || [])
          .map((tag) => normalizeTag(tag))
          .filter((tag) => tag.length > 0)
      )
    )

    if (tags.length === 0) {
      try {
        const fallbackTags = await generateTagsForRecipe({
          title: extractedRecipe.title,
          ingredients: ingredientsForTagging,
          instructions: instructionsForTagging,
        })

        if (fallbackTags.length > 0) {
          tags = Array.from(new Set([...tags, ...fallbackTags.map((tag) => normalizeTag(tag))]))
        }
      } catch (tagError) {
        console.error('Error generating fallback tags for imported recipe:', tagError)
      }
    }

    const recipeData: any = {
      title: extractedRecipe.title,
      ingredients,
      instructions,
      tags,
      source_url: finalSourceUrl,
      notes: extractedRecipe.description || null,
      // Metadata fields
      servings: extractedRecipe.servings || null,
      prep_time: extractedRecipe.prepTime || null,
      cook_time: extractedRecipe.cookTime || null,
      total_time: extractedRecipe.totalTime || null,
      cuisine: extractedRecipe.cuisine || null,
      meal_type: extractedRecipe.mealType || null,
      // Nutrition (per serving)
      calories: extractedRecipe.nutrition?.calories || null,
      protein_grams: extractedRecipe.nutrition?.protein || null,
      fat_grams: extractedRecipe.nutrition?.fat || null,
      carbs_grams: extractedRecipe.nutrition?.carbs || null,
    }

    // Insert into Supabase
    const supabase = createServerClient()
    
    // Try to insert with created_by first, fallback without it if column doesn't exist
    let data, error
    if (userId && typeof userId === 'string') {
      // Try with created_by
      const result = await supabase
        .from('recipes')
        .insert({ ...recipeData, created_by: userId })
        .select()
        .single()
      
      data = result.data
      error = result.error
      
      // If error is about missing column, retry without created_by
      if (error && (error.message.includes('created_by') || error.message.includes('column') || error.code === '42703')) {
        const retryResult = await supabase
          .from('recipes')
          .insert(recipeData)
          .select()
          .single()
        
        data = retryResult.data
        error = retryResult.error
      }
    } else {
      // No userId, insert without created_by
      const result = await supabase
        .from('recipes')
        .insert(recipeData)
        .select()
        .single()
      
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    // Handle image upload
    let finalImageUrl: string | null = null
    
    // Priority: extracted image URL from HTML > AI-extracted image URL > uploaded image file
    const imageUrlToUse = imageUrl || extractedRecipe.image
    
    if (imageUrlToUse && data.id) {
      try {
        // Fetch image from URL
        const imageResponse = await fetch(imageUrlToUse, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        if (imageResponse.ok) {
          const imageArrayBuffer = await imageResponse.arrayBuffer()
          const imageBuffer = Buffer.from(imageArrayBuffer)
          
          // Determine extension
          let extension = 'jpg'
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
          if (contentType.includes('png')) extension = 'png'
          else if (contentType.includes('webp')) extension = 'webp'
          else if (contentType.includes('gif')) extension = 'gif'
          else {
            // Try to infer from URL
            const urlLower = imageUrlToUse.toLowerCase()
            if (urlLower.includes('.png')) extension = 'png'
            else if (urlLower.includes('.webp')) extension = 'webp'
            else if (urlLower.includes('.gif')) extension = 'gif'
          }
          
          // Upload optimized image
          finalImageUrl = await uploadOptimizedImage(supabase, imageBuffer, data.id, extension)

          if (finalImageUrl) {
            const { error: updateError } = await supabase
              .from('recipes')
              .update({ image_url: finalImageUrl })
              .eq('id', data.id)

            if (!updateError) {
              data.image_url = finalImageUrl
            } else {
              console.error('Error updating recipe with image URL:', updateError)
            }
          } else {
            console.error('Failed to upload optimized image')
          }
        } else {
          console.error(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`)
        }
      } catch (imageError) {
        console.error('Error processing extracted image URL:', imageError)
      }
    } else if (imageBuffer && data.id) {
      // Upload the provided image file (buffer was stored earlier)
      try {
        // Determine extension from original file
        let extension = 'jpg'
        if (imageFile) {
          if (imageFile.type.includes('png')) extension = 'png'
          else if (imageFile.type.includes('webp')) extension = 'webp'
          else if (imageFile.type.includes('gif')) extension = 'gif'
        }
        
        // Upload optimized image (this will compress and delete original)
        finalImageUrl = await uploadOptimizedImage(supabase, imageBuffer, data.id, extension)

        if (finalImageUrl) {
          const { error: updateError } = await supabase
            .from('recipes')
            .update({ image_url: finalImageUrl })
            .eq('id', data.id)

          if (!updateError) {
            data.image_url = finalImageUrl
          }
        }
      } catch (imageError) {
        console.error('Error uploading image file:', imageError)
        // Don't fail the request if image upload fails
      }
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

