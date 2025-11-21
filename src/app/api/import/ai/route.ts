import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabaseClient'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import { aiComplete } from '@/lib/ai'
import OpenAI from 'openai'
import * as cheerio from 'cheerio'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/**
 * Zod schema for AI-extracted recipe structure
 */
const RecipeExtractionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  image: z.string().url().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  prepTime: z.string().optional().nullable(), // e.g., "15 minutes", "PT15M"
  cookTime: z.string().optional().nullable(),
  totalTime: z.string().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  mealType: z.string().optional().nullable(), // e.g., "breakfast", "dinner", "dessert"
  nutrition: z.object({
    calories: z.number().int().nonnegative().optional().nullable(),
    protein: z.number().nonnegative().optional().nullable(), // in grams
    fat: z.number().nonnegative().optional().nullable(), // in grams
    carbs: z.number().nonnegative().optional().nullable(), // in grams
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
 * Extract image URL from HTML (similar to old scraper)
 */
function extractImageFromHTML(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html)
  
  // Try JSON-LD image first
  const scripts = $('script[type="application/ld+json"]')
  let recipe: any = null
  
  scripts.each((_, el) => {
    try {
      const jsonData = JSON.parse($(el).html() || '{}')
      if (Array.isArray(jsonData)) {
        recipe = jsonData.find((item: any) => {
          const type = item['@type']
          return type === 'Recipe' || 
                 type === 'http://schema.org/Recipe' || 
                 type === 'https://schema.org/Recipe' ||
                 (Array.isArray(type) && type.includes('Recipe'))
        })
      } else if (jsonData['@type'] === 'Recipe' || 
                 jsonData['@type'] === 'http://schema.org/Recipe' ||
                 jsonData['@type'] === 'https://schema.org/Recipe') {
        recipe = jsonData
      }
      if (recipe) return false // break
    } catch {
      // Ignore JSON parse errors
    }
  })
  
  // Extract image from JSON-LD
  if (recipe?.image) {
    if (typeof recipe.image === 'string') {
      try {
        return new URL(recipe.image, baseUrl).href
      } catch {
        return null
      }
    }
    if (Array.isArray(recipe.image) && recipe.image.length > 0) {
      const img = recipe.image[0]
      if (typeof img === 'string') {
        try {
          return new URL(img, baseUrl).href
        } catch {
          return null
        }
      }
      if (img.url) {
        try {
          return new URL(img.url, baseUrl).href
        } catch {
          return null
        }
      }
    }
    if (recipe.image.url) {
      try {
        return new URL(recipe.image.url, baseUrl).href
      } catch {
        return null
      }
    }
  }
  
  // Try og:image meta tag
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) {
    try {
      return new URL(ogImage, baseUrl).href
    } catch {
      return null
    }
  }
  
  // Try schema.org image microdata
  const schemaImage = $('[itemprop="image"]').attr('content') || $('[itemprop="image"] img').attr('src')
  if (schemaImage) {
    try {
      return new URL(schemaImage, baseUrl).href
    } catch {
      return null
    }
  }
  
  // Fallback to first large image (skip small icons)
  const images = $('img')
  for (let i = 0; i < images.length; i++) {
    const img = $(images[i])
    const src = img.attr('src')
    const width = parseInt(img.attr('width') || '0')
    const height = parseInt(img.attr('height') || '0')
    
    // Skip small images (likely icons)
    if (width > 200 && height > 200 && src) {
      try {
        return new URL(src, baseUrl).href
      } catch {
        continue
      }
    }
  }
  
  // Last resort: first img tag
  const firstImg = $('img').first().attr('src')
  if (firstImg) {
    try {
      return new URL(firstImg, baseUrl).href
    } catch {
      return null
    }
  }
  
  return null
}

/**
 * Extract text content from HTML
 */
function extractTextFromHTML(html: string): string {
  const $ = cheerio.load(html)
  
  // Remove script and style tags
  $('script, style, noscript').remove()
  
  // Get main content areas
  const mainContent = $('main, article, [role="main"], .content, .post-content, .entry-content').first()
  const contentToExtract = mainContent.length > 0 ? mainContent : $.root()
  
  // Extract text, limit to 8000 characters to avoid token limits
  let text = contentToExtract.text()
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()
  
  // Limit length
  if (text.length > 8000) {
    text = text.substring(0, 8000) + '...'
  }
  
  return text
}

/**
 * Extract recipe using GPT-4o Mini with structured prompt
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

  const userPrompt = contentType === 'html'
    ? `Extract the recipe from this HTML content. Focus on the main recipe content and ignore navigation, ads, and other page elements.

HTML Content:
${content.substring(0, 8000)}`
    : contentType === 'image_ocr'
    ? `Extract the recipe from this OCR text extracted from an image. The text may have formatting issues, so be flexible in parsing.

OCR Text:
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
      temperature: 0.2, // Low temperature for consistent extraction
      max_tokens: 4000, // Enough for full recipe
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
 * POST /api/import/ai
 * 
 * Accepts either FormData or JSON:
 * FormData:
 * - url: string (HTML will be fetched)
 * - html: string (raw HTML content)
 * - text: string (pasted text or OCR text)
 * - image: File (image file, will extract OCR text first)
 * 
 * JSON:
 * - url: string (HTML will be fetched)
 * - html: string (raw HTML content)
 * - text: string (pasted text)
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let url: string | null = null
    let html: string | null = null
    let text: string | null = null
    let imageFile: File | null = null
    let userId: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (for file uploads)
      const formData = await req.formData()
      url = formData.get('url') as string | null
      html = formData.get('html') as string | null
      text = formData.get('text') as string | null
      imageFile = formData.get('image') as File | null
      userId = formData.get('userId') as string | null
    } else {
      // Handle JSON
      const body = await req.json()
      url = body.url || null
      html = body.html || null
      text = body.text || null
      userId = body.userId || null
    }

    // Determine content source
    let content: string
    let contentSourceType: 'html' | 'text' | 'image_ocr'
    let sourceUrl: string | null = null
    let imageUrl: string | null = null
    let imageBuffer: Buffer | null = null // Store image buffer for later upload

    if (url) {
      // Fetch HTML from URL
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        if (!response.ok) {
          return NextResponse.json(
            { success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
            { status: response.status }
          )
        }

        const htmlContent = await response.text()
        content = extractTextFromHTML(htmlContent)
        contentSourceType = 'html'
        sourceUrl = url
        
        // Extract image from HTML as fallback (AI might miss it)
        const extractedImageUrl = extractImageFromHTML(htmlContent, url)
        if (extractedImageUrl) {
          imageUrl = extractedImageUrl
        }
      } catch (error) {
        return NextResponse.json(
          { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 500 }
        )
      }
    } else if (html) {
      // Use provided HTML
      content = extractTextFromHTML(html)
      contentSourceType = 'html'
    } else if (imageFile) {
      // Extract text from image using OpenAI Vision
      try {
        const arrayBuffer = await imageFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64Image = buffer.toString('base64')
        const mimeType = imageFile.type || 'image/jpeg'

        // Use OpenAI Vision API directly (aiComplete doesn't support images)
        const visionResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
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
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        })

        const visionText = visionResponse.choices[0]?.message?.content

        if (!visionText) {
          return NextResponse.json(
            { success: false, error: 'Failed to extract text from image' },
            { status: 500 }
          )
        }

        content = visionText
        contentSourceType = 'image_ocr'
        imageBuffer = buffer // Store for later upload
      } catch (error) {
        return NextResponse.json(
          { success: false, error: `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 500 }
        )
      }
    } else if (text) {
      // Use provided text
      content = text
      contentSourceType = 'text'
    } else {
      return NextResponse.json(
        { success: false, error: 'One of url, html, text, or image must be provided' },
        { status: 400 }
      )
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No content extracted from provided source' },
        { status: 400 }
      )
    }

    // Extract recipe using AI
    let extractedRecipe: RecipeExtraction
    try {
      extractedRecipe = await extractRecipeWithAI(content, contentSourceType)
    } catch (error) {
      console.error('Error extracting recipe with AI:', error)
      return NextResponse.json(
        { success: false, error: `Failed to extract recipe: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Use sourceUrl from extracted recipe if available, otherwise use provided URL
    const finalSourceUrl = extractedRecipe.sourceUrl || sourceUrl

    // Prepare recipe data for Supabase
    const ingredients = formatIngredientsForSupabase(extractedRecipe.ingredientSections)
    const instructions = formatInstructionsForSupabase(extractedRecipe.instructionSections)
    const metadataNotes = formatMetadataForNotes(extractedRecipe)
    const tags = extractedRecipe.tags || []

    const recipeData: any = {
      title: extractedRecipe.title,
      ingredients,
      instructions: instructions || 'No instructions found',
      tags,
      source_url: finalSourceUrl,
      notes: metadataNotes || null,
    }

    // Insert into Supabase
    const supabase = createServerClient()
    
    // Try to insert with created_by first, fallback without it if column doesn't exist
    let data, error
    if (userId && typeof userId === 'string') {
      // Try with created_by
      const result = await supabase
        .from('recipes')
        .insert({ ...recipeData, created_by: userId })
        .select()
        .single()
      
      data = result.data
      error = result.error
      
      // If error is about missing column, retry without created_by
      if (error && (error.message.includes('created_by') || error.message.includes('column') || error.code === '42703')) {
        const retryResult = await supabase
          .from('recipes')
          .insert(recipeData)
          .select()
          .single()
        
        data = retryResult.data
        error = retryResult.error
      }
    } else {
      // No userId, insert without created_by
      const result = await supabase
        .from('recipes')
        .insert(recipeData)
        .select()
        .single()
      
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    // Handle image upload
    let finalImageUrl: string | null = null
    
    // Priority: extracted image URL from HTML > AI-extracted image URL > uploaded image file
    const imageUrlToUse = imageUrl || extractedRecipe.image
    
    if (imageUrlToUse && data.id) {
      try {
        // Fetch image from URL
        const imageResponse = await fetch(imageUrlToUse, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        if (imageResponse.ok) {
          const imageArrayBuffer = await imageResponse.arrayBuffer()
          const imageBuffer = Buffer.from(imageArrayBuffer)
          
          // Determine extension
          let extension = 'jpg'
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
          if (contentType.includes('png')) extension = 'png'
          else if (contentType.includes('webp')) extension = 'webp'
          else if (contentType.includes('gif')) extension = 'gif'
          else {
            // Try to infer from URL
            const urlLower = imageUrlToUse.toLowerCase()
            if (urlLower.includes('.png')) extension = 'png'
            else if (urlLower.includes('.webp')) extension = 'webp'
            else if (urlLower.includes('.gif')) extension = 'gif'
          }
          
          // Upload optimized image
          finalImageUrl = await uploadOptimizedImage(supabase, imageBuffer, data.id, extension)

          if (finalImageUrl) {
            const { error: updateError } = await supabase
              .from('recipes')
              .update({ image_url: finalImageUrl })
              .eq('id', data.id)

            if (!updateError) {
              data.image_url = finalImageUrl
            } else {
              console.error('Error updating recipe with image URL:', updateError)
            }
          } else {
            console.error('Failed to upload optimized image')
          }
        } else {
          console.error(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`)
        }
      } catch (imageError) {
        console.error('Error processing extracted image URL:', imageError)
      }
    } else if (imageBuffer && data.id) {
      // Upload the provided image file (buffer was stored earlier)
      try {
        // Determine extension from original file
        let extension = 'jpg'
        if (imageFile) {
          if (imageFile.type.includes('png')) extension = 'png'
          else if (imageFile.type.includes('webp')) extension = 'webp'
          else if (imageFile.type.includes('gif')) extension = 'gif'
        }
        
        // Upload optimized image (this will compress and delete original)
        finalImageUrl = await uploadOptimizedImage(supabase, imageBuffer, data.id, extension)

        if (finalImageUrl) {
          const { error: updateError } = await supabase
            .from('recipes')
            .update({ image_url: finalImageUrl })
            .eq('id', data.id)

          if (!updateError) {
            data.image_url = finalImageUrl
          }
        }
      } catch (imageError) {
        console.error('Error uploading image file:', imageError)
        // Don't fail the request if image upload fails
      }
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

