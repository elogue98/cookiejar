import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

const mocks = vi.hoisted(() => ({
  uploadOptimizedImage: vi.fn(),
  validateUploadedImage: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/apiSecurity', () => ({
  authenticateApiRequest: vi.fn().mockResolvedValue({
    profile: { authUserId: 'auth-user', profileId: 'profile-1' },
    error: null,
  }),
  checkApiRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/imageOptimization', () => ({ uploadOptimizedImage: mocks.uploadOptimizedImage }))
vi.mock('@/lib/imageValidation', () => ({ validateUploadedImage: mocks.validateUploadedImage }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

describe('POST /api/recipes/[id]/image', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.validateUploadedImage.mockResolvedValue({ format: 'png', width: 2, height: 2, mimeType: 'image/png' })
    const { createServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      storage: { from: vi.fn().mockReturnValue({ remove: mocks.remove }) },
    } as never)
  })

  it('checks recipe existence before uploading an image', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'recipe.png', { type: 'image/png' }))

    const response = await POST(
      new Request('https://cookiejar.example/api/recipes/00000000-0000-4000-8000-000000000001/image', {
        method: 'POST',
        headers: { Origin: 'https://cookiejar.example' },
        body: form,
      }),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' })
    expect(mocks.uploadOptimizedImage).not.toHaveBeenCalled()
  })

  it('rejects a non-file upload field with a safe client error', async () => {
    const form = new FormData()
    form.append('file', 'not-a-file')

    const response = await POST(
      new Request('https://cookiejar.example/api/recipes/00000000-0000-4000-8000-000000000001/image', {
        method: 'POST',
        headers: { Origin: 'https://cookiejar.example' },
        body: form,
      }),
      { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(mocks.uploadOptimizedImage).not.toHaveBeenCalled()
  })
})
