import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { POST } from './route'

const insert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/apiSecurity', () => ({
  authenticateApiRequest: async () => ({ profile: { profileId: 'u1' } }),
  checkApiRateLimit: async () => null,
}))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: () => ({ insert }) }) }))
vi.mock('@/lib/imageOptimization', () => ({ uploadOptimizedImage: async () => null }))
vi.mock('@/lib/recipeResponses', () => ({ toRecipeResponse: async (_client: unknown, recipe: unknown) => recipe }))
beforeEach(() => {
  vi.clearAllMocks()
  insert.mockImplementation(data => ({ select: () => ({ single: async () => ({ data: { id: 'r1', ...data }, error: null }) }) }))
})

it.each([null, 'A family favourite.'])('saves the recipe description without appending import diagnostics: %s', async description => {
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer()
  const response = await POST(new Request('http://localhost/api/import/image/finalize', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Sausages', description,
      ingredientSections: [{ section: '', items: ['8 sausages'] }],
      instructionSections: [{ section: '', steps: ['Roast the sausages.'] }],
      imageBuffer: image.toString('base64'), imageMimeType: 'image/png',
      sourceNotes: ['Handwritten 250 above 200C.'],
      reviewWarnings: ['Confirm the temperature before cooking.'], reviewAcknowledged: true,
    }),
  }))
  expect(response.status).toBe(201)
  expect(insert.mock.calls[0][0].notes).toBe(description)
  const saved = (await response.json()).data
  expect(saved.notes).toBe(description)
  expect(saved.instructions[0].steps).toEqual(['Roast the sausages.'])
})

it('still requires acknowledgement of review warnings before saving', async () => {
  const response = await POST(new Request('http://localhost/api/import/image/finalize', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Sausages', imageBuffer: 'AAAA', imageMimeType: 'image/png', reviewWarnings: ['The method is cut off.'] }),
  }))
  expect(response.status).toBe(400)
  expect(insert).not.toHaveBeenCalled()
})
