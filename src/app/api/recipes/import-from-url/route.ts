/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createServerClient } from '@/lib/supabaseClient'
import { generateTagsForRecipe } from '@/lib/aiTagging'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import { aiComplete } from '@/lib/ai'

export type ParsedRecipe = {
  title: string
  ingredients: string[] | { section: string; items: string[] }[]
  instructions: string[]
  imageUrl: string | null
}

type Platform = 'tasty' | 'wprm' | 'mediavine' | 'bbc' | 'unknown'

type InstructionSection = {
  section: string
  steps: string[]
}

type IngredientGroup = { section?: string; items: string[] }
type InstructionGroup = { section?: string; steps: string[] }

/**
 * Clean text by removing HTML, trimming whitespace, and removing common junk
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\b(Print|Pin|Share|Save)\b/gi, '') // Remove common buttons
    .trim()
}

/**
 * Resolve relative URL to absolute URL
 */
function resolveUrl(url: string | null | undefined, baseUrl: string): string | null {
  if (!url) return null
  try {
    return new URL(url, baseUrl).href
    } catch {
    return null
  }
}

/**
 * Extract image from various sources
 */
function extractImage($: cheerio.CheerioAPI, recipe: any, baseUrl: string): string | null {
  // Try JSON-LD image first
  if (recipe?.image) {
    if (typeof recipe.image === 'string') {
      return resolveUrl(recipe.image, baseUrl)
    }
    if (Array.isArray(recipe.image) && recipe.image.length > 0) {
      const img = recipe.image[0]
      if (typeof img === 'string') {
        return resolveUrl(img, baseUrl)
      }
      if (img.url) {
        return resolveUrl(img.url, baseUrl)
      }
    }
    if (recipe.image.url) {
      return resolveUrl(recipe.image.url, baseUrl)
    }
  }

  // Try og:image meta tag
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) {
    return resolveUrl(ogImage, baseUrl)
  }

  // Try schema.org image microdata
  const schemaImage = $('[itemprop="image"]').attr('content') || $('[itemprop="image"] img').attr('src')
  if (schemaImage) {
    return resolveUrl(schemaImage, baseUrl)
  }

  // Fallback to first large image (skip small icons)
  const images = $('img')
  for (let i = 0; i < images.length; i++) {
    const img = $(images[i])
    const src = img.attr('src')
    const width = parseInt(img.attr('width') || '0')
    const height = parseInt(img.attr('height') || '0')
    
    // Skip small images (likely icons)
    if (width > 200 && height > 200) {
      return resolveUrl(src, baseUrl)
    }
  }

  // Last resort: first img tag
  const firstImg = $('img').first().attr('src')
  return resolveUrl(firstImg, baseUrl)
}

/**
 * Parse instructions from JSON-LD Recipe schema
 * Handles HowToStep arrays and HowToSection structures
 */
function parseJSONLDInstructions(recipe: any): string[] {
  const instructions: string[] = []

  if (!recipe.recipeInstructions) {
    return instructions
  }

  // Case 1: Array of instructions
  if (Array.isArray(recipe.recipeInstructions)) {
    recipe.recipeInstructions.forEach((item: any) => {
      // Case 1A: String
      if (typeof item === 'string') {
        const cleaned = cleanText(item)
        if (cleaned) instructions.push(cleaned)
        return
      }

      // Case 1B: HowToStep object
      if (item && typeof item === 'object') {
        const type = item['@type']
        const isHowToStep = type === 'HowToStep' || 
                           type === 'http://schema.org/HowToStep' ||
                           type === 'https://schema.org/HowToStep' ||
                           (Array.isArray(type) && type.includes('HowToStep'))

        if (isHowToStep) {
          const text = item.text || item.name || item.instruction || ''
          const cleaned = cleanText(String(text))
          if (cleaned) instructions.push(cleaned)
          return
        }

        // Case 1C: HowToSection object
        const isHowToSection = type === 'HowToSection' ||
                               type === 'http://schema.org/HowToSection' ||
                               type === 'https://schema.org/HowToSection' ||
                               (Array.isArray(type) && type.includes('HowToSection'))

        if (isHowToSection) {
          // Extract section name
          const sectionName = item.name || item.headline || ''
          if (sectionName) {
            const cleanedName = cleanText(String(sectionName)).toUpperCase()
            if (cleanedName) {
              instructions.push(`${cleanedName}:`)
            }
          }

          // Extract steps from itemListElement
          if (item.itemListElement && Array.isArray(item.itemListElement)) {
            item.itemListElement.forEach((step: any) => {
              if (typeof step === 'string') {
                const cleaned = cleanText(step)
                if (cleaned) instructions.push(cleaned)
              } else if (step && typeof step === 'object') {
                const stepText = step.text || step.name || step.instruction || ''
                const cleaned = cleanText(String(stepText))
                if (cleaned) instructions.push(cleaned)
              }
            })
          }
          return
        }

        // Case 1D: Generic object with text property
        const text = item.text || item.name || item.instruction || ''
        const cleaned = cleanText(String(text))
        if (cleaned) instructions.push(cleaned)
      }
    })
  } 
  // Case 2: String
  else if (typeof recipe.recipeInstructions === 'string') {
    const cleaned = cleanText(recipe.recipeInstructions)
    if (cleaned) instructions.push(cleaned)
  }

  return instructions
}

/**
 * Extract ingredients from JSON-LD recipe schema
 * Handles flat arrays, sectioned structures, and WP Recipe Maker grouped format
 */
function extractIngredientsFromJsonLd(recipe: any): string[] {
  const ingredients: string[] = []

  if (!recipe.recipeIngredient) {
    return ingredients
  }

  // Case 1: WP Recipe Maker grouped format
  if (Array.isArray(recipe.recipeIngredient) && recipe.recipeIngredient.length > 0) {
    const firstItem = recipe.recipeIngredient[0]
    if (firstItem && typeof firstItem === 'object' && firstItem.name && firstItem.ingredients) {
      recipe.recipeIngredient.forEach((group: any) => {
        if (group && typeof group === 'object' && group.name) {
          const groupName = cleanText(String(group.name || '')).toUpperCase()
          if (groupName) {
            ingredients.push(`${groupName}:`)
          }
          
          const groupIngredients = group.ingredients || []
          if (Array.isArray(groupIngredients)) {
            groupIngredients.forEach((ing: any) => {
              if (typeof ing === 'string') {
                const cleaned = cleanText(ing)
                if (cleaned) ingredients.push(`- ${cleaned}`)
              } else if (ing && typeof ing === 'object') {
                const text = ing.name || ing.text || ing.ingredient || ''
                const cleaned = cleanText(text)
                if (cleaned) ingredients.push(`- ${cleaned}`)
              }
            })
          }
        }
      })
      return ingredients
    }
  }

  // Case 2: Sectioned structure with HowToSection
  if (Array.isArray(recipe.recipeIngredient)) {
    const hasSections = recipe.recipeIngredient.some((item: any) => {
      return item && typeof item === 'object' && 
             (item['@type'] === 'HowToSection' || 
              item['@type'] === 'http://schema.org/HowToSection' ||
              item['@type'] === 'https://schema.org/HowToSection' ||
              (Array.isArray(item['@type']) && item['@type'].includes('HowToSection')))
    })

    if (hasSections) {
      recipe.recipeIngredient.forEach((section: any) => {
        if (section && typeof section === 'object' && 
            (section['@type'] === 'HowToSection' || 
             section['@type'] === 'http://schema.org/HowToSection' ||
             section['@type'] === 'https://schema.org/HowToSection' ||
             (Array.isArray(section['@type']) && section['@type'].includes('HowToSection')))) {
          
          const sectionName = section.name || section.headline || ''
          if (sectionName) {
            const cleanedName = cleanText(String(sectionName)).toUpperCase()
            if (cleanedName) {
              ingredients.push(`${cleanedName}:`)
            }
          }

          if (section.itemListElement && Array.isArray(section.itemListElement)) {
            section.itemListElement.forEach((item: any) => {
              if (item && typeof item === 'object') {
                const text = item.text || item.name || item.ingredient || item.item || ''
                const cleaned = cleanText(String(text))
                if (cleaned) ingredients.push(`- ${cleaned}`)
              } else if (typeof item === 'string') {
                const cleaned = cleanText(item)
                if (cleaned) ingredients.push(`- ${cleaned}`)
              }
            })
          }
        }
      })
      return ingredients
    }
  }

  // Case 3: Flat array of strings or objects
  if (Array.isArray(recipe.recipeIngredient)) {
    recipe.recipeIngredient.forEach((ing: any) => {
      if (typeof ing === 'string') {
        const cleaned = cleanText(ing)
        if (cleaned) ingredients.push(cleaned)
      } else if (ing && typeof ing === 'object') {
        const text = ing.name || ing.text || ing.ingredient || ''
        const cleaned = cleanText(text)
        if (cleaned) ingredients.push(cleaned)
      }
    })
  }

  return ingredients
}

/**
 * Clean and assemble ingredient line from parts
 * Removes duplicates and normalizes spacing
 */
function cleanIngredientLine(amount: string, unit: string, name: string, extra: string): string {
  const parts: string[] = []
  
  if (amount) parts.push(amount.trim())
  if (unit) parts.push(unit.trim())
  if (name) parts.push(name.trim())
  if (extra) {
    const cleanExtra = extra.trim()
    if (cleanExtra && !parts.some(part => cleanExtra.includes(part) && part.length > 2)) {
      parts.push(cleanExtra)
    }
  }
  
  let result = parts.join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Remove duplicate words
  const words = result.split(/\s+/)
  const uniqueWords: string[] = []
  let lastWord = ''
  for (const word of words) {
    if (word !== lastWord || uniqueWords.length === 0) {
      uniqueWords.push(word)
      lastWord = word
    }
  }
  result = uniqueWords.join(' ')
  
  return cleanText(result)
}

/**
 * Convert InstructionSection[] to string[] format (for backward compatibility)
 */
function flattenInstructions(sections: InstructionSection[]): string[] {
  const result: string[] = []
  sections.forEach(section => {
    if (section.section) {
      result.push(`${section.section}:`)
    }
    section.steps.forEach(step => {
      result.push(step)
    })
  })
  return result
}

/**
 * LAYER 1: Parse instructions from JSON-LD Recipe Schema
 * Returns structured format with sections
 */
function parseJSONLDInstructionsStructured(recipe: any): InstructionSection[] {
  const sections: InstructionSection[] = []

  if (!recipe.recipeInstructions) {
    return sections
  }

  // Case 1: Array of instructions
            if (Array.isArray(recipe.recipeInstructions)) {
    let currentSection: InstructionSection | null = null

    recipe.recipeInstructions.forEach((item: any) => {
      // Case 1A: String
      if (typeof item === 'string') {
        const cleaned = cleanText(item)
        if (cleaned) {
          if (currentSection === null) {
            currentSection = { section: '', steps: [] }
          }
          if (currentSection !== null) {
            currentSection.steps.push(cleaned)
          }
        }
        return
      }

      // Case 1B: HowToStep object
      if (item && typeof item === 'object') {
        const type = item['@type']
        const isHowToStep = type === 'HowToStep' || 
                           type === 'http://schema.org/HowToStep' ||
                           type === 'https://schema.org/HowToStep' ||
                           (Array.isArray(type) && type.includes('HowToStep'))

        if (isHowToStep) {
          const text = item.text || item.name || item.instruction || ''
          const cleaned = cleanText(String(text))
          if (cleaned) {
            if (currentSection === null) {
              currentSection = { section: '', steps: [] }
            }
            if (currentSection !== null) {
              currentSection.steps.push(cleaned)
            }
          }
          return
        }

        // Case 1C: HowToSection object
        const isHowToSection = type === 'HowToSection' ||
                               type === 'http://schema.org/HowToSection' ||
                               type === 'https://schema.org/HowToSection' ||
                               (Array.isArray(type) && type.includes('HowToSection'))

        if (isHowToSection) {
          // Save previous section if exists
          if (currentSection !== null && currentSection.steps.length > 0) {
            sections.push(currentSection)
          }

          // Create new section
          const sectionName = item.name || item.headline || ''
          const cleanedName = cleanText(String(sectionName)).toUpperCase().replace(/:\s*$/, '')
          
          currentSection = {
            section: cleanedName || '',
            steps: []
          }

          // Extract steps from itemListElement
          if (item.itemListElement && Array.isArray(item.itemListElement)) {
            item.itemListElement.forEach((step: any) => {
              if (currentSection === null) return
                if (typeof step === 'string') {
                const cleaned = cleanText(step)
                if (cleaned) currentSection.steps.push(cleaned)
              } else if (step && typeof step === 'object') {
                const stepText = step.text || step.name || step.instruction || ''
                const cleaned = cleanText(String(stepText))
                if (cleaned) currentSection.steps.push(cleaned)
              }
            })
          }
          return
        }

        // Case 1D: Generic object with text property
        const text = item.text || item.name || item.instruction || ''
        const cleaned = cleanText(String(text))
        if (cleaned) {
          if (currentSection === null) {
            currentSection = { section: '', steps: [] }
          }
          if (currentSection !== null) {
            currentSection.steps.push(cleaned)
          }
        }
      }
    })

    // Add last section
    if (currentSection !== null) {
      const finalSection: InstructionSection = currentSection
      if (finalSection.steps.length > 0) {
        sections.push(finalSection)
      }
    }
  } 
  // Case 2: String
  else if (typeof recipe.recipeInstructions === 'string') {
    const cleaned = cleanText(recipe.recipeInstructions)
    if (cleaned) {
      sections.push({
        section: '',
        steps: [cleaned]
      })
    }
  }

  return sections
}

/**
 * Detect if page uses Tasty Recipes plugin
 */
function detectTastyRecipes($: cheerio.CheerioAPI): boolean {
  // Check multiple selectors for Tasty Recipes
  return $('.tasty-recipes-instructions').length > 0 ||
         $('.tasty-recipes').length > 0 ||
         $('[data-tasty-recipes-customization]').length > 0
}

/**
 * LAYER 2A: Parse Tasty Recipes instructions
 */
function parseTastyInstructions($: cheerio.CheerioAPI): InstructionSection[] {
  const sections: InstructionSection[] = []
  
  // Detect Tasty Recipes container
  let root: ReturnType<typeof $> | null = null
  if ($('.tasty-recipes-instructions').length > 0) {
    root = $('.tasty-recipes-instructions').first()
  } else if ($('.tasty-recipes').length > 0) {
    root = $('.tasty-recipes').first()
  } else if ($('[data-tasty-recipes-customization]').length > 0) {
    root = $('[data-tasty-recipes-customization]').first()
  }
  
  if (!root || root.length === 0) {
    return sections
  }

  // Find instructions container within root
  const instructionsContainer = root.find('.tasty-recipes-instructions').first()
  const containerToSearch = instructionsContainer.length > 0 ? instructionsContainer : root
  
  // Extract steps from ol > li (scoped to container only)
  const steps = containerToSearch.find('ol > li')
  
  if (steps.length > 0) {
    let currentSection: InstructionSection | null = null
    
    steps.each((_i: number, liEl: cheerio.Element) => {
      const li = $(liEl)
      
      // Check for section header in <strong> inside the instruction
      const strongText = li.find('strong').first().text().trim()
      const isSectionHeader = strongText && strongText.length < 50 && !strongText.match(/^[a-z]/)
      
      if (isSectionHeader) {
        // Save previous section if exists
        if (currentSection && currentSection.steps.length > 0) {
          sections.push(currentSection)
        }
        
        // Extract remaining text as first step
        const remainingText = li.clone().find('strong').remove().end().text().trim()
        const cleaned = cleanText(remainingText)
        const sectionName = cleanText(strongText).toUpperCase().replace(/:\s*$/, '')
        
        currentSection = {
          section: sectionName || '',
          steps: cleaned ? [cleaned] : []
        }
    } else {
        // Regular step - check if we need to create a section from preceding h4
        if (!currentSection) {
          const prevH4 = li.parent().prevAll('h4').first()
          if (prevH4.length > 0) {
            const groupName = prevH4.text().trim()
            const cleanedName = cleanText(groupName).toUpperCase().replace(/:\s*$/, '')
            currentSection = {
              section: cleanedName || '',
              steps: []
            }
          } else {
            currentSection = {
              section: '',
              steps: []
            }
          }
        }
        
        const text = li.text().trim()
        const cleaned = cleanText(text)
        if (cleaned) {
          currentSection.steps.push(cleaned)
        }
      }
    })
    
    // Add last section
    if (currentSection !== null) {
      const finalSection: InstructionSection = currentSection
      if (finalSection.steps.length > 0) {
        sections.push(finalSection)
      }
    }
  }

  return sections
}

/**
 * LAYER 2B: Parse WP Recipe Maker instructions
 */
function parseWPRMInstructions($: cheerio.CheerioAPI): InstructionSection[] {
  const sections: InstructionSection[] = []
  const recipeContainer = $('.wprm-recipe-container, [class*="wprm-recipe"]').first()
  
  if (recipeContainer.length === 0) {
    return sections
  }

  const instructionGroups = recipeContainer.find('.wprm-recipe-instruction-group')
  
  if (instructionGroups.length > 0) {
    instructionGroups.each((_i: number, groupEl: cheerio.Element) => {
      const group = $(groupEl)
      const groupName = group.find('.wprm-recipe-instruction-group-name').text().trim()
      const cleanedName = cleanText(groupName).toUpperCase().replace(/:\s*$/, '')
      
      const steps: string[] = []
      group.find('.wprm-recipe-instruction, .wprm-recipe-instruction-text').each((_i2: number, instEl: cheerio.Element) => {
        const instText = $(instEl).text().trim()
        const cleaned = cleanText(instText)
        if (cleaned) {
          steps.push(cleaned)
        }
      })
      
      if (steps.length > 0) {
        sections.push({
          section: cleanedName || '',
          steps
        })
      }
    })
  } else {
    // No groups, just find all instructions
    const steps: string[] = []
    recipeContainer.find('.wprm-recipe-instruction, .wprm-recipe-instruction-text').each((_i: number, instEl: cheerio.Element) => {
      const instText = $(instEl).text().trim()
      const cleaned = cleanText(instText)
      if (cleaned) {
        steps.push(cleaned)
      }
    })
    
    if (steps.length > 0) {
      sections.push({
        section: '',
        steps
      })
    }
  }

  return sections
}

/**
 * LAYER 2C: Parse Mediavine Create instructions
 */
function parseMediavineInstructions($: cheerio.CheerioAPI): InstructionSection[] {
  const sections: InstructionSection[] = []
  const instructionsContainer = $('.mv-create-instructions').first()
  
  if (instructionsContainer.length === 0) {
    return sections
  }

  const steps: string[] = []
  instructionsContainer.find('.mv-create-instruction-step, li').each((_i: number, el: cheerio.Element) => {
    const text = $(el).text().trim()
    const cleaned = cleanText(text)
    if (cleaned) {
      steps.push(cleaned)
    }
  })

  if (steps.length > 0) {
    sections.push({
      section: '',
      steps
    })
  }

  return sections
}

/**
 * Check if text looks like an instruction step (starts with cooking verb)
 */
function looksLikeInstruction(text: string): boolean {
  const cookingVerbs = [
    'heat', 'add', 'mix', 'stir', 'bake', 'combine', 'cook', 'transfer',
    'place', 'pour', 'whisk', 'season', 'simmer', 'boil', 'fry', 'sauté',
    'roast', 'grill', 'steam', 'blend', 'chop', 'dice', 'slice', 'mince',
    'peel', 'grate', 'zest', 'juice', 'drain', 'rinse', 'pat', 'toss',
    'fold', 'knead', 'roll', 'spread', 'brush', 'drizzle', 'garnish'
  ]
  
  const lowerText = text.toLowerCase().trim()
  return cookingVerbs.some(verb => lowerText.startsWith(verb))
}

/**
 * Check if text starts with step pattern
 */
function isStepPattern(text: string): boolean {
  return /^(step\s+\d+|step\s+one|step\s+two|step\s+three|step\s+four|step\s+five|\d+\.)/i.test(text.trim())
}

/**
 * Find recipe container (scoped search to avoid comments)
 */
function findRecipeContainer($: cheerio.CheerioAPI): ReturnType<typeof $> | null {
  // Try common recipe container selectors
  const selectors = [
    '.entry-content',
    '.post-content',
    '.recipe',
    '.recipe-content',
    'article',
    'main',
    '[role="main"]',
    '.content'
  ]
  
  for (const selector of selectors) {
    const container = $(selector).first()
    if (container.length > 0) {
      return container
    }
  }
  
  return null
}

/**
 * LAYER 3: Heuristic instructions parser (scoped to recipe container only)
 */
function parseHeuristicInstructions($: cheerio.CheerioAPI): InstructionSection[] | null {
  const sections: InstructionSection[] = []
  
  // Find recipe container - NEVER search entire page
  const recipeContainer = findRecipeContainer($)
  if (!recipeContainer || recipeContainer.length === 0) {
    return null // Don't run heuristics on entire page
  }

  // Strategy 1: Find longest ordered list within container
  let longestList: ReturnType<typeof $> | null = null
  let maxLength = 0
  
  recipeContainer.find('ol').each((_i: number, listEl: cheerio.Element) => {
    const list = $(listEl)
    const items = list.find('li')
    if (items.length > maxLength && items.length >= 3) {
      maxLength = items.length
      longestList = list
    }
  })
  
  if (longestList !== null) {
    const foundList: ReturnType<typeof $> = longestList
    if (foundList.length > 0) {
      // Check for section heading
      const prevHeading = foundList.prevAll('h2, h3, h4').first()
      let sectionName = ''
      if (prevHeading.length > 0) {
        const headingText = cleanText(prevHeading.text()).toUpperCase()
        if (headingText && (headingText.includes('INSTRUCTION') || headingText.includes('METHOD') || headingText.includes('DIRECTION') || headingText.length < 30)) {
          sectionName = headingText.replace(/:\s*$/, '')
        }
      }
      
      const steps: string[] = []
      foundList.find('li').each((_i: number, liEl: cheerio.Element) => {
        const text = $(liEl).text().trim()
        const cleaned = cleanText(text)
        if (cleaned) {
          steps.push(cleaned)
        }
      })

      if (steps.length > 0) {
        sections.push({
          section: sectionName,
          steps
        })
        return sections // Return early if found
      }
    }
  }

  // Strategy 2: Find lists where >50% of items start with cooking verbs (within container)
  recipeContainer.find('ul, ol').each((_i: number, listEl: cheerio.Element) => {
    const list = $(listEl)
    const items = list.find('li')
    if (items.length < 2) return
    
    let instructionCount = 0
    items.each((_i2: number, itemEl: cheerio.Element) => {
      const text = $(itemEl).text().trim()
      if (looksLikeInstruction(text) || isStepPattern(text)) {
        instructionCount++
      }
    })
    
    const score = instructionCount / items.length
    if (score > 0.6) {
          const steps: string[] = []
      items.each((_i3: number, liEl: cheerio.Element) => {
        const text = $(liEl).text().trim()
        const cleaned = cleanText(text)
        if (cleaned) {
          steps.push(cleaned)
        }
      })
      
      if (steps.length > 0) {
        sections.push({
          section: '',
          steps
        })
      }
          return false // break
        }
      })

  // Strategy 3: Find paragraphs starting with step patterns (within container)
  if (sections.length === 0) {
    const steps: string[] = []
    recipeContainer.find('p').each((_i: number, pEl: cheerio.Element) => {
      const text = $(pEl).text().trim()
      if (isStepPattern(text)) {
        const cleaned = cleanText(text)
        if (cleaned) {
          steps.push(cleaned)
        }
      }
    })
    
    if (steps.length >= 3) {
      sections.push({
        section: '',
        steps
      })
    }
  }

  return sections.length > 0 ? sections : null
}

/**
 * LAYER 4: Readability fallback (scoped to recipe container only)
 */
function parseReadabilityInstructions($: cheerio.CheerioAPI): InstructionSection[] | null {
  const sections: InstructionSection[] = []
  
  // Find recipe container - NEVER search entire page
  const recipeContainer = findRecipeContainer($)
  if (!recipeContainer || recipeContainer.length === 0) {
    return null // Don't run readability on entire page
  }

  // Find longest ordered list in recipe container
  let longestList: ReturnType<typeof $> | null = null
  let maxLength = 0
  
  recipeContainer.find('ol').each((_i: number, listEl: cheerio.Element) => {
    const list = $(listEl)
    const items = list.find('li')
    if (items.length > maxLength && items.length >= 3) {
      maxLength = items.length
      longestList = list
    }
  })
  
  if (longestList !== null) {
    const foundList: ReturnType<typeof $> = longestList
    if (foundList.length > 0) {
      const steps: string[] = []
      foundList.find('li').each((_i: number, liEl: cheerio.Element) => {
        const text = $(liEl).text().trim()
        const cleaned = cleanText(text)
        if (cleaned) {
          steps.push(cleaned)
        }
      })
      
      if (steps.length > 0) {
        sections.push({
          section: '',
          steps
        })
        return sections // Return early if found
      }
    }
  }

  // Fallback: paragraphs with cooking verbs (within container)
  const steps: string[] = []
  recipeContainer.find('p').each((_i: number, pEl: cheerio.Element) => {
    const text = $(pEl).text().trim()
    if (looksLikeInstruction(text) && text.length > 20) {
      const cleaned = cleanText(text)
      if (cleaned) {
        steps.push(cleaned)
      }
    }
  })
  
  if (steps.length >= 3) {
    sections.push({
      section: '',
      steps
    })
  }

  return sections.length > 0 ? sections : null
}

/**
 * LAYER 5: AI fallback
 */
async function parseAIInstructions($: cheerio.CheerioAPI): Promise<InstructionSection[] | null> {
  try {
    // Extract main content text
    const mainContent = $('main, article, [role="main"], .content, .post-content').first()
    const contentToExtract = mainContent.length > 0 ? mainContent : $.root()
    
    // Get text content (limit to avoid token limits)
    const rawText = contentToExtract.text().substring(0, 4000)
    
    if (!rawText || rawText.length < 100) {
      return null
    }

    const prompt = `You are an instructions extractor. Given the raw extracted text from a recipe webpage, return ONLY the cooking instructions, in clean steps. If sections are present (e.g. "For the sauce"), preserve them.

Return results as a JSON array of { section: string, steps: string[] }.

Example format:
[
  { "section": "FOR THE RISOTTO", "steps": ["In a large non-stick skillet...", "Add the rice..."] },
  { "section": "FOR THE SCALLOPS", "steps": ["Heat oil...", "Sear scallops..."] }
]

If there are no sections, use empty string for section.

Raw text:
${rawText}`

    const response = await aiComplete(
      [
        {
          role: 'system',
          content: 'You are a helpful recipe instructions extractor. Always return valid JSON array of { section: string, steps: string[] } objects.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      {
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }
    )

    if (!response) {
      return null
    }

    // Parse JSON response
    let parsed: any
    try {
      // Try to extract array from response
      const arrayMatch = response.match(/\[[\s\S]*?\]/)
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0])
      } else {
        // Try parsing as object with array property
        const obj = JSON.parse(response)
        parsed = obj.instructions || obj.steps || obj
        if (!Array.isArray(parsed)) {
          parsed = [parsed]
        }
      }
    } catch {
      return null
    }

    if (!Array.isArray(parsed)) {
      return null
    }

    // Validate and clean results
    const sections: InstructionSection[] = []
    parsed.forEach((item: any) => {
      if (item && typeof item === 'object') {
        const section = cleanText(String(item.section || '')).toUpperCase().replace(/:\s*$/, '')
        const steps = Array.isArray(item.steps) 
          ? item.steps.map((step: any) => cleanText(String(step))).filter(Boolean)
          : []
        
        if (steps.length > 0) {
          sections.push({
            section: section || '',
            steps
          })
        }
      }
    })

    return sections.length > 0 ? sections : null
    } catch (error) {
    console.error('Error in AI instruction parsing:', error)
    return null
  }
}

/**
 * Universal instructions parser - 5-layer cascade
 */
async function parseInstructions(html: string): Promise<string[]> {
  const $ = cheerio.load(html) as cheerio.CheerioAPI
  let methodName = 'none'
  let sections: InstructionSection[] = []

  // LAYER 1: JSON-LD
  const scripts = $('script[type="application/ld+json"]')
  let recipe: any = null

  scripts.each((_, el) => {
    try {
      const jsonData = JSON.parse($(el).html() || '{}')
      
      if (Array.isArray(jsonData)) {
        recipe = jsonData.find((item: any) => {
          const type = item['@type']
          return type === 'Recipe' || 
                 type === 'http://schema.org/Recipe' || 
                 type === 'https://schema.org/Recipe' ||
                 (Array.isArray(type) && type.includes('Recipe'))
        })
      } else if (jsonData['@type'] === 'Recipe' || 
                 jsonData['@type'] === 'http://schema.org/Recipe' ||
                 jsonData['@type'] === 'https://schema.org/Recipe') {
        recipe = jsonData
      } else if (Array.isArray(jsonData['@type']) && jsonData['@type'].includes('Recipe')) {
        recipe = jsonData
      }

      if (recipe) {
        return false // break
      }
    } catch {
      // Ignore JSON parse errors
    }
  })

  if (recipe && recipe.recipeInstructions) {
    sections = parseJSONLDInstructionsStructured(recipe)
    if (sections.length > 0) {
      methodName = 'JSON-LD'
    }
  }

  // LAYER 2: Platform-specific parsers (scoped to containers)
  if (sections.length === 0) {
    // Check Tasty Recipes first (improved detection)
    if ($('.tasty-recipes-instructions').length > 0 || $('.tasty-recipes').length > 0 || $('[data-tasty-recipes-customization]').length > 0) {
      sections = parseTastyInstructions($)
      if (sections.length > 0) {
        methodName = 'Tasty Recipes'
      }
    }
    
    // Check WP Recipe Maker
    if (sections.length === 0 && $('.wprm-recipe-instruction-group').length > 0) {
      sections = parseWPRMInstructions($)
      if (sections.length > 0) {
        methodName = 'WP Recipe Maker'
      }
    }
    
    // Check Mediavine Create
    if (sections.length === 0 && $('.mv-create-instructions').length > 0) {
      sections = parseMediavineInstructions($)
      if (sections.length > 0) {
        methodName = 'Mediavine Create'
      }
    }
  }

  // LAYER 3: Heuristic extraction (scoped to recipe container only)
  if (sections.length === 0) {
    const heuristicResult = parseHeuristicInstructions($)
    if (heuristicResult) {
      sections = heuristicResult
      methodName = 'Heuristics'
    }
  }

  // LAYER 4: Readability fallback (scoped to recipe container only)
  if (sections.length === 0) {
    const readabilityResult = parseReadabilityInstructions($)
    if (readabilityResult) {
      sections = readabilityResult
      methodName = 'Readability'
    }
  }

  // LAYER 5: AI fallback
  if (sections.length === 0) {
    const aiResult = await parseAIInstructions($)
    if (aiResult) {
      sections = aiResult
      methodName = 'AI'
    }
  }

  console.log('Instructions parsed using:', methodName)

  return flattenInstructions(sections)
}

/**
 * LAYER 1: Parse JSON-LD Recipe Schema
 */
function parseJSONLD($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  const scripts = $('script[type="application/ld+json"]')
  let recipe: any = null

  // Find Recipe schema in JSON-LD
  scripts.each((_, el) => {
    try {
      const jsonData = JSON.parse($(el).html() || '{}')
      
      if (Array.isArray(jsonData)) {
        recipe = jsonData.find((item: any) => {
          const type = item['@type']
          return type === 'Recipe' || 
                 type === 'http://schema.org/Recipe' || 
                 type === 'https://schema.org/Recipe' ||
                 (Array.isArray(type) && type.includes('Recipe'))
        })
      } else if (jsonData['@type'] === 'Recipe' || 
                 jsonData['@type'] === 'http://schema.org/Recipe' ||
                 jsonData['@type'] === 'https://schema.org/Recipe') {
        recipe = jsonData
      } else if (Array.isArray(jsonData['@type']) && jsonData['@type'].includes('Recipe')) {
        recipe = jsonData
      }

      if (recipe) {
        return false // break
      }
    } catch {
      // Ignore JSON parse errors
    }
  })

  if (!recipe) {
    return null
  }

  // Extract title
  let title = recipe.name || recipe.headline || ''
  if (typeof title !== 'string') {
    title = ''
  }
  title = cleanText(title)

  // Extract ingredients
  const ingredients = extractIngredientsFromJsonLd(recipe)

  // Extract instructions
  const instructions = parseJSONLDInstructions(recipe)

  // Extract image
  const imageUrl = extractImage($, recipe, baseUrl)

  // Return if we have at least title or ingredients
  if (title || ingredients.length > 0) {
    return {
      title: title || 'Untitled Recipe',
      ingredients,
      instructions,
      imageUrl,
    }
  }

  return null
}

/**
 * Detect recipe platform
 */
function detectPlatform($: cheerio.CheerioAPI): Platform {
  // BBC Good Food - check for ingredients-list structure with specific classes
  // Look for the main ingredients-list container with sections containing h3.ingredients-list__heading
  if ($('section.ingredients-list').length > 0 || 
      $('.ingredients-list section').length > 0 ||
      $('h3.ingredients-list__heading').length > 0) {
    return 'bbc'
  }

  // Tasty Recipes
  if ($('[data-tasty-recipes-customization]').length > 0) {
    return 'tasty'
  }

  // WP Recipe Maker
  if ($('.wprm-recipe-container, [class*="wprm-recipe"]').length > 0) {
    return 'wprm'
  }

  // Mediavine Create
  if ($('.mv-create-ingredients, .mv-create-instructions').length > 0) {
    return 'mediavine'
  }

  return 'unknown'
}

/**
 * LAYER 2A: Parse Tasty Recipes
 */
function parseTasty($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  const recipeContainer = $('[data-tasty-recipes-customization]').first()
  if (recipeContainer.length === 0) {
    return null
  }

  // Extract title
  let title = recipeContainer.find('h2, h3').first().text().trim()
  if (!title) {
    title = $('h1').first().text().trim()
  }
  title = cleanText(title)

  // Extract ingredients with sections
  const ingredients: string[] = []
  const groupHeaders = recipeContainer.find('h4')
  
  if (groupHeaders.length > 0) {
    groupHeaders.each((_, headerEl) => {
      const header = $(headerEl)
      const groupName = header.text().trim()
      const nextSibling = header.next()
      
      // Skip if next sibling is not ul (ingredients are in ul)
      if (!nextSibling.is('ul')) {
        return
      }
      
      if (groupName) {
        const cleanedName = cleanText(groupName).toUpperCase().replace(/:\s*$/, '')
        if (cleanedName) {
          ingredients.push(`${cleanedName}:`)
        }
      }
      
      const list = header.next('ul')
      if (list.length > 0) {
        list.find('li[data-tr-ingredient-checkbox]').each((_, liEl) => {
          const li = $(liEl)
          
          const amount = li.find('[data-amount]').text().trim()
          const unit = li.find('[data-unit]').text().trim()
          const name = li.find('strong').text().trim()
          
          // Extract remaining text
          const cloned = li.clone()
          cloned.find('[data-amount], [data-unit], strong').remove()
          let extraText = cloned.text().trim()
          
          if (extraText) {
            if (amount) extraText = extraText.replace(new RegExp(amount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
            if (unit) extraText = extraText.replace(new RegExp(unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
            if (name) extraText = extraText.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
            extraText = extraText.replace(/^[,;\s]+|[,;\s]+$/g, '').trim()
          }
          
          const ingredientText = cleanIngredientLine(amount, unit, name, extraText)
          if (ingredientText) {
            ingredients.push(`- ${ingredientText}`)
          }
        })
      }
    })
  }

  // Extract instructions
  const instructions: string[] = []
  const instructionsContainer = recipeContainer.find('.tasty-recipes-instructions').first()
  const containerToSearch = instructionsContainer.length > 0 ? instructionsContainer : recipeContainer
  
  const allHeaders = containerToSearch.find('h4')
  allHeaders.each((_, headerEl) => {
    const header = $(headerEl)
    const nextSibling = header.next()
    
    // Instructions are in ol (ingredients are in ul)
    if (nextSibling.is('ol')) {
      const groupName = header.text().trim()
      if (groupName) {
        const cleanedName = cleanText(groupName).toUpperCase().replace(/:\s*$/, '')
        if (cleanedName) {
          instructions.push(`${cleanedName}:`)
        }
      }
      
      const list = header.next('ol')
      if (list.length > 0) {
        list.find('li').each((_, liEl) => {
          const text = $(liEl).text().trim()
          const cleaned = cleanText(text)
          if (cleaned) {
            instructions.push(cleaned)
          }
        })
      }
    }
  })

  const recipeImage = recipeContainer.find('img').first().attr('src')
  const imageUrl = resolveUrl(recipeImage, baseUrl) || extractImage($, null, baseUrl)

  if (title || ingredients.length > 0) {
    return {
      title: title || 'Untitled Recipe',
      ingredients,
      instructions,
      imageUrl,
    }
  }

  return null
}

/**
 * LAYER 2B: Parse WP Recipe Maker
 */
function parseWPRM($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  const recipeContainer = $('.wprm-recipe-container, [class*="wprm-recipe"]').first()
  if (recipeContainer.length === 0) {
    return null
  }

  let title = recipeContainer.find('.wprm-recipe-name, .wprm-recipe-title').first().text().trim()
  if (!title) {
    title = $('h1').first().text().trim()
  }
  title = cleanText(title)

  const ingredients: string[] = []
  const combineIngredientParts = (ingEl: cheerio.Element, $: cheerio.CheerioAPI): string => {
    const fullText = $(ingEl).text().trim()
    if (fullText) {
      return fullText
    }
    const amount = $(ingEl).find('.wprm-recipe-ingredient-amount').text().trim()
    const unit = $(ingEl).find('.wprm-recipe-ingredient-unit').text().trim()
    const name = $(ingEl).find('.wprm-recipe-ingredient-name').text().trim()
    const parts: string[] = []
    if (amount) parts.push(amount)
    if (unit) parts.push(unit)
    if (name) parts.push(name)
    return parts.join(' ').trim()
  }
  
  const ingredientGroups = recipeContainer.find('.wprm-recipe-ingredient-group')
  
  if (ingredientGroups.length > 0) {
    ingredientGroups.each((_, groupEl) => {
      const group = $(groupEl)
      const groupName = group.find('.wprm-recipe-ingredient-group-name').text().trim()
      
      if (groupName) {
        const cleanedName = cleanText(groupName).toUpperCase()
        if (cleanedName) {
          ingredients.push(`${cleanedName}:`)
        }
      }
      
      group.find('.wprm-recipe-ingredient').each((_, ingEl) => {
        const ingText = combineIngredientParts(ingEl, $)
        const cleaned = cleanText(ingText)
        if (cleaned) {
          ingredients.push(`- ${cleaned}`)
        }
      })
    })
    } else {
    recipeContainer.find('.wprm-recipe-ingredient').each((_, ingEl) => {
      const ingText = combineIngredientParts(ingEl, $)
      const cleaned = cleanText(ingText)
      if (cleaned) {
        ingredients.push(cleaned)
      }
    })
  }

  const instructions: string[] = []
  const instructionGroups = recipeContainer.find('.wprm-recipe-instruction-group')
  
  if (instructionGroups.length > 0) {
    instructionGroups.each((_, groupEl) => {
      const group = $(groupEl)
      const groupName = group.find('.wprm-recipe-instruction-group-name').text().trim()
      
      if (groupName) {
        instructions.push(`${groupName}:`)
      }
      
      group.find('.wprm-recipe-instruction').each((_, instEl) => {
        const instText = $(instEl).text().trim()
        const cleaned = cleanText(instText)
        if (cleaned) {
          instructions.push(cleaned)
        }
      })
    })
  } else {
    recipeContainer.find('.wprm-recipe-instruction').each((_, instEl) => {
      const instText = $(instEl).text().trim()
      const cleaned = cleanText(instText)
      if (cleaned) {
        instructions.push(cleaned)
      }
    })
  }

  const recipeImage = recipeContainer.find('.wprm-recipe-image img, .wprm-recipe-header-image img').first().attr('src')
  const imageUrl = resolveUrl(recipeImage, baseUrl) || extractImage($, null, baseUrl)

  if (title || ingredients.length > 0) {
    return {
      title: title || 'Untitled Recipe',
      ingredients,
      instructions,
      imageUrl,
    }
  }

  return null
}

/**
 * LAYER 2C: Parse Mediavine Create
 */
function parseMediavine($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  const ingredientsContainer = $('.mv-create-ingredients').first()
  const instructionsContainer = $('.mv-create-instructions').first()
  
  if (ingredientsContainer.length === 0 && instructionsContainer.length === 0) {
    return null
  }

  let title = $('h1').first().text().trim()
  title = cleanText(title) || 'Untitled Recipe'

  const ingredients: string[] = []
  if (ingredientsContainer.length > 0) {
    ingredientsContainer.find('li').each((_, liEl) => {
      const text = $(liEl).text().trim()
      const cleaned = cleanText(text)
      if (cleaned) {
        ingredients.push(cleaned)
      }
    })
  }

  const instructions: string[] = []
  if (instructionsContainer.length > 0) {
    instructionsContainer.find('li').each((_, liEl) => {
      const text = $(liEl).text().trim()
      const cleaned = cleanText(text)
      if (cleaned) {
        instructions.push(cleaned)
      }
    })
  }

  const imageUrl = extractImage($, null, baseUrl)

  return {
    title,
    ingredients,
    instructions,
    imageUrl,
  }
}

/**
 * LAYER 2D: Parse BBC Good Food
 */
function parseBBC($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  // Find the main ingredients-list container
  // BBC uses: section.ingredients-list or .ingredients-list section
  const ingredientsContainer = $('section.ingredients-list, .ingredients-list').first()
  
  if (ingredientsContainer.length === 0) {
    return null
  }

  // Find all sections within the ingredients container that have headings
  // BBC structure: section > h3.ingredients-list__heading + ul.ingredients-list.list
  const sectionsWithHeadings = ingredientsContainer.find('section').filter((_i: number, el: cheerio.Element) => {
    return $(el).find('h3.ingredients-list__heading').length > 0
  })

  // If no sections found, try finding h3 headings directly and their parent sections
  let sectionsToProcess: ReturnType<typeof $>
  if (sectionsWithHeadings.length === 0) {
    // Fallback: find h3 headings and get their parent sections
    const headings = ingredientsContainer.find('h3.ingredients-list__heading')
    if (headings.length === 0) {
      return null
    }
    // Get unique parent sections
    const sectionSet = new Set<cheerio.Element>()
    headings.each((_i: number, headingEl: cheerio.Element) => {
      const section = $(headingEl).closest('section')
      if (section.length > 0) {
        sectionSet.add(section.get(0)!)
      }
    })
    sectionsToProcess = $(Array.from(sectionSet))
  } else {
    sectionsToProcess = sectionsWithHeadings
  }

  if (sectionsToProcess.length === 0) {
    return null
  }

  let title = $('h1').first().text().trim()
  title = cleanText(title) || 'Untitled Recipe'

  // Extract ingredients as flat array with section headers
  const ingredients: string[] = []
  
  sectionsToProcess.each((_i: number, sectionEl: cheerio.Element) => {
    const section = $(sectionEl)
    
    // Extract section header
    const sectionHeading = section.find('h3.ingredients-list__heading').first()
    const sectionTitle = sectionHeading.text().trim()
    const cleanedSectionTitle = cleanText(sectionTitle).toUpperCase().replace(/:\s*$/, '')
    
    // Add section header if it exists
    if (cleanedSectionTitle) {
      ingredients.push(`${cleanedSectionTitle}:`)
    }
    
    // Extract items from li.ingredients-list__item within this section
    let list = section.find('ul.ingredients-list.list, ul.list').first()
    if (list.length === 0) {
      // Fallback: find ul that follows the heading
      const ul = sectionHeading.next('ul')
      if (ul.length > 0) {
        list = ul
      }
    }
    
    if (list.length > 0) {
      list.find('li.ingredients-list__item').each((_i2: number, liEl: cheerio.Element) => {
        const li = $(liEl)
        
        // Extract quantity, ingredient name, and note
        const quantity = li.find('.ingredients-list__item-quantity').text().trim()
        // Ingredient can be in span or a link
        const ingredientSpan = li.find('.ingredients-list__item-ingredient').text().trim()
        const ingredientLink = li.find('a.link--styled .ingredients-list__item-ingredient').text().trim()
        const ingredient = ingredientSpan || ingredientLink
        const note = li.find('.ingredients-list__item-note').text().trim()
        
        // Build full ingredient line: quantity + ingredient + note
        const parts: string[] = []
        if (quantity) parts.push(quantity)
        if (ingredient) parts.push(ingredient)
        if (note) parts.push(note)
        
        const fullText = parts.join(' ').trim()
        if (fullText) {
          const cleaned = cleanText(fullText)
          if (cleaned) {
            ingredients.push(`- ${cleaned}`)
          }
        }
      })
    }
  })

  // If we found ingredients, return them
  if (ingredients.length > 0) {
    const instructions: string[] = []
    // Extract instructions (BBC uses standard ol/li structure)
    // Scope to recipe content area to avoid comments
    const recipeContent = $('article, main, [role="main"], .content, .post-content, .entry-content').first()
    const searchArea = recipeContent.length > 0 ? recipeContent : $.root()
    
    searchArea.find('ol').each((_i: number, olEl: cheerio.Element) => {
      const ol = $(olEl)
      ol.find('li').each((_i2: number, liEl: cheerio.Element) => {
        const text = $(liEl).text().trim()
        const cleaned = cleanText(text)
        if (cleaned) {
          instructions.push(cleaned)
        }
      })
    })

    const imageUrl = extractImage($, null, baseUrl)

    return {
      title,
      ingredients,
      instructions,
      imageUrl,
    }
  }

  return null
}

/**
 * Check if text looks like an ingredient (contains numbers, units, fractions)
 */
function looksLikeIngredient(text: string): boolean {
  const ingredientPatterns = [
    /\d+\s*(cup|tbsp|tsp|oz|lb|g|kg|ml|l|pound|ounce|gram|kilogram|milliliter|liter)/i,
    /\d+\/\d+/, // fractions
    /\d+/, // numbers
    /(cup|cups|tablespoon|teaspoon|ounce|pound)/i,
  ]
  
  return ingredientPatterns.some(pattern => pattern.test(text))
}

/**
 * LAYER 3: Heuristic extraction
 */
function parseHeuristics($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  // Find main content area
  const mainContent = $('main, article, [role="main"], .content, .post-content').first()
  const searchArea = mainContent.length > 0 ? mainContent : $.root()

  let title = $('h1').first().text().trim()
  if (!title) {
    title = $('title').text().trim()
  }
  title = cleanText(title) || 'Untitled Recipe'

  // Extract ingredients - look for ul where >50% of items look like ingredients
  const ingredients: string[] = []
  const allLists = searchArea.find('ul')
  
  let bestIngredientsList: ReturnType<typeof $> | null = null
  let bestScore = 0
  
  allLists.each((_i: number, listEl: cheerio.Element) => {
    const list = $(listEl)
    const items = list.find('li')
    if (items.length < 2) return
    
    let ingredientCount = 0
    items.each((_i2: number, itemEl: cheerio.Element) => {
      const text = $(itemEl).text().trim()
      if (looksLikeIngredient(text)) {
        ingredientCount++
      }
    })
    
    const score = ingredientCount / items.length
    if (score > 0.5 && score > bestScore) {
      bestScore = score
      bestIngredientsList = list
    }
  })
  
  if (bestIngredientsList !== null) {
    const list: ReturnType<typeof $> = bestIngredientsList
    // Check for section heading before the list
    const prevHeading = list.prevAll('h2, h3, h4').first()
    if (prevHeading.length > 0) {
      const headingText = cleanText(prevHeading.text()).toUpperCase()
      if (headingText && (headingText.includes('INGREDIENT') || headingText.length < 30)) {
        ingredients.push(`${headingText}:`)
      }
    }
    
    list.find('li').each((_i: number, liEl: cheerio.Element) => {
      const text = $(liEl).text().trim()
      const cleaned = cleanText(text)
      if (cleaned) {
        ingredients.push(cleaned)
      }
    })
  }

  // Extract instructions - find longest ordered list
  const instructions: string[] = []
  const allOrderedLists = searchArea.find('ol')
  
  let longestList: ReturnType<typeof $> | null = null
  let maxLength = 0
  
  allOrderedLists.each((_i: number, listEl: cheerio.Element) => {
    const list = $(listEl)
    const items = list.find('li')
    if (items.length > maxLength && items.length >= 3) {
      maxLength = items.length
      longestList = list
    }
  })
  
  if (longestList !== null) {
    const list: ReturnType<typeof $> = longestList
    // Check for section heading
    const prevHeading = list.prevAll('h2, h3, h4').first()
    if (prevHeading.length > 0) {
      const headingText = cleanText(prevHeading.text()).toUpperCase()
      if (headingText && (headingText.includes('INSTRUCTION') || headingText.includes('METHOD') || headingText.includes('DIRECTION') || headingText.length < 30)) {
        instructions.push(`${headingText}:`)
      }
    }
    
    list.find('li').each((_i: number, liEl: cheerio.Element) => {
      const text = $(liEl).text().trim()
      const cleaned = cleanText(text)
      if (cleaned) {
        instructions.push(cleaned)
      }
    })
  }

  const imageUrl = extractImage($, null, baseUrl)

  if (ingredients.length > 0 || instructions.length > 0) {
    return {
      title,
      ingredients,
      instructions,
      imageUrl,
    }
  }

  return null
}

/**
 * LAYER 4: Readability fallback
 * Simple content extraction without external library
 */
function parseReadability($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  // Find main content (article, main, or largest content div)
  const candidates = $('article, main, [role="main"], .content, .post-content, .entry-content')
  let mainContent = candidates.first()
  
  if (mainContent.length === 0) {
    // Find largest div by text length
    let largestDiv: ReturnType<typeof $> | null = null
    let maxLength = 0
    
    $('div').each((_, divEl) => {
      const div = $(divEl)
      const textLength = div.text().length
      if (textLength > maxLength && textLength > 500) {
        maxLength = textLength
        largestDiv = div
      }
    })
    
    if (largestDiv) {
      mainContent = largestDiv
    } else {
      mainContent = $.root()
    }
  }

  let title = $('h1').first().text().trim()
  if (!title) {
    title = $('title').text().trim()
  }
  title = cleanText(title) || 'Untitled Recipe'

  // Extract ingredients from lists in main content
  const ingredients: string[] = []
  mainContent.find('ul').each((_, listEl) => {
    const list = $(listEl)
    const items = list.find('li')
    if (items.length < 2) return
    
    let ingredientCount = 0
    items.each((_, itemEl) => {
      const text = $(itemEl).text().trim()
      if (looksLikeIngredient(text)) {
        ingredientCount++
      }
    })
    
    if (ingredientCount / items.length > 0.5) {
      list.find('li').each((_, liEl) => {
        const text = $(liEl).text().trim()
        const cleaned = cleanText(text)
        if (cleaned) {
          ingredients.push(cleaned)
        }
      })
      return false // break
    }
  })

  // Extract instructions from longest ordered list
  const instructions: string[] = []
  let longestList: ReturnType<typeof $> | null = null
  let maxLength = 0
  
  mainContent.find('ol').each((_i: number, listEl: cheerio.Element) => {
    const list = $(listEl)
    const items = list.find('li')
    if (items.length > maxLength && items.length >= 3) {
      maxLength = items.length
      longestList = list
    }
  })
  
  if (longestList !== null) {
    const list: ReturnType<typeof $> = longestList
    list.find('li').each((_i: number, liEl: cheerio.Element) => {
      const text = $(liEl).text().trim()
      const cleaned = cleanText(text)
      if (cleaned) {
        instructions.push(cleaned)
      }
    })
  }

  const imageUrl = extractImage($, null, baseUrl)

  if (ingredients.length > 0 || instructions.length > 0) {
    return {
      title,
      ingredients,
      instructions,
      imageUrl,
    }
  }

  return null
}

/**
 * LAYER 5: AI Fallback (placeholder)
 */
function parseAIFallback($: cheerio.CheerioAPI, baseUrl: string): ParsedRecipe | null {
  // Placeholder for future AI-based extraction
  // Would use LLM to extract recipe from HTML
  return null
}

async function generateExpectedMatchesAI(
  ingredients: string[] | IngredientGroup[],
  instructions: string[] | InstructionGroup[],
): Promise<Record<string, string[]> | null> {
  try {
    const ingGroups: IngredientGroup[] = Array.isArray(ingredients) && ingredients.length > 0 && typeof ingredients[0] === 'object'
      ? (ingredients as IngredientGroup[])
      : [{ section: '', items: (ingredients as string[]) || [] }]

    const instrGroups: InstructionGroup[] = Array.isArray(instructions) && instructions.length > 0 && typeof instructions[0] === 'object'
      ? (instructions as InstructionGroup[])
      : [{ section: '', steps: (instructions as string[]) || [] }]

    const ingLines: string[] = []
    ingGroups.forEach((group, gIdx) => {
      (group.items || []).forEach((item, iIdx) => {
        ingLines.push(`${gIdx}-${iIdx}: ${item}`)
      })
    })

    const stepLines: string[] = []
    let counter = 0
    instrGroups.forEach((group) => {
      (group.steps || []).forEach((step) => {
        stepLines.push(`step-${counter}: ${step}`)
        counter += 1
      })
    })

    const prompt = `You are labeling which ingredients apply to each instruction step for a recipe.
Return ONLY a JSON object mapping step ids to arrays of ingredient ids.

Ingredients (id: text):
${ingLines.join('\n')}

Steps (id: text):
${stepLines.join('\n')}

Output format example:
{
  "step-0": ["0-1", "0-3"],
  "step-1": []
}`

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

    const parsed = JSON.parse(response)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string[]>
    }
  } catch (err) {
    console.warn('AI expectedMatches generation failed:', err)
  }
  return null
}

/**
 * Main parsing function - 5-layer universal parser
 */
export async function parseRecipe(html: string, url: string): Promise<ParsedRecipe> {
  const $ = cheerio.load(html) as cheerio.CheerioAPI
  const baseUrl = url

  // LAYER 1: JSON-LD (always preferred for ingredients)
  const jsonLdResult = parseJSONLD($, baseUrl)
  
  // LAYER 2: Platform-specific parsers (for ingredients)
  const platform = detectPlatform($)
  let platformResult: ParsedRecipe | null = null

  switch (platform) {
    case 'bbc':
      platformResult = parseBBC($, baseUrl)
      break
    case 'tasty':
      platformResult = parseTasty($, baseUrl)
      break
    case 'wprm':
      platformResult = parseWPRM($, baseUrl)
      break
    case 'mediavine':
      platformResult = parseMediavine($, baseUrl)
      break
  }

  // LAYER 3: Heuristic extraction (for ingredients)
  const heuristicResult = parseHeuristics($, baseUrl)

  // LAYER 4: Readability fallback (for ingredients)
  const readabilityResult = parseReadability($, baseUrl)

  // Extract ingredients from best available source
  // When a platform-specific parser succeeds (like BBC), use ONLY that result
  // This prevents duplication from JSON-LD which may have flat lists
  const ingredients = (platformResult && 
    Array.isArray(platformResult.ingredients) && 
    platformResult.ingredients.length > 0)
    ? platformResult.ingredients 
    : (jsonLdResult && Array.isArray(jsonLdResult.ingredients) && jsonLdResult.ingredients.length > 0)
    ? jsonLdResult.ingredients 
    : (heuristicResult && Array.isArray(heuristicResult.ingredients) && heuristicResult.ingredients.length > 0)
      ? heuristicResult.ingredients 
      : (readabilityResult?.ingredients || [])

  // Extract title from best available source
  const title = jsonLdResult?.title || platformResult?.title || heuristicResult?.title || readabilityResult?.title || 'Untitled Recipe'

  // Extract image from best available source
  const imageUrl = jsonLdResult?.imageUrl || platformResult?.imageUrl || heuristicResult?.imageUrl || readabilityResult?.imageUrl || null

  // Use universal instruction parser (5-layer cascade)
  const instructions = await parseInstructions(html)

  // Return combined result
  return {
    title,
    ingredients,
    instructions,
    imageUrl,
  }
}

/**
 * POST /api/recipes/import-from-url
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { url, userId } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required and must be a string' },
        { status: 400 }
      )
    }

    let urlObj: URL
    try {
      urlObj = new URL(url)
      } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    let html: string
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

      html = await response.text()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Parse recipe using universal parser
    const parsed = await parseRecipe(html, url)

    // Generate AI tags
    let aiTags: string[] = []
    try {
      // Convert structured ingredients to flat array for AI tagging
      const ingredientsForAI = Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0 && typeof parsed.ingredients[0] === 'object' && 'section' in parsed.ingredients[0]
        ? (parsed.ingredients as { section: string; items: string[] }[]).flatMap(g => g.items)
        : (parsed.ingredients as string[])
      
      aiTags = await generateTagsForRecipe({
        title: parsed.title,
        ingredients: ingredientsForAI,
        instructions: parsed.instructions.length > 0 ? parsed.instructions.join('\n\n') : '',
      })
    } catch (error) {
      console.error('Error generating AI tags for imported recipe:', error)
    }

    // Generate AI expectedMatches for highlighting
    let aiExpectedMatches: Record<string, string[]> | null = null
    if (!process.env.OPENAI_API_KEY) {
      console.warn('Skipping AI expectedMatches: OPENAI_API_KEY missing')
    } else {
      try {
        console.log('[import] OPENAI_API_KEY detected, generating expectedMatches...')
        aiExpectedMatches = await generateExpectedMatchesAI(parsed.ingredients, parsed.instructions)
        if (aiExpectedMatches) {
          console.log(
            `AI expectedMatches generated for import: ${parsed.title || 'untitled'} (${
              Object.keys(aiExpectedMatches).length
            } steps)`,
          )
        } else {
          console.warn('[import] AI expectedMatches returned null/empty')
        }
      } catch (error) {
        console.warn('[import] AI expectedMatches generation failed:', error)
      }
    }

    // Prepare data for Supabase
    const recipeData: any = {
      title: parsed.title,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions.length > 0 ? parsed.instructions.join('\n\n') : 'No instructions found',
      tags: aiTags,
      source_url: url,
    }
    if (aiExpectedMatches) {
      recipeData.expected_matches = aiExpectedMatches
    }

    // Insert into Supabase
    const supabase = createServerClient()
    
    // Try to insert with created_by first, fallback without it if column doesn't exist
    let data, error
    if (userId && typeof userId === 'string') {
      // Try with created_by
      let result = await supabase
        .from('recipes')
        .insert({ ...recipeData, created_by: userId })
        .select()
        .single()
      
      data = result.data
      error = result.error
      
      // If error is about missing column, retry without created_by or expected_matches
      if (error && (error.message.includes('created_by') || error.message.includes('expected_matches') || error.message.includes('column') || error.code === '42703')) {
        const fallbackData = { ...recipeData }
        delete (fallbackData as any).expected_matches
        result = await supabase
          .from('recipes')
          .insert(fallbackData)
          .select()
          .single()
        
        data = result.data
        error = result.error
      }
    } else {
      // No userId, insert without created_by
      let result = await supabase
        .from('recipes')
        .insert(recipeData)
        .select()
        .single()
      
      data = result.data
      error = result.error

      if (error && (error.message.includes('expected_matches') || error.message.includes('column') || error.code === '42703')) {
        const fallbackData = { ...recipeData }
        delete (fallbackData as any).expected_matches
        result = await supabase
          .from('recipes')
          .insert(fallbackData)
          .select()
          .single()
        
        data = result.data
        error = result.error
      }
    }

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    // Upload optimized image if available
    let finalImageUrl: string | null = null
    if (parsed.imageUrl && data.id) {
      try {
        const imageResponse = await fetch(parsed.imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        if (imageResponse.ok) {
          const imageArrayBuffer = await imageResponse.arrayBuffer()
          const imageBuffer = Buffer.from(imageArrayBuffer)
          
          // Determine original extension for cleanup
          let extension = 'jpg'
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
          
          if (contentType.includes('png')) {
            extension = 'png'
          } else if (contentType.includes('webp')) {
            extension = 'webp'
          } else if (contentType.includes('gif')) {
            extension = 'gif'
          } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            extension = 'jpg'
          } else {
            const urlLower = parsed.imageUrl.toLowerCase()
            if (urlLower.includes('.png')) {
              extension = 'png'
            } else if (urlLower.includes('.webp')) {
              extension = 'webp'
            } else if (urlLower.includes('.gif')) {
              extension = 'gif'
            }
          }
          
          // Upload optimized image (utility handles optimization and cleanup)
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
        }
      } catch (imageError) {
        console.error('Error processing recipe image:', imageError)
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
