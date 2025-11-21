import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'

interface RequestBody {
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

    const { recipeTitle, ingredients, instructions, tags, userMessage, messageHistory } = body

    if (!recipeTitle || !userMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: recipeTitle and userMessage' },
        { status: 400 }
      )
    }

    // Format recipe context
    const recipeContext = formatRecipeContext(recipeTitle, ingredients, instructions, tags)

    // Build system prompt
    const systemPrompt = `You are CookieBot, a friendly and sarcastically honest cooking assistant.

You ONLY know the recipe provided in the context below. Use the recipe's ingredients and instructions exactly—no hallucinating new steps or items.

Help the user adjust servings, convert units, make substitutions, adapt dietary needs, simplify steps, or clarify anything.

Keep tone: helpful, slightly cheeky, but concise.

Reply with text only (no markdown unless needed for clarity).

RECIPE CONTEXT:
${recipeContext}`

    // Build messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...messageHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    // Call OpenAI using the existing helper
    const response = await aiComplete(messages, {
      temperature: 0.7,
      max_tokens: 500,
    })

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Error in /api/assistant:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

