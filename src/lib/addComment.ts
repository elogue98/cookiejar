import { createServerClient } from './supabaseClient'

type CommentRow = {
  id: string
  recipe_id: string
  user_id: string
  message: string
  created_at: string
  [key: string]: unknown
}

interface AddCommentParams {
  recipe_id: string
  user_id: string
  message: string
}

/**
 * Adds a comment to a recipe
 */
export async function addComment({
  recipe_id,
  user_id,
  message,
}: AddCommentParams): Promise<{ success: boolean; data?: CommentRow; error?: string }> {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('comments')
      .insert({
        recipe_id,
        user_id,
        message: message.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding comment:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as CommentRow }
  } catch (error) {
    console.error('Unexpected error adding comment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

