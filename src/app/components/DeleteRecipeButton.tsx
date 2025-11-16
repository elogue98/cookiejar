'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DeleteRecipeButtonProps {
  recipeId: string
  recipeTitle: string
}

export default function DeleteRecipeButton({ recipeId, recipeTitle }: DeleteRecipeButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${recipeTitle}"? This action cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/recipes/${recipeId}/delete`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        alert(data.error || 'Failed to delete recipe')
        setIsDeleting(false)
        return
      }

      // Success - redirect to homepage
      router.push('/')
    } catch (error) {
      console.error('Error deleting recipe:', error)
      alert('An unexpected error occurred while deleting the recipe')
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="px-4 py-2 font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: '#D34E4E',
        color: 'white',
        borderRadius: '14px'
      }}
    >
      {isDeleting ? 'Deleting...' : 'Delete Recipe'}
    </button>
  )
}

