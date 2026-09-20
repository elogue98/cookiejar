import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { addComment } from '@/lib/addComment'
import { authenticateApiRequest, checkApiRateLimit } from '@/lib/apiSecurity'
import { RATE_LIMITS } from '@/lib/rateLimit'
import { apiErrorResponse } from '@/lib/apiErrors'
import { commentRequestSchema, parseJsonRequest } from '@/lib/validation'

type CommentUser = {
  id: string
  name: string | null
  avatar_url: string | null
}

type CommentRow = {
  id: string
  message: string
  created_at: string
  user_id: string
  users: CommentUser | CommentUser[] | null
}

function normalizeUserRelation(
  relation: CommentUser | CommentUser[] | null
): CommentUser | null {
  if (!relation) return null
  return Array.isArray(relation) ? relation[0] ?? null : relation
}

/**
 * GET /api/recipes/[id]/comments
 * 
 * Fetches all comments for a recipe, sorted newest first
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(req)
  if (auth.error) return auth.error

  try {
    const { id } = await params

    const supabase = await createServerClient()

    // Fetch comments with user information
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        message,
        created_at,
        user_id,
        users:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .eq('recipe_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching comments:', error)
      // If table doesn't exist, return empty array
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({ success: true, data: [] })
      }
      return NextResponse.json(
        { success: false, error: 'Could not fetch comments', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    // Transform the data to flatten user info
    const commentRows: CommentRow[] = Array.isArray(comments) ? comments : []
    const transformedComments = commentRows.map((comment) => {
      const normalizedUser = normalizeUserRelation(
        comment.users as CommentUser | CommentUser[] | null
      )

      return {
        id: comment.id,
        message: comment.message,
        created_at: comment.created_at,
        user_id: comment.user_id,
        user: normalizedUser
          ? {
              id: normalizedUser.id,
              name: normalizedUser.name,
              avatar_url: normalizedUser.avatar_url,
            }
          : null,
      }
    })

    return NextResponse.json({ success: true, data: transformedComments })
  } catch (error) {
    console.error('Unexpected error:', error)
    return apiErrorResponse(error)
  }
}

/**
 * POST /api/recipes/[id]/comments
 * 
 * Creates a new comment for a recipe
 * Body: { message }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error
  const profileId = auth.profile!.profileId
  const rateLimitError = await checkApiRateLimit(profileId, 'writes', RATE_LIMITS.writes)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await params
    const { message } = await parseJsonRequest(req, commentRequestSchema)

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    const result = await addComment({
      recipe_id: id,
      message: message.trim(),
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Could not create comment', code: 'COMMENT_CREATE_FAILED' },
        { status: 500 }
      )
    }

    // Fetch the comment with user info
    const supabase = await createServerClient()
    const createdCommentId = result.data?.id
    if (!createdCommentId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create comment', code: 'COMMENT_CREATE_FAILED' },
        { status: 500 }
      )
    }

    const { data: commentWithUser, error: fetchError } = await supabase
      .from('comments')
      .select(`
        id,
        message,
        created_at,
        user_id,
        users:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .eq('id', createdCommentId)
      .single()

    if (fetchError || !commentWithUser) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch created comment', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    const normalizedUser = normalizeUserRelation(
      commentWithUser.users as CommentUser | CommentUser[] | null
    )

    const transformedComment = {
      id: commentWithUser.id,
      message: commentWithUser.message,
      created_at: commentWithUser.created_at,
      user_id: commentWithUser.user_id,
      user: normalizedUser
        ? {
            id: normalizedUser.id,
            name: normalizedUser.name,
            avatar_url: normalizedUser.avatar_url,
          }
        : null,
    }

    return NextResponse.json({ success: true, data: transformedComment })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
