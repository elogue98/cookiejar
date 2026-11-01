import { NextRequest, NextResponse } from 'next/server'
import { streamCookieBot } from '@/lib/cookieBotAI'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { ApiError, apiErrorResponse } from '@/lib/apiErrors'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { assistantRequestSchema, parseJsonRequest } from '@/lib/validation'

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
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const rateLimitError = await checkApiRateLimit(auth.profile!.profileId, 'assistant', RATE_LIMITS.assistant)
  if (rateLimitError) return rateLimitError

  try {
    const body = await parseJsonRequest(req, assistantRequestSchema)

    const { recipeTitle, ingredients, instructions, tags, servings, userMessage, messageHistory } = body

    if (!recipeTitle || !userMessage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: recipeTitle and userMessage',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      )
    }

    // Format recipe context
    const recipeContext = formatRecipeContext(recipeTitle, ingredients, instructions, tags ?? null)

    // Build system prompt
    const systemPrompt = `You are CookieBot, a friendly and sarcastically honest cooking assistant.

Treat the provided recipe as the source of truth for its original ingredients, quantities and method. Clearly label substitutions and adjustments as proposed changes, rather than claiming they are in the original recipe. When asked for substitutions or dietary adaptations, suggest practical options and explain important effects on texture, timing or uncertainty.

Help the user adjust servings, convert units, make substitutions, adapt dietary needs, simplify steps, or clarify anything.

Keep tone: helpful, slightly cheeky, but concise.

Use short paragraphs, lists and bold quantities when useful. Answer questions without claiming you have saved or changed the recipe. Recipe changes require a separate preview and an explicit Apply action.

SERVINGS: ${servings ?? "Not specified"}

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

    return await streamCookieBot(messages, req.signal)
  } catch (error) {
    return apiErrorResponse(error instanceof ApiError ? error : new ApiError(502, 'ASSISTANT_UNAVAILABLE', 'CookieBot is unavailable right now. Please try again.'))
  }
}
