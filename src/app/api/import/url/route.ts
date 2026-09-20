import { POST as aiImportPOST } from '@/app/api/import/ai/route'
/**
 * POST /api/import/url
 * 
 * This route now delegates to the AI import route which has better
 * metadata extraction including nutrition calculation and servings estimation
 */
export async function POST(req: Request) {
  // The delegated handler owns the complete authentication, origin, rate-limit,
  // validation, safe-fetch, and error boundary. Pass the original request so a
  // single URL import consumes exactly one imports rate-limit token.
  return aiImportPOST(req)
}
