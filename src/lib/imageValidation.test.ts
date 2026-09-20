import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { validateUploadedImage } from './imageValidation'

describe('validateUploadedImage', () => {
  it('requires a real image signature and returns decoded dimensions', async () => {
    const buffer = await sharp({
      create: { width: 2, height: 3, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    }).png().toBuffer()

    await expect(validateUploadedImage(buffer, 'image/png')).resolves.toMatchObject({
      format: 'png',
      width: 2,
      height: 3,
    })
    await expect(validateUploadedImage(Buffer.from('not an image'), 'image/png'))
      .rejects.toThrow('Unsupported image format')
  })

  it('rejects MIME mismatches, oversized encoded input, and oversized decoded dimensions', async () => {
    const smallPng = await sharp({
      create: { width: 1, height: 1, channels: 4, background: 'white' },
    }).png().toBuffer()
    await expect(validateUploadedImage(smallPng, 'image/jpeg')).rejects.toThrow('Image MIME type does not match')
    await expect(validateUploadedImage(Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png'))
      .rejects.toThrow('Image file is too large')

    const largeImage = await sharp({
      create: { width: 7_000, height: 7_000, channels: 4, background: 'white' },
    }).png().toBuffer()
    await expect(validateUploadedImage(largeImage, 'image/png')).rejects.toThrow('Image dimensions are too large')
  })
})
