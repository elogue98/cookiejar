import { z } from 'zod'
import { RECIPE_EXTRACTION_JSON_SCHEMA, recipeExtractionOutputSchema } from './aiSchemas'

export const RECIPE_INTRODUCTION_RULE = `RECIPE INTRODUCTION (description is required):
Preserve the recipe's own short introduction/headnote when present, including useful author attribution. A paragraph directly introducing this dish is recipe content, even on a magazine page; do not discard it as an unrelated essay.
If no recipe-specific introduction is supplied, write a natural one- or two-sentence introduction grounded only in the title, ingredients and method. Describe the dish and its main flavours or cooking style. Do not invent author quotes, history, dietary/health claims, cooking times, or missing ingredients or steps. Do not use generic filler such as "follow the steps below".
Never put extraction warnings, OCR commentary, page numbers or handwritten-annotation analysis in description. Keep those in the review fields when available. Return a non-empty description.`

export const RECIPE_IMPORT_JSON_SCHEMA = {
  ...RECIPE_EXTRACTION_JSON_SCHEMA,
  properties: { ...RECIPE_EXTRACTION_JSON_SCHEMA.properties, description: { type: 'string' } },
}

export const recipeImportOutputSchema = recipeExtractionOutputSchema.extend({
  description: z.string().trim().min(1).max(20_000),
})
