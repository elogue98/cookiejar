type ImportResponse<T> = { success: boolean; error?: string; data: T }

export async function readImportResponse<T>(response: Response): Promise<ImportResponse<T>> {
  try {
    return await response.json() as ImportResponse<T>
  } catch {
    // Hosting rejections may be plain text or HTML rather than our API JSON.
    if (response.status === 413) {
      throw new Error('The image is too large to import. Try a smaller image or crop it to just the recipe.')
    }
    if (response.status === 504) {
      throw new Error('The import took too long. Please try again with a cropped image or paste the recipe text.')
    }
    throw new Error('The import service returned an unexpected response. Please try again.')
  }
}
