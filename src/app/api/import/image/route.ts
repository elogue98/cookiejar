import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { generateTagsForRecipe } from '@/lib/aiTagging'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import OpenAI from 'openai'
import { aiComplete } from '@/lib/ai'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/**
 * Zod schema for AI-extracted recipe structure (same as in /api/import/ai)
 */
const RecipeExtractionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  image: z.string().url().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  prepTime: z.string().optional().nullable(),
  cookTime: z.string().optional().nullable(),
  totalTime: z.string().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  mealType: z.string().optional().nullable(),
  nutrition: z.object({
    calories: z.number().int().nonnegative().optional().nullable(),
    protein: z.number().nonnegative().optional().nullable(),
    fat: z.number().nonnegative().optional().nullable(),
    carbs: z.number().nonnegative().optional().nullable(),
  }).optional().nullable(),
  ingredientSections: z.array(z.object({
    section: z.string().optional().nullable(),
    items: z.array(z.string().min(1)),
  })).min(1, 'At least one ingredient section is required'),
  instructionSections: z.array(z.object({
    section: z.string().optional().nullable(),
    steps: z.array(z.string().min(1)),
  })).min(1, 'At least one instruction section is required'),
  tags: z.array(z.string()).optional().nullable(),
})

type RecipeExtraction = z.infer<typeof RecipeExtractionSchema>

/**
 * Extract OCR text from image using OpenAI Vision
 */
async function extractOCRTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const base64Image = imageBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Image}`

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  
  const response = await openai.chat.completions.create({
    model: model === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an OCR assistant. Extract all text from the image, preserving the structure and formatting as much as possible. Return only the extracted text, no explanations.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text from this recipe image. Preserve the structure - include ingredient lists, instructions, and any other recipe information. Return only the text content.',
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 2000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  return content
}

/**
 * Extract recipe using AI (same function as in /api/import/ai)
 */
async function extractRecipeWithAI(content: string, contentType: 'html' | 'text' | 'image_ocr'): Promise<RecipeExtraction> {
  const systemPrompt = `You are an expert recipe extraction assistant. Extract structured recipe information from the provided content.

You MUST return a valid JSON object with the following structure:
{
  "title": "Recipe title (required)",
  "description": "Brief description of the recipe (infer if missing)",
  "sourceUrl": "Original URL if available (null if not)",
  "image": "Image URL if available (null if not)",
  "servings": 4 (number, infer reasonable default if missing),
  "prepTime": "15 minutes" (string format, infer if missing),
  "cookTime": "30 minutes" (string format, infer if missing),
  "totalTime": "45 minutes" (string format, infer if missing),
  "cuisine": "Italian" (string, infer from ingredients/name if missing),
  "mealType": "dinner" (one of: breakfast, lunch, dinner, snack, dessert, drink, infer if missing),
  "nutrition": {
    "calories": 350 (number, infer reasonable estimate if missing),
    "protein": 25.5 (number in grams, infer if missing),
    "fat": 12.3 (number in grams, infer if missing),
    "carbs": 30.2 (number in grams, infer if missing)
  },
  "ingredientSections": [
    {
      "section": "FOR THE SAUCE" (optional, null if no section),
      "items": ["1 cup tomatoes", "2 cloves garlic", ...]
    }
  ],
  "instructionSections": [
    {
      "section": "PREPARATION" (optional, null if no section),
      "steps": ["Step 1...", "Step 2...", ...]
    }
  ],
  "tags": ["italian", "pasta", "vegetarian", ...] (array of relevant tags)
}

IMPORTANT:
- Extract ALL visible recipe information
- Infer missing fields with reasonable defaults based on recipe type
- For nutrition, provide realistic estimates based on ingredients if not provided
- For servings, infer from ingredient quantities if not specified
- For times, infer from cooking methods if not specified
- Preserve ingredient and instruction sections if present
- Generate relevant tags (cuisine, dietary, cooking method, etc.)
- Return ONLY valid JSON, no markdown, no explanations`

  const userPrompt = contentType === 'image_ocr'
    ? `Extract the recipe from this OCR text extracted from an image. The text may have formatting issues, so be flexible in parsing.

OCR Text:
${content.substring(0, 8000)}`
    : contentType === 'html'
    ? `Extract the recipe from this HTML content. Focus on the main recipe content and ignore navigation, ads, and other page elements.

HTML Content:
${content.substring(0, 8000)}`
    : `Extract the recipe from this pasted text content.

Text Content:
${content.substring(0, 8000)}`

  const response = await aiComplete(
    [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    {
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }
  )

  if (!response) {
    throw new Error('No response from AI')
  }

  // Parse JSON response
  let parsed: any
  try {
    parsed = JSON.parse(response)
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                     response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      } catch {
        throw new Error('Failed to parse JSON from AI response')
      }
    } else {
      throw new Error('No valid JSON found in AI response')
    }
  }

  // Validate with zod schema
  const validated = RecipeExtractionSchema.parse(parsed)
  
  return validated
}

/**
 * Convert structured ingredients to flat array format for Supabase
 */
function formatIngredientsForSupabase(
  ingredientSections: RecipeExtraction['ingredientSections']
): string[] {
  const result: string[] = []
  
  for (const section of ingredientSections) {
    if (section.section) {
      result.push(`${section.section.toUpperCase()}:`)
    }
    for (const item of section.items) {
      result.push(section.section ? `- ${item}` : item)
    }
  }
  
  return result
}

/**
 * Convert structured instructions to string format for Supabase
 */
function formatInstructionsForSupabase(
  instructionSections: RecipeExtraction['instructionSections']
): string {
  const parts: string[] = []
  
  for (const section of instructionSections) {
    if (section.section) {
      parts.push(`${section.section.toUpperCase()}:`)
    }
    for (const step of section.steps) {
      parts.push(step)
    }
  }
  
  return parts.join('\n\n')
}

/**
 * Format additional metadata as JSON string for notes field
 */
function formatMetadataForNotes(recipe: RecipeExtraction): string {
  const metadata: any = {}
  
  if (recipe.description) metadata.description = recipe.description
  if (recipe.servings) metadata.servings = recipe.servings
  if (recipe.prepTime) metadata.prepTime = recipe.prepTime
  if (recipe.cookTime) metadata.cookTime = recipe.cookTime
  if (recipe.totalTime) metadata.totalTime = recipe.totalTime
  if (recipe.cuisine) metadata.cuisine = recipe.cuisine
  if (recipe.mealType) metadata.mealType = recipe.mealType
  if (recipe.nutrition) metadata.nutrition = recipe.nutrition
  
  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata, null, 2) : ''
}

/**
 * POST /api/import/image
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload a JPG, PNG, or WEBP image.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Step 1: Extract OCR text from image
    let ocrText: string
    try {
      ocrText = await extractOCRTextFromImage(buffer, file.type)
    } catch (error) {
      console.error('Error extracting OCR text from image:', error)
      return NextResponse.json(
        { success: false, error: `Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    if (!ocrText || ocrText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No text could be extracted from the image' },
        { status: 400 }
      )
    }

    // Step 2: Extract recipe using AI extractor (same as URL imports)
    let extractedRecipe: RecipeExtraction
    try {
      extractedRecipe = await extractRecipeWithAI(ocrText, 'image_ocr')
    } catch (error) {
      console.error('Error extracting recipe with AI:', error)
      return NextResponse.json(
        { success: false, error: `Failed to extract recipe: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Step 3: Format data for response
    const ingredients = formatIngredientsForSupabase(extractedRecipe.ingredientSections)
    const instructions = formatInstructionsForSupabase(extractedRecipe.instructionSections)
    const metadataNotes = formatMetadataForNotes(extractedRecipe)
    const tags = extractedRecipe.tags || []

    // Convert image buffer to base64 for preview
    const base64Image = buffer.toString('base64')
    const imageDataUrl = `data:${file.type};base64,${base64Image}`

    // Return extracted data for preview (don't create recipe yet)
    return NextResponse.json(
      { 
        success: true, 
        data: {
          title: extractedRecipe.title,
          ingredients,
          instructions: instructions || 'No instructions found',
          tags,
          metadataNotes, // Include metadata JSON string
          imageDataUrl: imageDataUrl,
          imageBuffer: base64Image,
          imageMimeType: file.type,
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

