import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from './route'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  uploadOptimizedImage: vi.fn(),
  validateUploadedImage: vi.fn(),
}))

vi.mock('@/lib/apiSecurity', () => ({
  authenticateApiRequest: vi.fn().mockResolvedValue({
    profile: { authUserId: 'auth-user', profileId: 'profile-1' },
    error: null,
  }),
  checkApiRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/imageOptimization', () => ({
  uploadOptimizedImage: mocks.uploadOptimizedImage,
}))

vi.mock('@/lib/imageValidation', () => ({
  validateUploadedImage: mocks.validateUploadedImage,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

describe('POST /api/import/image/finalize', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.validateUploadedImage.mockResolvedValue({
      format: 'png',
      width: 2,
      height: 2,
      mimeType: 'image/png',
    })
    mocks.uploadOptimizedImage.mockResolvedValue(null)

    mocks.insert.mockImplementation((payload: Record<string, unknown>) => ({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'recipe-1', ...payload },
          error: null,
        }),
      }),
    }))

    const { createServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({ insert: mocks.insert }),
    } as never)
  })

  it('does not persist legacy metadata JSON as recipe notes', async () => {
    const metadataNotes = JSON.stringify({
      servings: 8,
      prepTime: '15 minutes',
      nutrition: { calories: 180, protein: 3, fat: 7, carbs: 28 },
    })

    const response = await POST(
      new Request('https://cookiejar.example/api/import/image/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://cookiejar.example',
        },
        body: JSON.stringify({
          title: 'Perfect Roasted Vegetables with White Wine',
          ingredients: ['400g carrots'],
          instructions: ['Preheat oven to 200°C.'],
          tags: ['vegetarian'],
          cookbookSource: null,
          metadataNotes,
          imageBuffer: 'AQID',
          imageMimeType: 'image/png',
          servings: 8,
          prepTime: '15 minutes',
          nutrition: { calories: 180, protein: 3, fat: 7, carbs: 28 },
          description: null,
        }),
      }),
    )

    expect(response.status).toBe(201)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      notes: null,
      servings: 8,
      prep_time: '15 minutes',
      calories: 180,
      protein_grams: 3,
      fat_grams: 7,
      carbs_grams: 28,
    }))
  })
})
