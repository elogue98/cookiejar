export const MAX_IMPORT_IMAGE_BYTES = 2_000_000

export async function prepareImportImage(file: File, maxBytes = MAX_IMPORT_IMAGE_BYTES): Promise<File> {
  // Leave room for base64 expansion when the extracted image is sent back
  // and then submitted to finalize. Both requests must fit Vercel's limit.
  const byteBudget = Math.min(MAX_IMPORT_IMAGE_BYTES, maxBytes)
  if (file.size <= byteBudget) return file

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image could not be decoded'))
      image.src = objectUrl
    })
    const { naturalWidth: width, naturalHeight: height } = image
    if (!width || !height || width * height > 40_000_000) throw new Error('Image dimensions are too large')

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable')
    let scale = Math.min(1, 2560 / Math.max(width, height))

    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      // JPEG has no alpha channel; keep transparent recipe screenshots white.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Image could not be encoded')
      if (blob.size <= byteBudget) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
      }
      scale *= 0.8
    }
    throw new Error('Image could not be reduced enough')
  } catch {
    throw new Error('Could not prepare this image. Please try a JPG, PNG, or WEBP image.')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
