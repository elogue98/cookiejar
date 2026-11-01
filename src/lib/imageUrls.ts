export type SignedStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, expiresIn: number) => Promise<{
        data: { signedUrl?: string } | null
        error: unknown
      }>
    }
  }
}

const IMAGE_PATH_PATTERN = /^recipes\/[A-Za-z0-9][A-Za-z0-9._-]{0,500}\.(?:jpe?g|png|webp|gif)$/i

function isRecipeImagePath(imagePath: string): boolean {
  return IMAGE_PATH_PATTERN.test(imagePath) &&
    !imagePath.includes('..') && !imagePath.includes('//') && !imagePath.includes('\\')
}

type BatchSignedStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (paths: string[], expiresIn: number) => Promise<{
        data: { path: string | null; signedUrl?: string | null; error?: string | null }[] | null
        error: unknown
      }>
    }
  }
}

/** Sign the collection in one request; missing images must not hide recipes. */
export async function createSignedRecipeImageUrls(
  supabase: BatchSignedStorageClient,
  imagePaths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const paths = [...new Set(imagePaths.filter((path): path is string =>
    typeof path === 'string' && isRecipeImagePath(path)
  ))]
  const urls = new Map<string, string>()
  if (paths.length === 0) return urls

  try {
    const { data, error } = await supabase.storage.from('recipe-images').createSignedUrls(paths, 60 * 60)
    if (error || !data) return urls
    for (const image of data) {
      if (image.path && image.signedUrl && !image.error && paths.includes(image.path)) {
        urls.set(image.path, image.signedUrl)
      }
    }
  } catch {
    // Keep the same image-free fallback as single-image signing failures.
  }
  return urls
}

export async function createSignedRecipeImageUrl(
  supabase: SignedStorageClient,
  imagePath: string,
): Promise<string> {
  if (!isRecipeImagePath(imagePath)) {
    throw new Error('Invalid recipe image path')
  }

  const { data, error } = await supabase.storage
    .from('recipe-images')
    .createSignedUrl(imagePath, 60 * 60)

  if (error || !data?.signedUrl) throw new Error('Recipe image unavailable')
  return data.signedUrl
}
