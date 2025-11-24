import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { generateTagsForRecipe } from '@/lib/aiTagging'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import OpenAI from 'openai'
import { aiComplete } from '@/lib/ai'
import { z } from 'zod'
import {
  normalizeIngredientSections,
  normalizeInstructionSections,
  formatMetadataForNotes,
} from '@/lib/recipeFormatting'

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
        content: 'You are an expert OCR assistant specialized in recipe extraction. Extract all text from the image, preserving structure and formatting. Handle handwritten notes, screenshots, and printed recipes with equal accuracy.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text from this recipe image. This may be a handwritten note, screenshot, cookbook photo, or printed recipe card. Preserve the structure - include ingredient lists, instructions, nutrition facts, and any other recipe information. Handle messy formatting, unclear handwriting, and mixed layouts intelligently. Return only the extracted text content.',
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
    max_tokens: 3000, // Increased for longer recipes
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
  const systemPrompt = `You are the CookieJar Recipe AI Assistant. Your job is to take a user-submitted recipe (ingredients + instructions + optional metadata) and normalize it into CookieJar's structured format.

### RULES:

1. **NEVER change existing instructions.**
   - If instructions are present (even if messy or poorly formatted), ONLY clean, reformat, and restructure them.
   - NEVER remove steps, reorder steps, change quantities mentioned, or alter the content.
   - Preserve the exact meaning and sequence of what the user provided.

2. **Generate instructions ONLY if they are completely missing or extremely minimal.**
   - If instructions are missing or very incomplete (e.g., just "bake at 350" with no other steps), generate detailed, comprehensive instructions based on the ingredients and recipe title.
   - Generated instructions MUST be thorough and step-by-step, not just high-level summaries.
   - Include all necessary steps: preparation, mixing/combining ingredients, cooking/baking methods, temperatures, times, and finishing steps.
   - Break down complex steps into clear, actionable instructions (e.g., don't just say "mix the batter" - specify what to mix, in what order, and how).
   - Use standard cooking techniques and logical steps based on the ingredients provided.
   - This is the ONLY case where you should generate new content.

3. **NEVER remove quantities, reorder steps, or change values from existing instructions.**

4. **If the user wants changes (e.g., 'use 0.5 tbsp coconut oil'), you MUST:**
   - Confirm the specific change
   - Apply ONLY that change to the original recipe
   - Return the final structured JSON for storage

5. **OUTPUT FORMAT (ALWAYS)**
{
  "title": "",
  "description": "",
  "ingredientSections": [
    { "section": "", "items": [] }
  ],
  "instructionSections": [
    { "section": "", "steps": [] }
  ],
  "tags": [],
  "extras": {}
}

6. **If instructions are messy but present**, rewrite them cleanly while preserving all steps and content exactly as provided.

7. **If the user submits images**, extract OCR → format the extracted text.

8. **Be warm, helpful, and funny, but NEVER change existing recipe content.**

9. **For metadata (servings, prepTime, cookTime, etc.)**: Only extract if explicitly present in the content. Do not infer or estimate.

10. **For tags**: Generate tags based on what's actually in the recipe (ingredients, cooking methods mentioned, etc.), but keep them relevant and accurate.

Return ONLY valid JSON, no markdown, no explanations.`

  const userPrompt = contentType === 'image_ocr'
    ? `Extract the recipe from this OCR text extracted from an image. The text may have formatting issues, handwriting artifacts, or screenshot formatting - be flexible and intelligent in parsing.

Handle:
- Handwritten notes with messy formatting
- Screenshots with mixed text layouts
- Missing or unclear section headers
- Inconsistent spacing and line breaks
- Nutrition facts embedded in text (extract macros if present)

IMPORTANT: If instructions exist, preserve them exactly (only clean formatting). If instructions are completely missing or extremely minimal, generate detailed, comprehensive step-by-step instructions based on the ingredients - include all preparation, mixing, cooking, and finishing steps with specific details.

OCR Text:
${content.substring(0, 8000)}`
    : contentType === 'html'
    ? `Extract the recipe from this HTML content. Focus on the main recipe content and ignore navigation, ads, and other page elements.

IMPORTANT: If instructions exist, preserve them exactly (only clean formatting). If instructions are completely missing or extremely minimal, generate detailed, comprehensive step-by-step instructions based on the ingredients - include all preparation, mixing, cooking, and finishing steps with specific details.

HTML Content:
${content.substring(0, 8000)}`
    : `Extract the recipe from this pasted text content. The text may be from any source: copied recipes, handwritten notes converted to text, screenshots, etc.

Handle:
- Any text format, even if messy or poorly structured
- Auto-detect sections even if not explicitly labeled
- Extract nutrition/macros from text if mentioned

IMPORTANT: If instructions exist, preserve them exactly (only clean formatting). If instructions are completely missing or extremely minimal, generate detailed, comprehensive step-by-step instructions based on the ingredients - include all preparation, mixing, cooking, and finishing steps with specific details.

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
  let parsed: unknown
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

  // Note: We no longer check for errors here since we allow generating instructions when missing

  // Validate with zod schema
  const validated = RecipeExtractionSchema.parse(parsed)
  
  return validated
}

function flattenIngredientPreview(
  sections: ReturnType<typeof normalizeIngredientSections>
): string[] {
  const result: string[] = []

  for (const section of sections) {
    if (section.section) {
      result.push(`${section.section.toUpperCase()}:`)
    }
    for (const item of section.items) {
      result.push(section.section ? `- ${item}` : item)
    }
  }

  return result
}

function formatInstructionPreview(
  sections: ReturnType<typeof normalizeInstructionSections>
): string {
  const parts: string[] = []

  for (const section of sections) {
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

    // Step 3: Normalize sections for preview + later storage
    const ingredientSections = normalizeIngredientSections(extractedRecipe.ingredientSections)
    const instructionSections = normalizeInstructionSections(extractedRecipe.instructionSections)
    const ingredients = flattenIngredientPreview(ingredientSections)
    const instructions = formatInstructionPreview(instructionSections)
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
          ingredientSections,
          instructionSections,
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

