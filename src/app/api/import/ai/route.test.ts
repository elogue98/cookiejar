import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/imageOptimization', () => ({
  uploadOptimizedImage: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({
  aiComplete: vi.fn(),
}))

vi.mock('@/lib/aiTagging', () => ({
  generateTagsForRecipe: vi.fn(),
}))

vi.mock('openai', () => ({
  default: vi.fn(function OpenAI() {
    return {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    }
  }),
}))

describe('extractStructuredRecipeDataFromHTML', () => {
  it('extracts Happy Foodie-style JSON-LD ingredients and HTML paragraph instructions', async () => {
    const { extractStructuredRecipeDataFromHTML } = await import('./route')
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Recipe",
                  "name": "Orzo with Prawns",
                  "recipeIngredient": [
                    "200g feta, broken into 1-2cm pieces",
                    "4 tbsp olive oil"
                  ],
                  "recipeInstructions": "<p>1. Mix the feta with chilli flakes.</p><p>2. Fry the orzo until golden.</p>"
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `

    expect(extractStructuredRecipeDataFromHTML(html)).toEqual({
      ingredientSections: [
        {
          items: [
            '200g feta, broken into 1-2cm pieces',
            '4 tbsp olive oil',
          ],
        },
      ],
      instructionSections: [
        {
          steps: [
            'Mix the feta with chilli flakes.',
            'Fry the orzo until golden.',
          ],
        },
      ],
    })
  })

  it('validates with trusted structured sections when AI omits sections', async () => {
    const { aiComplete } = await import('@/lib/ai')
    const { extractRecipeWithAI } = await import('./route')

    vi.mocked(aiComplete).mockResolvedValueOnce(JSON.stringify({
      title: 'Orzo with Prawns',
      servings: 4,
      prepTime: '15 minutes',
      cookTime: '30 minutes',
      totalTime: '45 minutes',
      nutrition: {
        calories: 450,
        protein: 20,
        fat: 18,
        carbs: 50,
      },
      ingredientSections: [],
      instructionSections: [],
    }))

    const recipe = await extractRecipeWithAI(
      'Recipe content',
      'html',
      {
        ingredientSections: [{ items: ['200g feta'] }],
        instructionSections: [{ steps: ['Mix the feta.'] }],
      },
    )

    expect(recipe.ingredientSections).toEqual([{ items: ['200g feta'] }])
    expect(recipe.instructionSections).toEqual([{ steps: ['Mix the feta.'] }])
  })
})
