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

export async function createSignedRecipeImageUrl(
  supabase: SignedStorageClient,
  imagePath: string,
): Promise<string> {
  if (
    !IMAGE_PATH_PATTERN.test(imagePath) ||
    imagePath.includes('..') ||
    imagePath.includes('//') ||
    imagePath.includes('\\')
  ) {
    throw new Error('Invalid recipe image path')
  }

  const { data, error } = await supabase.storage
    .from('recipe-images')
    .createSignedUrl(imagePath, 60 * 60)

  if (error || !data?.signedUrl) throw new Error('Recipe image unavailable')
  return data.signedUrl
}
