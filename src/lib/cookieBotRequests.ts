import {
  recipeProposalSchema,
  type RecipeContext,
  type RecipeProposal,
  type ChatMessage,
} from './cookieBotRecipe'

export async function readChatJson(response: Response) {
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('Could not connect to CookieBot. Please try again.')
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.',
    )
  return data
}

export async function prepareRecipeProposal(
  recipeId: string,
  recipe: RecipeContext,
  userMessage: string,
  history: ChatMessage[],
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<RecipeProposal> {
  const response = await fetcher('/api/recipe-mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      recipeId,
      recipeTitle: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      tags: recipe.tags,
      servings: recipe.servings,
      userMessage,
      messageHistory: history,
    }),
  })
  const data = await readChatJson(response)
  if (!data.success) throw new Error('Could not prepare the recipe changes. Please retry.')
  const parsed = recipeProposalSchema.safeParse(data.mutatedRecipe)
  if (!parsed.success) throw new Error('The proposed changes were incomplete. Please retry.')
  return parsed.data
}

export async function applyRecipeProposal(
  recipeId: string,
  proposal: RecipeProposal,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const validated = recipeProposalSchema.parse(proposal)
  const response = await fetcher(`/api/recipes/${encodeURIComponent(recipeId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(validated),
  })
  const data = await readChatJson(response)
  if (!data.success) throw new Error('Could not save the changes. Please retry.')
}
