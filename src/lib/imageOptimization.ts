import sharp from 'sharp'

/**
 * Optimizes an image buffer by:
 * - Auto-rotating based on EXIF orientation
 * - Resizing to max 1500px width (maintaining aspect ratio)
 * - Converting to JPEG with 80% quality
 * 
 * @param buffer - Original image buffer
 * @returns Optimized image buffer
 */
export async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  try {
    const optimized = await sharp(buffer)
      .rotate() // Auto-fix EXIF orientation
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    
    return optimized
  } catch (error) {
    console.error('Error optimizing image:', error)
    throw new Error(`Failed to optimize image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Uploads an optimized image to Supabase storage and handles cleanup of original files.
 * 
 * @param supabase - Supabase client instance
 * @param imageBuffer - Original image buffer (will be optimized before upload)
 * @param recipeId - Recipe ID for file naming
 * @param originalExtension - Original file extension (for cleanup if needed)
 * @returns Public URL of the uploaded optimized image, or null if upload fails
 */
export async function uploadOptimizedImage(
  supabase: ReturnType<typeof import('./supabaseClient').createServerClient>,
  imageBuffer: Buffer,
  recipeId: string,
  originalExtension?: string
): Promise<string | null> {
  try {
    // Optimize the image
    const optimizedBuffer = await optimizeImage(imageBuffer)
    const cacheBuster = Date.now().toString()
    
    // Use optimized filename: recipeId-optimized.jpg
    const optimizedPath = `recipes/${recipeId}-optimized.jpg`
    const originalPath = originalExtension ? `recipes/${recipeId}.${originalExtension}` : null
    
    // Upload optimized image
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(optimizedPath, optimizedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
        // Ensure the CDN doesn't keep serving an old version after an upsert
        cacheControl: '1',
      })
    
    if (uploadError) {
      console.error('Error uploading optimized image:', uploadError)
      return null
    }
    
    // Get public URL for optimized image
    const { data: urlData } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(optimizedPath)
    
    const optimizedUrl = urlData.publicUrl
    const cacheSafeUrl = optimizedUrl.includes('?')
      ? `${optimizedUrl}&v=${cacheBuster}`
      : `${optimizedUrl}?v=${cacheBuster}`
    
    // Delete original file if it exists and is different from optimized
    if (originalPath && originalPath !== optimizedPath) {
      try {
        await supabase.storage
          .from('recipe-images')
          .remove([originalPath])
      } catch (deleteError) {
        // Log but don't fail - original might not exist
        console.warn('Could not delete original image (may not exist):', deleteError)
      }
    }
    
    // Return URL with cache buster so clients fetch the fresh image
    return cacheSafeUrl
  } catch (error) {
    console.error('Error in uploadOptimizedImage:', error)
    return null
  }
}

