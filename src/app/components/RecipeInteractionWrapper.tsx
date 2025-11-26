'use client'

import { useState, useMemo, ReactNode, useEffect, useRef } from 'react'

import {
  mapIngredientsToSteps,
  normalizeIngredientGroups,
  normalizeInstructionGroups,
  type IngredientGroup,
  type InstructionGroup,
} from '@/lib/ingredientMatcher'

interface RecipeInteractionWrapperProps {
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
  expectedMatches?: Record<string, string[]>
  children?: {
    sidebarTop?: ReactNode
    mainContentTop?: ReactNode
    mainContentBottom?: ReactNode
  }
}

export default function RecipeInteractionWrapper({
  ingredients,
  instructions,
  expectedMatches,
  children,
}: RecipeInteractionWrapperProps) {
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const ingredientRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const ingredientContainerRef = useRef<HTMLElement | null>(null)

  const normalizedIngredients = useMemo(() => normalizeIngredientGroups(ingredients), [ingredients])
  const normalizedInstructions = useMemo(() => normalizeInstructionGroups(instructions), [instructions])

  const hasInstructionSections = useMemo(
    () => normalizedInstructions.some((group) => group.section && group.section.trim().length > 0),
    [normalizedInstructions],
  )

  const ingredientMapping = useMemo(() => {
    if (expectedMatches && Object.keys(expectedMatches).length > 0) {
      return expectedMatches
    }
    return mapIngredientsToSteps(normalizedIngredients, normalizedInstructions)
  }, [normalizedIngredients, normalizedInstructions, expectedMatches])

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
    const isVisible = nodeRect.top >= containerRect.top && nodeRect.bottom <= containerRect.bottom

    if (isVisible) return

    const scrollAdjustment =
      nodeRect.top - containerRect.top - containerRect.height / 2 + nodeRect.height / 2

    container.scrollTo({
      top: container.scrollTop + scrollAdjustment,
      behavior: 'smooth',
    })
  }, [activeStepId, ingredientMapping])

  const isIngredientHighlighted = (groupIdx: number, itemIdx: number) => {
    if (!activeStepId) return false
    const matchedIds = ingredientMapping[activeStepId]
    return matchedIds?.includes(`${groupIdx}-${itemIdx}`)
  }

  let globalStepCounter = 0

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-100px)]">
      <aside
        ref={ingredientContainerRef}
        className="w-full lg:w-[400px] xl:w-[450px] lg:h-[calc(100vh-100px)] lg:sticky lg:top-[60px] lg:overflow-y-auto bg-slate-50 border-r border-slate-200 p-6 md:p-8 flex flex-col gap-8 z-10"
      >
        {children?.sidebarTop}

        <div>
          <h3 className="font-serif text-xl font-medium mb-4 pb-2 border-b border-slate-200">
            Ingredients
          </h3>
          {normalizedIngredients.length > 0 ? (
            <div className="space-y-6 text-sm">
              {normalizedIngredients.map((group, idx) => (
                <div key={idx}>
                  {group.section && (
                    <h4 className="font-bold mb-2 text-slate-700 uppercase text-xs tracking-wider">
                      {group.section}
                    </h4>
                  )}
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
                        <span
                          className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                            isIngredientHighlighted(idx, i) ? 'bg-[#D34E4E]' : 'bg-[#D34E4E]'
                          }`}
                        ></span>
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

      <div className="flex-1 p-6 md:p-10 lg:p-12 max-w-3xl mx-auto w-full">
        {children?.mainContentTop}

        <section className="mb-16">
          {normalizedInstructions.length > 0 ? (
            <div className="space-y-10">
              {!hasInstructionSections && (
                <h3 className="text-xl font-bold mb-6 text-slate-800">Instructions</h3>
              )}
              {normalizedInstructions.map((group, idx) => (
                <div key={idx}>
                  {group.section && (
                    <h3 className="text-xl font-bold mb-6 text-slate-800">{group.section}</h3>
                  )}
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
                          onClick={() =>
                            setActiveStepId(activeStepId === currentStepId ? null : currentStepId)
                          }
                        >
                          <span
                            className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all duration-200 ${
                              activeStepId === currentStepId
                                ? 'bg-[#D34E4E] text-white shadow-md scale-110'
                                : 'bg-slate-100 text-slate-500 group-hover:bg-[#D34E4E]/10 group-hover:text-[#D34E4E]'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <div
                            className={`text-lg leading-relaxed pt-0.5 border-b border-slate-100 pb-8 group-last:border-0 transition-colors duration-200 ${
                              activeStepId === currentStepId
                                ? 'text-slate-900 font-medium'
                                : 'text-slate-700'
                            }`}
                          >
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
