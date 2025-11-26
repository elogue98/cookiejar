import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'

interface RequestBody {
  recipeId: string
  recipeTitle: string
  ingredients: { section: string; items: string[] }[] | null
  instructions: { section: string; steps: string[] }[] | null
  tags: string[] | null
  userMessage: string
  messageHistory: { role: 'user' | 'assistant'; content: string }[]
}

function formatRecipeContext(
  title: string,
  ingredients: { section: string; items: string[] }[] | null,
  instructions: { section: string; steps: string[] }[] | null,
  tags: string[] | null
): string {
  let context = `RECIPE: ${title}\n\n`

  // Add tags if available
  if (tags && tags.length > 0) {
    context += `Tags: ${tags.join(', ')}\n\n`
  }

  // Format ingredients
  if (ingredients && ingredients.length > 0) {
    context += 'INGREDIENTS:\n'
    ingredients.forEach((group) => {
      if (group.section && group.section.trim()) {
        context += `\n${group.section}:\n`
      }
      if (group.items && group.items.length > 0) {
        group.items.forEach((item) => {
          context += `- ${item}\n`
        })
      }
    })
    context += '\n'
  }

  // Format instructions
  if (instructions && instructions.length > 0) {
    context += 'INSTRUCTIONS:\n'
    instructions.forEach((group) => {
      if (group.section && group.section.trim()) {
        context += `\n${group.section}:\n`
      }
      if (group.steps && group.steps.length > 0) {
        group.steps.forEach((step, idx) => {
          context += `${idx + 1}. ${step}\n`
        })
      }
    })
  }

  return context
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()

    const { recipeId, recipeTitle, ingredients, instructions, tags, userMessage, messageHistory } = body

    if (!recipeId || !recipeTitle || !userMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: recipeId, recipeTitle, and userMessage' },
        { status: 400 }
      )
    }

    // Format recipe context
    const recipeContext = formatRecipeContext(recipeTitle, ingredients, instructions, tags)

    // Build system prompt for mutation
    const systemPrompt = `You are CookieBot's mutation engine. Your job is to apply the user's requested changes to the recipe and return ONLY a valid JSON object with the updated recipe.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no code blocks
2. The JSON must match this exact structure:
{
  "title": "Recipe Title",
  "ingredients": [
    { "section": "Section Name (or empty string)", "items": ["ingredient 1", "ingredient 2"] }
  ],
  "instructions": [
    { "section": "Section Name (or empty string)", "steps": ["step 1", "step 2"] }
  ],
  "tags": ["tag1", "tag2"]
}

3. Apply ONLY the changes the user requested - keep everything else exactly the same
4. Preserve the structure (sections, groupings) unless the user explicitly asks to change it
5. If the user says "0.5 tbsp coconut oil works better", find "coconut oil" in ingredients and update ONLY that amount
6. If the user says "halve this recipe", divide all quantities by 2
7. If the user says "make this gluten-free", replace gluten-containing ingredients with gluten-free alternatives
8. Keep the same number of sections and structure unless explicitly asked to change

RECIPE CONTEXT:
${recipeContext}

Return ONLY the JSON object, nothing else.`

    // Build messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...messageHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    // Call OpenAI to generate mutation
    const response = await aiComplete(messages, {
      temperature: 0.3, // Lower temperature for more consistent structured output
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    // Parse the JSON response
    let mutatedRecipe
    try {
      mutatedRecipe = JSON.parse(response)
    } catch {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || response.match(/(\{[\s\S]*\})/)
      if (jsonMatch) {
        mutatedRecipe = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Failed to parse mutation response as JSON')
      }
    }

    // Validate the structure
    if (!mutatedRecipe || typeof mutatedRecipe !== 'object') {
      throw new Error('Invalid mutation response structure')
    }

    return NextResponse.json({ 
      success: true,
      mutatedRecipe 
    })
  } catch (error) {
    console.error('Error in /api/recipe-mutate:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
