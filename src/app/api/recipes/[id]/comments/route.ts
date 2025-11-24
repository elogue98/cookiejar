import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { addComment } from '@/lib/addComment'

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
  try {
    const { id } = await params

    const supabase = createServerClient()

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
        { success: false, error: error.message },
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recipes/[id]/comments
 * 
 * Creates a new comment for a recipe
 * Body: { message, user_id }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { message, user_id } = body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      )
    }

    const result = await addComment({
      recipe_id: id,
      user_id,
      message: message.trim(),
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Fetch the comment with user info
    const supabase = createServerClient()
    const createdCommentId = result.data?.id
    if (!createdCommentId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create comment' },
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
        { success: false, error: 'Failed to fetch created comment' },
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
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

