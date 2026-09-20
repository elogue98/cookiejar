import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000

type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif'

function detectFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (buffer.length >= 8 && Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).equals(buffer.subarray(0, 8))) return 'png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'gif'
  return null
}

function expectedMime(format: ImageFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`
}

export async function validateUploadedImage(buffer: Buffer, declaredMime?: string) {
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('Image file is too large')

  const format = detectFormat(buffer)
  if (!format) throw new Error('Unsupported image format')

  const normalizedMime = declaredMime?.split(';', 1)[0].trim().toLowerCase()
  if (normalizedMime && normalizedMime !== expectedMime(format)) {
    throw new Error('Image MIME type does not match its signature')
  }

  let metadata: { width?: number; height?: number }
  try {
    metadata = await sharp(buffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: 'error',
    }).metadata()
  } catch {
    throw new Error('Image dimensions are too large')
  }

  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('Image dimensions are too large')
  }

  return { format, width, height, mimeType: expectedMime(format) }
}
