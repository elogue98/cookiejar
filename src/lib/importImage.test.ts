import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { prepareImportImage, MAX_IMPORT_IMAGE_BYTES } from './importImage'

const encode = vi.fn()
const revoke = vi.fn()
const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }), toBlob: encode }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('Image', class {
    naturalWidth = 3024
    naturalHeight = 4032
    onload?: () => void
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  vi.stubGlobal('document', { createElement: () => canvas })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-image')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke)
  encode.mockImplementation((done: BlobCallback) => done(new Blob([new Uint8Array(700_000)], { type: 'image/jpeg' })))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('keeps small photos unchanged', async () => {
  const file = new File(['small'], 'recipe.png', { type: 'image/png' })
  expect(await prepareImportImage(file)).toBe(file)
  expect(encode).not.toHaveBeenCalled()
})

it('honours a shared per-photo budget when importing several pages', async () => {
  const file = new File([new Uint8Array(1_000_000)], 'page.png', { type: 'image/png' })
  encode.mockImplementation((done: BlobCallback) => done(new Blob([new Uint8Array(400_000)], { type: 'image/jpeg' })))
  const result = await prepareImportImage(file, 500_000)
  expect(result.size).toBeLessThanOrEqual(500_000)
  expect(result.type).toBe('image/jpeg')
})

it('makes large phone photos fit both multipart upload and base64 finalization', async () => {
  const file = new File([new Uint8Array(6_000_000)], 'IMG_2118.png', { type: 'image/png' })
  const result = await prepareImportImage(file)
  expect(result.size).toBeLessThanOrEqual(MAX_IMPORT_IMAGE_BYTES)
  expect(result.type).toBe('image/jpeg')
  expect(Math.max(canvas.width, canvas.height)).toBe(2560)
  expect(canvas.width / canvas.height).toBeCloseTo(3024 / 4032, 2)
  const base64 = Buffer.from(await result.arrayBuffer()).toString('base64')
  expect(Buffer.byteLength(JSON.stringify({ imageBuffer: base64 }))).toBeLessThan(3_000_000)
  expect(revoke).toHaveBeenCalledWith('blob:test-image')
})

it('reduces a difficult image further if the first encoding is still too large', async () => {
  encode.mockImplementationOnce((done: BlobCallback) => done(new Blob([new Uint8Array(3_000_000)], { type: 'image/jpeg' })))
  const result = await prepareImportImage(new File([new Uint8Array(5_000_000)], 'recipe.png', { type: 'image/png' }))
  expect(result.size).toBeLessThanOrEqual(MAX_IMPORT_IMAGE_BYTES)
  expect(encode).toHaveBeenCalledTimes(2)
})

it('stops safely when the browser cannot encode an image', async () => {
  encode.mockImplementation((done: BlobCallback) => done(null))
  await expect(prepareImportImage(new File([new Uint8Array(5_000_000)], 'recipe.png', { type: 'image/png' })))
    .rejects.toThrow('Could not prepare this image. Please try a JPG, PNG, or WEBP image.')
  expect(revoke).toHaveBeenCalledWith('blob:test-image')
})

it('stops after bounded attempts if an image cannot fit the upload budget', async () => {
  encode.mockImplementation((done: BlobCallback) => done(new Blob([new Uint8Array(3_000_000)], { type: 'image/jpeg' })))
  await expect(prepareImportImage(new File([new Uint8Array(5_000_000)], 'recipe.png', { type: 'image/png' })))
    .rejects.toThrow('Could not prepare this image')
  expect(encode).toHaveBeenCalledTimes(8)
  expect(revoke).toHaveBeenCalledWith('blob:test-image')
})

it('cleans up and reports an unreadable photo', async () => {
  vi.stubGlobal('Image', class {
    onerror?: () => void
    set src(_value: string) { queueMicrotask(() => this.onerror?.()) }
  })
  await expect(prepareImportImage(new File([new Uint8Array(5_000_000)], 'broken.png', { type: 'image/png' })))
    .rejects.toThrow('Could not prepare this image')
  expect(revoke).toHaveBeenCalledWith('blob:test-image')
})
