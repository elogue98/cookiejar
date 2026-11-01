import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { extractImageRecipe } from './imageRecipeExtraction'

const create = vi.hoisted(() => vi.fn())
vi.mock('openai', () => ({ default: class { chat = { completions: { create } } } }))
const extracted = {
  title: 'Roasted sausages', description: 'Roasted sausages with squash and onion gravy.', sourceUrl: null, image: null,
  servings: 4, prepTime: '15 minutes', cookTime: '45 minutes', totalTime: null,
  cuisine: null, mealType: null, nutrition: null,
  ingredientSections: [{ section: 'For the onion gravy', items: ['2 onions, thinly sliced', '500ml chicken or beef stock'] }],
  instructionSections: [{ section: '', steps: ['Heat the oven to 200°C.'] }], tags: [],
  reviewWarnings: ['The onion gravy method is not visible.'],
  sourceNotes: ['The handwritten oven temperature appears to say 250°C; confirm before using.'],
}
beforeEach(() => {
  vi.clearAllMocks()
  create.mockResolvedValue({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(extracted) } }] })
})

it('returns a validated draft with quantities, sections, uncertainty and handwriting intact', async () => {
  const buffer = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  expect(await extractImageRecipe([{ buffer, mimeType: 'image/png' }])).toEqual(extracted)
  const request = create.mock.calls[0][0]
  expect(request.model).toBe('gpt-6-luna')
  expect(request.reasoning_effort).toBe('medium')
  expect(request).not.toHaveProperty('temperature')
  expect(request.response_format.json_schema.strict).toBe(true)
  expect(request.messages[1].content).toContainEqual(expect.objectContaining({
    type: 'image_url', image_url: expect.objectContaining({ detail: 'original' }),
  }))
})

it('uses one Luna call and never escalates to a second model', async () => {
  const buffer = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  const result = await extractImageRecipe([{ buffer, mimeType: 'image/png' }])
  expect(result.instructionSections).toEqual(extracted.instructionSections)
  expect(create).toHaveBeenCalledTimes(1)
  expect(create.mock.calls[0][0].model).toBe('gpt-6-luna')
})

it('sends each page once without multiplying image-token costs with duplicate crops', async () => {
  const buffer = await sharp({ create: { width: 800, height: 1800, channels: 3, background: 'white' } }).png().toBuffer()
  await extractImageRecipe([{ buffer, mimeType: 'image/png' }, { buffer, mimeType: 'image/png' }])
  const content = create.mock.calls[0][0].messages[1].content
  expect(content.filter((part: { type: string }) => part.type === 'image_url')).toHaveLength(2)
})

it.each(['length', 'content_filter'])('rejects unfinished or filtered output: %s', async finish_reason => {
  create.mockResolvedValue({ choices: [{ finish_reason, message: { content: JSON.stringify(extracted) } }] })
  const buffer = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  await expect(extractImageRecipe([{ buffer, mimeType: 'image/png' }])).rejects.toThrow('incomplete')
})

it('rejects a refusal instead of presenting a recipe draft', async () => {
  create.mockResolvedValue({ choices: [{ finish_reason: 'stop', message: { refusal: 'Refused', content: null } }] })
  const buffer = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } }).png().toBuffer()
  await expect(extractImageRecipe([{ buffer, mimeType: 'image/png' }])).rejects.toThrow('Could not extract')
})
