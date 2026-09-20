import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { createSignedRecipeImageUrl } from '@/lib/imageUrls'
import { validateUploadedImage } from '@/lib/imageValidation'
import { assertRequestContentLength, parseFormDataRequest } from '@/lib/validation'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const rateLimitError = await checkApiRateLimit(auth.profile!.profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    assertRequestContentLength(req, 12 * 1024 * 1024)
    const { id } = await params
    if (!/^[0-9a-f-]{1,100}$/i.test(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recipe id', code: 'INVALID_REQUEST' },
        { status: 400 },
      )
    }
    
    const formData = await parseFormDataRequest(req, 12 * 1024 * 1024)
    for (const key of formData.keys()) {
      if (key !== 'file') {
        return NextResponse.json(
          { success: false, error: 'Invalid upload payload', code: 'INVALID_REQUEST' },
          { status: 400 },
        )
      }
    }

    const fileValues = formData.getAll('file')
    const file = fileValues.length === 1 && fileValues[0] instanceof File
      ? fileValues[0]
      : null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'File must be an image', code: 'INVALID_IMAGE' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Image is too large', code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let imageInfo: Awaited<ReturnType<typeof validateUploadedImage>>
    try {
      imageInfo = await validateUploadedImage(buffer, file.type)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid image', code: 'INVALID_IMAGE' },
        { status: 400 },
      )
    }
    const supabase = await createServerClient()

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (recipeError) {
      console.error('Error checking recipe before image upload', { code: recipeError.code })
      return NextResponse.json(
        { success: false, error: 'Could not load recipe', code: 'DATABASE_ERROR' },
        { status: 500 },
      )
    }
    if (!recipe) {
      return NextResponse.json(
        { success: false, error: 'Recipe not found', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    // Upload optimized image
    // We pass the recipe ID and the original extension
    const extension = imageInfo.format
    const imagePath = await uploadOptimizedImage(supabase, buffer, id, extension, file.type)

    if (!imagePath) {
      return NextResponse.json(
        { success: false, error: 'Failed to upload image', code: 'STORAGE_ERROR' },
        { status: 500 }
      )
    }

    // Update recipe with new image URL
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ image_path: imagePath })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating recipe image path')
      try {
        await supabase.storage.from('recipe-images').remove([imagePath])
      } catch {
        // Best-effort cleanup; keep the client-facing error generic.
      }
      return NextResponse.json(
        { success: false, error: 'Failed to update recipe record', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    const imageUrl = await createSignedRecipeImageUrl(supabase, imagePath)
    return NextResponse.json({ 
      success: true, 
      imageUrl,
      imagePath,
    })

  } catch (error) {
    console.error('Error in recipe image upload:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
