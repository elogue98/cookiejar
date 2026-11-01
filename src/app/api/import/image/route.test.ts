import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { POST } from './route'

const mocks = vi.hoisted(() => ({ vision: vi.fn() }))
vi.mock('@/lib/imageRecipeExtraction', () => ({ extractImageRecipe: mocks.vision }))
vi.mock('@/lib/apiSecurity', () => ({
  authenticateApiRequest: async () => ({ profile: { profileId: 'u1' } }),
  checkApiRateLimit: async () => null,
}))

beforeEach(() => {
  vi.clearAllMocks()
  const recipe = {
    title: 'Roasted sausages with squash', description: null, sourceUrl: null, image: null,
    servings: 4, prepTime: '15 minutes', cookTime: '45 minutes', totalTime: null,
    cuisine: null, mealType: null, nutrition: null,
    ingredientSections: [{ section: '', items: ['8 pork sausages'] }],
    instructionSections: [{ section: '', steps: ['Roast the sausages.'] }], tags: [],
  }
  mocks.vision.mockResolvedValue({ ...recipe, reviewWarnings: ['The method is cut off; add the next page.'], sourceNotes: ['Handwritten: Brown the sausages.'] })
})

it('keeps a photo-sized extraction response below the hosting limit and preserves the image for finalization', async () => {
  // A valid PNG padded to the reported photo's size, without storing a private photo in the repo.
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  const image = Buffer.alloc(2_329_242)
  png.copy(image)
  const form = new FormData()
  form.set('file', new File([image], 'recipe.png', { type: 'image/png' }))
  const response = await POST(new Request('http://localhost/api/import/image', { method: 'POST', body: form }))

  expect(response.status).toBe(200)
  const body = await response.text()
  expect(Buffer.byteLength(body)).toBeLessThan(4_500_000)
  const { data } = JSON.parse(body)
  expect(Buffer.from(data.imageBuffer, 'base64')).toEqual(image)
  expect(data.imageMimeType).toBe('image/png')
  expect(data.title).toBe('Roasted sausages with squash')
  expect(data.reviewWarnings).toEqual(['The method is cut off; add the next page.'])
  expect(data.sourceNotes).toEqual(['Handwritten: Brown the sausages.'])
})

it('extracts all selected pages together and preserves gravy sections and quantities', async () => {
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  const form = new FormData()
  for (const name of ['page1.png', 'page2.png']) form.append('file', new File([image], name, { type: 'image/png' }))
  mocks.vision.mockResolvedValue({
    title: 'Sausages', ingredientSections: [{ section: 'For the onion gravy', items: ['2 onions, thinly sliced', '500ml chicken or beef stock'] }],
    instructionSections: [{ section: 'For the onion gravy', steps: ['Fry the onions for half an hour until golden brown.'] }],
    tags: [], reviewWarnings: [], sourceNotes: [],
  })
  const response = await POST(new Request('http://localhost/api/import/image', { method: 'POST', body: form }))
  expect(response.status).toBe(200)
  expect(mocks.vision).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ buffer: image, mimeType: 'image/png' }),
    expect.objectContaining({ buffer: image, mimeType: 'image/png' }),
  ]))
  expect(mocks.vision.mock.calls[0][0]).toHaveLength(2)
  const { data } = await response.json()
  expect(data.ingredientSections[0].items).toContain('500ml chicken or beef stock')
  expect(data.instructionSections[0].section).toBe('For the onion gravy')
  expect(data.sourcePhotoCount).toBe(2)
})

it('rejects more than six pages before calling the model', async () => {
  const form = new FormData()
  for (let i = 0; i < 7; i++) form.append('file', new File(['png'], `${i}.png`, { type: 'image/png' }))
  const response = await POST(new Request('http://localhost/api/import/image', { method: 'POST', body: form }))
  expect(response.status).toBe(400)
  expect(mocks.vision).not.toHaveBeenCalled()
})

it('validates continuation images before sending any image to the model', async () => {
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  const form = new FormData()
  form.append('file', new File([image], 'page1.png', { type: 'image/png' }))
  form.append('file', new File(['not an image'], 'page2.png', { type: 'image/png' }))
  const response = await POST(new Request('http://localhost/api/import/image', { method: 'POST', body: form }))
  expect(response.status).toBe(400)
  expect(mocks.vision).not.toHaveBeenCalled()
})

it('rejects an excessive aggregate upload before calling the model', async () => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(3_000_001)], 'page.png', { type: 'image/png' }))
  const response = await POST(new Request('http://localhost/api/import/image', { method: 'POST', body: form }))
  expect(response.status).toBe(413)
  expect(mocks.vision).not.toHaveBeenCalled()
})

it('returns a safe error without a draft if extraction or verification fails', async () => {
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  const form = new FormData()
  form.append('file', new File([image], 'page.png', { type: 'image/png' }))
  mocks.vision.mockRejectedValue(new Error('private upstream details'))
  const response = await POST(new Request('http://localhost/api/import/image', { method: 'POST', body: form }))
  expect(response.status).toBe(502)
  const body = await response.text()
  expect(body).not.toContain('private upstream details')
  expect(body).not.toContain('imageBuffer')
})
