'use client'

import { useState, useMemo, ReactNode, useEffect, useRef } from 'react'

interface IngredientGroup {
  section: string
  items: string[]
}

interface InstructionGroup {
  section: string
  steps: string[]
}

interface RecipeInteractionWrapperProps {
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
  children?: {
    sidebarTop?: ReactNode
    mainContentTop?: ReactNode
    mainContentBottom?: ReactNode
  }
}

const UNIT_WORDS = [
  'g', 'kg', 'gram', 'grams', 'kilogram', 'kilograms',
  'ml', 'l', 'liter', 'liters', 'milliliter', 'milliliters',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'tsp', 'tbsp', 'teaspoon', 'teaspoons', 'tablespoon', 'tablespoons',
  'cup', 'cups', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons',
  'pinch', 'pinches', 'dash', 'dashes', 'handful', 'handfuls',
  'clove', 'cloves', 'sprig', 'sprigs', 'stalk', 'stalks', 'stick', 'sticks',
  'bunch', 'bunches', 'head', 'heads', 'bulb', 'bulbs', 'ear', 'ears',
  'slice', 'slices', 'piece', 'pieces', 'can', 'cans', 'tin', 'tins',
  'jar', 'jars', 'bottle', 'bottles', 'pack', 'packs', 'package', 'packages',
  'box', 'boxes', 'bag', 'bags', 'container', 'containers'
]

const PREP_WORDS = [
  'chopped', 'sliced', 'diced', 'minced', 'grated', 'peeled', 'crushed',
  'finely', 'roughly', 'coarsely', 'thinly', 'thickly',
  'fresh', 'dried', 'ground', 'whole', 'large', 'medium', 'small',
  'extra', 'virgin', 'boneless', 'skinless', 'fat-free', 'low-fat',
  'organic', 'unsalted', 'salted', 'cold', 'hot', 'warm', 'melted',
  'room', 'temperature', 'softened', 'beaten', 'whisked', 'sifted',
  'divided', 'separated', 'optional', 'garnish', 'taste', 'needed',
  'removed', 'reserved', 'drained', 'rinsed', 'cleaned', 'trimmed',
  'halved', 'quartered', 'cubed', 'chunks', 'strips', 'wedges',
  'beards', 'scrubbed', 'washed', 'bruised', 'leaves', 'only', 'red', 'green',
  'shell', 'shells', 'skin', 'skins', 'bone', 'bones', 'seed', 'seeds',
  'stem', 'stems', 'root', 'roots', 'tail', 'tails', 'extract',
  'granulated', 'caster', 'powdered', 'icing', 'superfine', 'white',
  'active', 'dry', 'instant', 'quick', 'rise', 'plain', 'all-purpose', 'regular', 'fast', 'action',
  'cut', 'cutting', 'cooled', 'cool', 'cooling', 'chilled', 'refrigerated',
  'refrigerator', 'fridge', 'freezer', 'stored', 'leftover', 'leftovers',
  'half', 'halves', 'third', 'thirds', 'quarter', 'quarters',
  'plus', 'more'
]

const STOP_WORDS = [
  'and', 'or', 'the', 'a', 'an', 'of', 'in', 'with', 'for', 'to', 'from', 'into', 'as'
]

const UNIT_REGEX = new RegExp(`\\b(${UNIT_WORDS.join('|')})\\b`, 'gi')
const PREP_REGEX = new RegExp(`\\b(${PREP_WORDS.join('|')})\\b`, 'gi')
const STOP_WORD_REGEX = new RegExp(`\\b(${STOP_WORDS.join('|')})\\b`, 'gi')

const HEAD_NOUN_IGNORE_WORDS = new Set([
  ...PREP_WORDS,
  ...STOP_WORDS,
  'into', 'onto', 'over', 'under'
])

/**
 * Aggressively cleans an ingredient string to extract the core food item.
 * Removes quantities, units, prep methods, and common stop words.
 */
function cleanIngredientText(text: string): string {
  let cleaned = text.toLowerCase()

  // 1. Remove parentheticals (often contain extra info like "melted" or "approx")
  cleaned = cleaned.replace(/\([^)]*\)/g, '')

  // 2. Remove quantities (integers, decimals, fractions)
  // Matches: 1, 1.5, 1/2, 1 1/2
  cleaned = cleaned.replace(/(^|\s)\d+[\d\/\.]*\s*/g, ' ')

  // 3. Remove units and containers (singular and plural)
  cleaned = cleaned.replace(UNIT_REGEX, ' ')

  // 4. Remove preparation methods and descriptors
  cleaned = cleaned.replace(PREP_REGEX, ' ')

  // 5. Remove common stop words
  cleaned = cleaned.replace(STOP_WORD_REGEX, ' ')

  // 6. Remove punctuation and extra whitespace
  cleaned = cleaned.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * Basic pluralization handler
 * Converts "onions" -> "onion", "berries" -> "berry", etc.
 */
function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('es')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function getHeadNoun(tokens: string[]): string | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const candidate = tokens[i]
    if (!candidate) continue
    if (candidate.length <= 1) continue
    if (HEAD_NOUN_IGNORE_WORDS.has(candidate)) continue
    return candidate
  }

  return tokens.length > 0 ? tokens[tokens.length - 1] : null
}

const stripTrailing = (value: string) => value.replace(/[:.]\s*$/, '').trim().toLowerCase()

function normalizeIngredientGroups(groups: IngredientGroup[]): IngredientGroup[] {
  return groups.map((group) => {
    const section = group.section?.trim() || ''
    const normalizedSection = stripTrailing(section)
    const cleanedItems = (group.items || [])
      .map((item) => (item || '').trim())
      .filter((item) => item.length > 0)
      .filter((item) => {
        if (!normalizedSection) return true
        return stripTrailing(item) !== normalizedSection
      })

    return { section, items: cleanedItems }
  })
}

function normalizeInstructionGroups(groups: InstructionGroup[]): InstructionGroup[] {
  return groups.map((group) => {
    const section = group.section?.trim() || ''
    const normalizedSection = stripTrailing(section)
    const cleanedSteps = (group.steps || [])
      .map((step) => (step || '').trim())
      .filter((step) => step.length > 0)
      .filter((step) => {
        if (!normalizedSection) return true
        return stripTrailing(step) !== normalizedSection
      })

    return { section, steps: cleanedSteps }
  })
}

function mapIngredientsToSteps(ingredients: IngredientGroup[], instructions: InstructionGroup[]): Record<string, string[]> {
  const mapping: Record<string, string[]> = {}
  
  // 1. Pre-process ingredients into a "Bag of Words" model
  const processedIngredients: { 
    original: string
    id: string
    tokens: string[]
    headNoun: string | null
  }[] = []

  ingredients.forEach((group, groupIdx) => {
    group.items.forEach((item, itemIdx) => {
      const cleanText = cleanIngredientText(item)
      // Split into tokens and singularize each
      const tokens = cleanText
        .split(' ')
        .filter(t => t.length > 1) // Ignore single chars
        .map(singularize)
      
      if (tokens.length > 0) {
        const headNoun = getHeadNoun(tokens)
        processedIngredients.push({
          original: item,
          id: `${groupIdx}-${itemIdx}`,
          tokens,
          headNoun
        })
      }
    })
  })

  // 2. Iterate instructions and find matches
  let globalStepIndex = 0
  instructions.forEach((instructionGroup) => {
    instructionGroup.steps.forEach((step) => {
      const stepId = `step-${globalStepIndex}`
      const stepText = step.toLowerCase()
      // Clean step text slightly for easier matching (remove punctuation)
      const cleanStepText = stepText.replace(/[^\w\s]/g, ' ')
      const stepTokens = cleanStepText.split(' ').map(singularize)
      const stepTokenSet = new Set(stepTokens)

      const matchedIngredientIds: string[] = []

      // PHASE 1: Gather all candidates
      // Store candidates as { id: string, sectionIdx: number, sectionMatches: number, cleanName: string }
      // Actually we can just count section matches first?
      
      interface Candidate {
         id: string
         sectionIdx: number
         cleanName: string // Used to detect duplicates (e.g. "butter" vs "butter")
         score: number // match count or percentage
      }
      const candidates: Candidate[] = []
      
      ingredients.forEach((ingGroup, groupIdx) => {
        let isSectionMismatch = false
        if (instructionGroup.section && ingGroup.section) {
           const instSection = instructionGroup.section.toLowerCase()
           const ingSection = ingGroup.section.toLowerCase()
           const hasOverlap = (s1: string, s2: string) => {
             const tokens1 = s1.split(' ').filter(t => t.length > 3)
             const tokens2 = s2.split(' ').filter(t => t.length > 3)
             return tokens1.some(t => s2.includes(t)) || tokens2.some(t => s1.includes(t))
           }
           if (hasOverlap(instSection, ingSection)) {
              // Strong match -> Great.
           } else {
              const genericHeaders = ['method', 'preparation', 'directions', 'instructions', 'cook']
              const isGeneric = genericHeaders.some(h => instSection.includes(h))
              if (!isGeneric) {
                 isSectionMismatch = true
              }
           }
        }
        if (isSectionMismatch) return 

            ingGroup.items.forEach((item, itemIdx) => {
            const fullId = `${groupIdx}-${itemIdx}`
            const ing = processedIngredients.find(p => p.id === fullId)
            if (!ing) return

            let matchCount = 0
            const matchedTokens = new Set<string>()
            ing.tokens.forEach(token => {
              if (stepTokenSet.has(token)) {
                matchCount++
                matchedTokens.add(token)
              } else {
                if (cleanStepText.includes(token)) {
                  matchCount++
                  matchedTokens.add(token)
                }
              }
            })

            const matchPercentage = matchCount / ing.tokens.length
            let isMatch = false
            
            // 1. If 100% match, always accept
            if (matchPercentage === 1) {
              isMatch = true
            } 
            // 2. If partial match (>= 50%) - Relaxed from 66% to allow 2-word items (1/2) to match via Head Noun
            else if (matchPercentage >= 0.5) {
              // HEAD NOUN HEURISTIC:
              const headNoun = ing.headNoun
              if (headNoun && (matchedTokens.has(headNoun) || cleanStepText.includes(headNoun))) {
                 isMatch = true
              } else {
                 // Fallback: check if the *full phrase* exists in the step text 
                 const phrase = ing.tokens.join(' ')
                 if (cleanStepText.includes(phrase)) {
                    isMatch = true
                 }
              }
            }
            
            if (isMatch) {
                // Store candidate
                candidates.push({
                    id: ing.id,
                    sectionIdx: groupIdx,
                    cleanName: ing.tokens.join(' '), // Use tokens as canonical name representation
                    score: matchCount
                })
            }
        })
      })

      // PHASE 2: Resolve Section Affinity for Duplicates and Subset Overlaps
      // 1. Calculate Section Scores (how many unique matches per section)
      const sectionScores: Record<number, number> = {}
      candidates.forEach(c => {
          sectionScores[c.sectionIdx] = (sectionScores[c.sectionIdx] || 0) + 1
      })
      
      // Determine Winning Section(s) - section with max score
      let maxSectionScore = -1
      Object.values(sectionScores).forEach(score => {
          if (score > maxSectionScore) maxSectionScore = score
      })
      
      // Helper to get candidate tokens from processed list
      const getTokens = (id: string) => {
          const p = processedIngredients.find(i => i.id === id)
          return p ? new Set(p.tokens) : new Set<string>()
      }

      // 2. Filter candidates
      const finalCandidates: Candidate[] = []
      
      // First pass: Collect all "Winning Candidates" (those in winning sections)
      // We need these to compare against "Losing Candidates" for subset checks
      const winningCandidates = candidates.filter(c => (sectionScores[c.sectionIdx] || 0) === maxSectionScore)
      
      candidates.forEach(c => {
          const score = sectionScores[c.sectionIdx] || 0
          const isWinner = score === maxSectionScore
          
          if (isWinner) {
              // Always keep winners (unless we want to do strict duplicate checking within winners? Nah)
              finalCandidates.push(c)
          } else {
              // This is a "Losing Candidate".
              // Check if it OVERLAPS with any Winning Candidate.
              // e.g. Loser "Sugar" {sugar} vs Winner "Brown Sugar" {brown, sugar}.
              // {sugar} overlaps {brown, sugar}. -> Discard Loser.
              
              const loserTokens = getTokens(c.id)
              let hasOverlap = false
              
              for (const winner of winningCandidates) {
                  const winnerTokens = getTokens(winner.id)
                  
                  // Check if ANY loser token is in winner tokens
                  // (Except common stop words? No, tokens are already cleaned/singularized)
                  for (const t of loserTokens) {
                      if (winnerTokens.has(t)) {
                          hasOverlap = true
                          break
                      }
                  }
                  
                  if (hasOverlap) {
                      break
                  }
              }
              
              if (!hasOverlap) {
                  // If NO overlap, we keep it. It might be a unique ingredient from a non-dominant section.
                  finalCandidates.push(c)
              }
          }
      })
      
      // 3. Final Duplicate Check by Name (Clean Name Collision Resolution)
      // This handles cases where "Butter" (Loser) is NOT a subset of "Butter" (Winner) mathematically (sets are equal),
      // but we still want to suppress the Loser because we prefer the Winner.
      // With Overlap Logic:
      // "Butter" {butter} overlaps "Butter" {butter}. -> Discard Loser.
      // Correct.
      
      finalCandidates.forEach(c => matchedIngredientIds.push(c.id))

      mapping[stepId] = matchedIngredientIds
      globalStepIndex++
    })
  })

  return mapping
}

export default function RecipeInteractionWrapper({ ingredients, instructions, children }: RecipeInteractionWrapperProps) {
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const ingredientRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const ingredientContainerRef = useRef<HTMLElement | null>(null)
  
  // Memoize the mapping so it's only calculated once on load
  const normalizedIngredients = useMemo(() => normalizeIngredientGroups(ingredients), [ingredients])

  const normalizedInstructions = useMemo(() => normalizeInstructionGroups(instructions), [instructions])

  const ingredientMapping = useMemo(() => {
    return mapIngredientsToSteps(normalizedIngredients, normalizedInstructions)
  }, [normalizedIngredients, normalizedInstructions])

  useEffect(() => {
    ingredientRefs.current = {}
  }, [normalizedIngredients])

  useEffect(() => {
    if (!activeStepId) return
    const matchedIds = ingredientMapping[activeStepId]
    if (!matchedIds || matchedIds.length === 0) return
    const container = ingredientContainerRef.current
    if (!container) return

    const firstExistingId = matchedIds.find((id) => ingredientRefs.current[id])
    if (!firstExistingId) return
    const node = ingredientRefs.current[firstExistingId]
    if (!node) return

    const containerRect = container.getBoundingClientRect()
    const nodeRect = node.getBoundingClientRect()
    const isVisible =
      nodeRect.top >= containerRect.top &&
      nodeRect.bottom <= containerRect.bottom

    if (isVisible) return

    const scrollAdjustment =
      nodeRect.top - containerRect.top - containerRect.height / 2 + nodeRect.height / 2

    container.scrollTo({
      top: container.scrollTop + scrollAdjustment,
      behavior: 'smooth',
    })
  }, [activeStepId, ingredientMapping])

  // Helper to check if an ingredient is highlighted
  const isIngredientHighlighted = (groupIdx: number, itemIdx: number) => {
    if (!activeStepId) return false
    const matchedIds = ingredientMapping[activeStepId]
    return matchedIds?.includes(`${groupIdx}-${itemIdx}`)
  }

  let globalStepCounter = 0

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-100px)]">
      {/* LEFT COLUMN: Ingredients + Sidebar Top */}
      <aside
        ref={ingredientContainerRef}
        className="w-full lg:w-[400px] xl:w-[450px] lg:h-[calc(100vh-100px)] lg:sticky lg:top-[60px] lg:overflow-y-auto bg-slate-50 border-r border-slate-200 p-6 md:p-8 flex flex-col gap-8 z-10"
      >
         {children?.sidebarTop}

         {/* Ingredients List */}
         <div>
            <h3 className="font-serif text-xl font-medium mb-4 pb-2 border-b border-slate-200">Ingredients</h3>
            {normalizedIngredients.length > 0 ? (
              <div className="space-y-6 text-sm">
                {normalizedIngredients.map((group, idx) => (
                  <div key={idx}>
                    {group.section && <h4 className="font-bold mb-2 text-slate-700 uppercase text-xs tracking-wider">{group.section}</h4>}
                    <ul className="space-y-2">
                      {group.items.map((item, i) => (
                        <li 
                          key={i} 
                          className={`flex items-start gap-2 transition-all duration-200 p-2 -ml-2 rounded-lg ${
                            isIngredientHighlighted(idx, i) 
                              ? 'bg-red-50 text-[#D34E4E] font-medium shadow-sm ring-1 ring-[#D34E4E]/20' 
                              : ''
                          }`}
                          ref={(el) => {
                            ingredientRefs.current[`${idx}-${i}`] = el
                          }}
                        >
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                            isIngredientHighlighted(idx, i) ? 'bg-[#D34E4E]' : 'bg-[#D34E4E]'
                          }`}></span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No ingredients listed.</p>
            )}
         </div>
      </aside>

      {/* RIGHT COLUMN: Instructions + Main Content Slots */}
      <div className="flex-1 p-6 md:p-10 lg:p-12 max-w-3xl mx-auto w-full">
         {children?.mainContentTop}

         {/* Instructions */}
         <section className="mb-16">
            {normalizedInstructions.length > 0 ? (
              <div className="space-y-10">
                 {normalizedInstructions.map((group, idx) => (
                   <div key={idx}>
                     {group.section && <h3 className="text-xl font-bold mb-6 text-slate-800">{group.section}</h3>}
                     <ol className="space-y-8">
                       {group.steps.map((step, i) => {
                         const currentStepId = `step-${globalStepCounter}`
                         globalStepCounter++
                         
                         return (
                           <li 
                             key={i} 
                             className="group grid grid-cols-[auto_1fr] gap-4 md:gap-6 cursor-pointer"
                             onMouseEnter={() => setActiveStepId(currentStepId)}
                             onMouseLeave={() => setActiveStepId(null)}
                             onClick={() => setActiveStepId(activeStepId === currentStepId ? null : currentStepId)} // Toggle on click for mobile
                           >
                              <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all duration-200 ${
                                activeStepId === currentStepId 
                                  ? 'bg-[#D34E4E] text-white shadow-md scale-110' 
                                  : 'bg-slate-100 text-slate-500 group-hover:bg-[#D34E4E]/10 group-hover:text-[#D34E4E]'
                              }`}>
                                {i + 1}
                              </span>
                              <div className={`text-lg leading-relaxed pt-0.5 border-b border-slate-100 pb-8 group-last:border-0 transition-colors duration-200 ${
                                activeStepId === currentStepId ? 'text-slate-900 font-medium' : 'text-slate-700'
                              }`}>
                                {step}
                              </div>
                           </li>
                         )
                       })}
                     </ol>
                   </div>
                 ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No instructions provided.</p>
            )}
         </section>

         {children?.mainContentBottom}
      </div>
    </div>
  )
}

export { mapIngredientsToSteps }
