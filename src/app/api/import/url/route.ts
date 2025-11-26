/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { generateTagsForRecipe } from '@/lib/aiTagging'
import { uploadOptimizedImage } from '@/lib/imageOptimization'
// Import from the AI-powered route instead for better metadata extraction
import { POST as aiImportPOST } from '@/app/api/import/ai/route'

/**
 * POST /api/import/url
 * 
 * This route now delegates to the AI import route which has better
 * metadata extraction including nutrition calculation and servings estimation
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { url, userId } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required and must be a string' },
        { status: 400 }
      )
    }

    // Delegate to the AI import route which has comprehensive metadata extraction
    // including nutrition calculation and intelligent servings estimation
    const aiImportRequest = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ url, userId })
    })

    return await aiImportPOST(aiImportRequest)

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
