'use client'

import { useState, useEffect } from 'react'
import UserAvatar from './UserAvatar'

interface RecipeVersion {
  id: string
  recipe_id: string
  user_id: string
  timestamp: string
  field_changed: string
  previous_value: unknown
  new_value: unknown
  description: string | null
  user: {
    id: string
    name: string
    avatar_url: string
  } | null
}

interface RecipeHistoryProps {
  recipeId: string
}

export default function RecipeHistory({ recipeId }: RecipeHistoryProps) {
  const [versions, setVersions] = useState<RecipeVersion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const fetchVersions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/recipes/${recipeId}/versions`)
      const data = await response.json()
      if (data.success) {
        setVersions(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch latest version on mount to show "Last updated" text
  useEffect(() => {
    fetchVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId])

  // Refetch all versions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchVersions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getFieldDisplayName = (field: string) => {
    const fieldMap: Record<string, string> = {
      title: 'Title',
      ingredients: 'Ingredients',
      instructions: 'Instructions',
      tags: 'Tags',
      servings: 'Servings',
      nutrition: 'Nutrition',
    }
    return fieldMap[field] || field
  }

  return (
    <>
      {/* Trigger Button - Last Updated Info */}
      {versions.length > 0 && versions[0]?.user ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-sm underline cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: 'rgba(43, 43, 43, 0.7)' }}
        >
          Last updated by {versions[0].user.name} — View history
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="text-sm underline cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: 'rgba(43, 43, 43, 0.7)' }}
        >
          View history
        </button>
      )}

      {/* Modal/Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-6 border-b"
              style={{ borderColor: 'rgba(211, 78, 78, 0.1)' }}
            >
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                Recipe History
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-2xl hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-main)' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <p className="text-sm" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
                  Loading history...
                </p>
              ) : versions.length === 0 ? (
                <p className="text-sm" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
                  No changes recorded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-4 rounded-lg border"
                      style={{
                        borderColor: 'rgba(211, 78, 78, 0.1)',
                        backgroundColor: 'var(--accent-light)',
                      }}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        {version.user && (
                          <UserAvatar
                            src={version.user.avatar_url}
                            alt={version.user.name}
                            name={version.user.name}
                            size="small"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm" style={{ color: 'var(--text-main)' }}>
                              {version.user?.name || 'Unknown'}
                            </span>
                            <span className="text-xs" style={{ color: 'rgba(43, 43, 43, 0.6)' }}>
                              {formatTimestamp(version.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm mb-2">
                            <span className="font-semibold" style={{ color: 'var(--text-main)' }}>
                              {getFieldDisplayName(version.field_changed)}:
                            </span>
                            {version.description && (
                              <span className="ml-2" style={{ color: 'rgba(43, 43, 43, 0.8)' }}>
                                {version.description}
                              </span>
                            )}
                          </div>
                          {/* Revert button stub */}
                          <button
                            className="text-xs underline mt-2"
                            style={{ color: '#D34E4E' }}
                            onClick={() => {
                              // TODO: Implement revert logic
                              alert('Revert functionality coming soon!')
                            }}
                          >
                            Revert to this version
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
