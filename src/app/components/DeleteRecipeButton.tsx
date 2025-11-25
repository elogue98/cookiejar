'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DeleteRecipeButtonProps {
  recipeId: string
  recipeTitle: string
}

export default function DeleteRecipeButton({ recipeId, recipeTitle }: DeleteRecipeButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Handle Escape key press
  useEffect(() => {
    if (!showConfirmModal) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConfirmModal(false)
        setError(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [showConfirmModal])

  const handleDeleteClick = () => {
    setShowConfirmModal(true)
    setError(null)
  }

  const handleCancel = () => {
    setShowConfirmModal(false)
    setError(null)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/recipes/${recipeId}/delete`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to delete recipe')
        setIsDeleting(false)
        return
      }

      // Success - redirect to homepage
      router.push('/')
    } catch (error) {
      console.error('Error deleting recipe:', error)
      setError('An unexpected error occurred while deleting the recipe')
      setIsDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleDeleteClick}
        disabled={isDeleting}
        className="px-4 py-2 font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: '#D34E4E',
          color: 'white',
          borderRadius: '14px'
        }}
      >
        Delete Recipe
      </button>

      {showConfirmModal && isMounted &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={handleCancel}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: '32px',
                maxWidth: '480px',
                width: '90%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                </div>
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: 'var(--text-main)',
                    marginBottom: '8px',
                  }}
                >
                  Delete Recipe?
                </h2>
                <p style={{ color: 'rgba(43, 43, 43, 0.7)', fontSize: '14px', lineHeight: '1.5' }}>
                  Are you sure you want to delete <strong>"{recipeTitle}"</strong>? This action cannot be undone and will permanently remove the recipe from your collection.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #DC2626',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ color: '#DC2626', fontSize: '14px' }}>{error}</p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isDeleting}
                  style={{
                    padding: '10px 24px',
                    border: '1px solid rgba(211, 78, 78, 0.2)',
                    background: 'white',
                    borderRadius: '14px',
                    color: 'var(--text-main)',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.6 : 1,
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.backgroundColor = 'white'
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  style={{
                    padding: '10px 24px',
                    background: '#D34E4E',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.6 : 1,
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.opacity = '0.9'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDeleting) {
                      e.currentTarget.style.opacity = '1'
                    }
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Recipe'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

