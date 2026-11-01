import { expect, it } from 'vitest'
import { readImportResponse } from './importResponse'

it('preserves successful and application error JSON responses', async () => {
  const success = { success: true, data: { id: 'recipe-1' } }
  expect(await readImportResponse(Response.json(success))).toEqual(success)
  const failure = { success: false, error: 'No text could be extracted from the image' }
  expect(await readImportResponse(Response.json(failure, { status: 400 }))).toEqual(failure)
})

it('explains a hosting payload rejection instead of exposing a browser JSON parse error', async () => {
  await expect(readImportResponse(new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 })))
    .rejects.toThrow('The image is too large to import. Try a smaller image or crop it to just the recipe.')
})

it('explains an upstream failure without displaying an HTML error page', async () => {
  await expect(readImportResponse(new Response('<html>Bad gateway</html>', { status: 502 })))
    .rejects.toThrow('The import service returned an unexpected response. Please try again.')
})

it('explains an import timeout', async () => {
  await expect(readImportResponse(new Response('FUNCTION_INVOCATION_TIMEOUT', { status: 504 })))
    .rejects.toThrow('The import took too long. Please try again with a cropped image or paste the recipe text.')
})
