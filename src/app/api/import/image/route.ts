import { NextResponse } from 'next/server'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { validateUploadedImage } from '@/lib/imageValidation'
import { assertRequestContentLength, parseFormDataRequest } from '@/lib/validation'
import { apiErrorResponse, ApiError } from '@/lib/apiErrors'
import { extractImageRecipe } from '@/lib/imageRecipeExtraction'
import { normalizeIngredientSections, normalizeInstructionSections } from '@/lib/recipeFormatting'

export const maxDuration = 300

function flattenIngredientPreview(
  sections: Awaited<ReturnType<typeof normalizeIngredientSections>>
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

export async function POST(req: Request) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const rateLimitError = await checkApiRateLimit(auth.profile!.profileId, 'imports', RATE_LIMITS.imports)
  if (rateLimitError) return rateLimitError

  try {
    const maxBytes = 3_100_000
    assertRequestContentLength(req, maxBytes)
    const formData = await parseFormDataRequest(req, maxBytes)
    const files = formData.getAll('file')
    if (files.length < 1 || files.length > 6 || files.some(file => !(file instanceof File))) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Choose between one and six recipe photos.')
    }
    const images: { buffer: Buffer; mimeType: string }[] = []
    let totalBytes = 0
    for (const file of files as File[]) {
      totalBytes += file.size
      if (totalBytes > 3_000_000) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The photos are too large. Please choose fewer or smaller photos.')
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new ApiError(400, 'INVALID_IMAGE', 'Please upload JPG, PNG, or WEBP photos.')
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      try {
        const mimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
        await validateUploadedImage(buffer, mimeType)
        images.push({ buffer, mimeType })
      } catch {
        throw new ApiError(400, 'INVALID_IMAGE', 'One of the photos could not be read. Please choose a valid image.')
      }
    }
    let draft
    try {
      draft = await extractImageRecipe(images)
    } catch {
      // Never log image data, model responses, or private recipe contents.
      throw new ApiError(502, 'AI_EXTRACTION_FAILED', 'Could not finish reading the recipe. Please try again with clearer or fewer photos.')
    }
    const ingredientSections = await normalizeIngredientSections(draft.ingredientSections, { skipConversions: true })
    const instructionSections = normalizeInstructionSections(draft.instructionSections)
    return NextResponse.json({ success: true, data: {
      ...draft,
      ingredients: flattenIngredientPreview(ingredientSections),
      instructions: formatInstructionPreview(instructionSections),
      tags: draft.tags || [],
      ingredientSections,
      instructionSections,
      sourcePhotoCount: images.length,
      // Retain only the first photo as the recipe image, sent once for saving.
      imageBuffer: images[0].buffer.toString('base64'),
      imageMimeType: images[0].mimeType,
    } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
