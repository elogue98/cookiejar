import { z } from 'zod'
import type { IngredientGroup, InstructionGroup } from '@/types/recipe'

const bounded = (max: number) => z.string().trim().max(max)
export const recipeProposalSchema = z
  .object({
    title: bounded(300).min(1),
    ingredients: z
      .array(z.object({ section: bounded(200), items: z.array(bounded(500)).max(100) }).strict())
      .max(100),
    instructions: z
      .array(z.object({ section: bounded(200), steps: z.array(bounded(2000)).max(100) }).strict())
      .max(100),
    tags: z.array(bounded(50)).max(30),
    servings: z.number().positive().max(100_000).nullable().optional(),
  })
  .strict()
export type RecipeProposal = z.infer<typeof recipeProposalSchema>
export type ChatMessage = {
  id?: number
  role: 'user' | 'assistant'
  content: string
  status?: 'streaming' | 'complete' | 'stopped' | 'error'
}
export type RecipeContext = {
  title: string
  ingredients: IngredientGroup[] | null
  instructions: InstructionGroup[] | null
  tags: string[] | null
  servings?: number | null
}

/** Only complete turns are eligible context; leave room for the next user message. */
export function chatHistory(messages: ChatMessage[]) {
  const pairs: { role: 'user' | 'assistant'; content: string }[][] = []
  for (let i = 1; i < messages.length; i++) {
    const previous = messages[i - 1],
      current = messages[i]
    if (previous.role === 'user' && current.role === 'assistant' && current.status === 'complete') {
      pairs.push(
        [previous, current].map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
      )
    }
  }
  let budget = 36_000
  const selected: typeof pairs = []
  for (const pair of pairs.reverse()) {
    const size = pair.reduce((sum, message) => sum + message.content.length, 0)
    if (selected.length >= 10 || size > budget) break
    selected.unshift(pair)
    budget -= size
  }
  return selected.flat()
}

export function recipeChanges(before: RecipeContext, after: RecipeProposal) {
  const fields = [
    { label: 'Title', before: [before.title], after: [after.title] },
    {
      label: 'Ingredients',
      before: (before.ingredients ?? []).flatMap((g) => [
        ...(g.section ? [g.section] : []),
        ...g.items,
      ]),
      after: after.ingredients.flatMap((g) => [...(g.section ? [g.section] : []), ...g.items]),
    },
    {
      label: 'Method',
      before: (before.instructions ?? []).flatMap((g) => [
        ...(g.section ? [g.section] : []),
        ...g.steps,
      ]),
      after: after.instructions.flatMap((g) => [...(g.section ? [g.section] : []), ...g.steps]),
    },
    { label: 'Tags', before: before.tags ?? [], after: after.tags },
    {
      label: 'Servings',
      before: [String(before.servings ?? 'Not specified')],
      after: [
        String(
          (after.servings === undefined ? before.servings : after.servings) ?? 'Not specified',
        ),
      ],
    },
  ]
  return fields.filter((field) => JSON.stringify(field.before) !== JSON.stringify(field.after))
}
