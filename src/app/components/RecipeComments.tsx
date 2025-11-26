'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/lib/userContext'
import UserAvatar from './UserAvatar'

interface Comment {
  id: string
  message: string
  created_at: string
  user_id: string
  user: {
    id: string
    name: string
    avatar_url: string
  } | null
}

interface RecipeCommentsProps {
  recipeId: string
}

export default function RecipeComments({ recipeId }: RecipeCommentsProps) {
  const { user } = useUser()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments`)
      const data = await response.json()
      if (data.success) {
        setComments(data.data || [])
      } else {
        setError(data.error || 'Failed to load comments')
      }
    } catch {
      setError('Failed to load comments')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch comments on mount
  useEffect(() => {
    fetchComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newComment.trim(),
          user_id: user.id,
        }),
      })

      const data = await response.json()
      if (data.success && data.data) {
        setComments([data.data, ...comments])
        setNewComment('')
      } else {
        setError(data.error || 'Failed to post comment')
      }
    } catch {
      setError('Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <section className="mt-8 pt-8 border-t" style={{ borderColor: 'rgba(211, 78, 78, 0.1)' }}>
      <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-main)' }}>
        Comments
      </h3>

      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                className="w-full px-4 py-2 rounded-lg border resize-none focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  minHeight: '80px',
                }}
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-4 py-2 font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: '#D34E4E',
                color: 'white',
              }}
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
          {error && (
            <p className="text-sm mt-2" style={{ color: '#D34E4E' }}>
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm mb-6" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
          Please log in to add a comment.
        </p>
      )}

      {/* Comments List */}
      {isLoading ? (
        <p className="text-sm" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
          Loading comments...
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 p-4 rounded-lg"
              style={{ backgroundColor: 'var(--accent-light)' }}
            >
              {comment.user && (
                <UserAvatar
                  src={comment.user.avatar_url}
                  alt={comment.user.name}
                  name={comment.user.name}
                  size="small"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-main)' }}>
                    {comment.user?.name || 'Unknown'}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(43, 43, 43, 0.6)' }}>
                    {formatTimestamp(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-main)' }}>
                  {comment.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
