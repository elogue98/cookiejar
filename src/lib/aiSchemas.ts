// Chat Completions Structured Outputs schemas. Every object is strict and
// nullable fields are required so the schema is accepted by OpenAI models.
import { z } from 'zod'

import { httpUrlSchema } from './urlValidation'

export const TAGS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['tags'],
} as const

export const PLACE_TAGS_JSON_SCHEMA = TAGS_JSON_SCHEMA

export const METADATA_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    servings: { type: ['integer', 'null'] },
    prepTime: { type: ['string', 'null'] },
    cookTime: { type: ['string', 'null'] },
    totalTime: { type: ['string', 'null'] },
    cuisine: { type: ['string', 'null'] },
    mealType: { type: ['string', 'null'] },
    nutrition: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        calories: { type: ['number', 'null'] },
        protein: { type: ['number', 'null'] },
        fat: { type: ['number', 'null'] },
        carbs: { type: ['number', 'null'] },
      },
      required: ['calories', 'protein', 'fat', 'carbs'],
    },
  },
  required: ['servings', 'prepTime', 'cookTime', 'totalTime', 'cuisine', 'mealType', 'nutrition'],
} as const

export const CONVERSION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    metricUnit: { type: 'string', enum: ['ml', 'g'] },
    valuePerUnit: { type: 'number' },
  },
  required: ['metricUnit', 'valuePerUnit'],
} as const

export const INSTRUCTION_SECTIONS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['section', 'steps'],
      },
    },
  },
  required: ['sections'],
} as const

export const EXPECTED_MATCHES_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stepId: { type: 'string' },
          ingredientIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['stepId', 'ingredientIds'],
      },
    },
  },
  required: ['matches'],
} as const

export const RECIPE_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    sourceUrl: { type: ['string', 'null'], maxLength: 2_048 },
    image: { type: ['string', 'null'], maxLength: 2_048 },
    servings: { type: ['integer', 'null'] },
    prepTime: { type: ['string', 'null'] },
    cookTime: { type: ['string', 'null'] },
    totalTime: { type: ['string', 'null'] },
    cuisine: { type: ['string', 'null'] },
    mealType: { type: ['string', 'null'] },
    nutrition: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        calories: { type: ['integer', 'null'] },
        protein: { type: ['number', 'null'] },
        fat: { type: ['number', 'null'] },
        carbs: { type: ['number', 'null'] },
      },
      required: ['calories', 'protein', 'fat', 'carbs'],
    },
    ingredientSections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: ['string', 'null'] },
          items: { type: 'array', items: { type: 'string' } },
        },
        required: ['section', 'items'],
      },
    },
    instructionSections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          section: { type: ['string', 'null'] },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['section', 'steps'],
      },
    },
    tags: { type: ['array', 'null'], items: { type: 'string' } },
  },
  required: [
    'title', 'description', 'sourceUrl', 'image', 'servings', 'prepTime',
    'cookTime', 'totalTime', 'cuisine', 'mealType', 'nutrition',
    'ingredientSections', 'instructionSections', 'tags',
  ],
} as const

export const IMAGE_RECIPE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    instructions: { type: 'array', items: { type: 'string' } },
    tags: { type: ['array', 'null'], items: { type: 'string' } },
  },
  required: ['title', 'ingredients', 'instructions', 'tags'],
} as const

const boundedOutputText = (max: number) => z.string().trim().max(max)
const outputNutritionSchema = z.object({
  calories: z.number().finite().nonnegative().nullable(),
  protein: z.number().finite().nonnegative().nullable(),
  fat: z.number().finite().nonnegative().nullable(),
  carbs: z.number().finite().nonnegative().nullable(),
}).strict()
const outputIngredientSectionSchema = z.object({
  section: boundedOutputText(200).nullable(),
  items: z.array(boundedOutputText(500)).max(200),
}).strict()
const outputInstructionSectionSchema = z.object({
  section: boundedOutputText(200).nullable(),
  steps: z.array(boundedOutputText(2_000)).max(200),
}).strict()

export const tagsOutputSchema = z.object({
  tags: z.array(boundedOutputText(50)).max(30),
}).strict()

export const metadataOutputSchema = z.object({
  servings: z.number().int().positive().nullable(),
  prepTime: boundedOutputText(200).nullable(),
  cookTime: boundedOutputText(200).nullable(),
  totalTime: boundedOutputText(200).nullable(),
  cuisine: boundedOutputText(200).nullable(),
  mealType: boundedOutputText(200).nullable(),
  nutrition: outputNutritionSchema.nullable(),
}).strict()

export const conversionOutputSchema = z.object({
  metricUnit: z.enum(['ml', 'g']),
  valuePerUnit: z.number().finite().positive(),
}).strict()

export const instructionSectionsOutputSchema = z.object({
  sections: z.array(outputInstructionSectionSchema).max(200),
}).strict()

export const expectedMatchesOutputSchema = z.object({
  matches: z.array(z.object({
    stepId: boundedOutputText(100),
    ingredientIds: z.array(boundedOutputText(100)).max(200),
  }).strict()).max(2_000),
}).strict()

export const recipeExtractionOutputSchema = z.object({
  title: boundedOutputText(300).min(1),
  description: boundedOutputText(20_000).nullable(),
  sourceUrl: httpUrlSchema.nullable(),
  image: httpUrlSchema.nullable(),
  servings: z.number().int().positive().nullable(),
  prepTime: boundedOutputText(200).nullable(),
  cookTime: boundedOutputText(200).nullable(),
  totalTime: boundedOutputText(200).nullable(),
  cuisine: boundedOutputText(200).nullable(),
  mealType: boundedOutputText(200).nullable(),
  nutrition: outputNutritionSchema.extend({ calories: z.number().int().nonnegative().nullable() }).nullable(),
  ingredientSections: z.array(outputIngredientSectionSchema).min(1).max(200),
  instructionSections: z.array(outputInstructionSectionSchema).min(1).max(200),
  tags: z.array(boundedOutputText(50)).max(30).nullable(),
}).strict()

export const imageRecipeOutputSchema = z.object({
  title: boundedOutputText(300).min(1),
  ingredients: z.array(boundedOutputText(500)).max(200),
  instructions: z.array(boundedOutputText(2_000)).max(200),
  tags: z.array(boundedOutputText(50)).max(30).nullable(),
}).strict()

export type RecipeExtractionOutput = z.infer<typeof recipeExtractionOutputSchema>
