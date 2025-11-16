'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface StarRatingProps {
  recipeId: string
  initialRating: number | null
}

export default function StarRating({ recipeId, initialRating }: StarRatingProps) {
  const router = useRouter()
  const [rating, setRating] = useState<number | null>(initialRating)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Update local state when initialRating changes (e.g., after refresh)
  useEffect(() => {
    setRating(initialRating)
  }, [initialRating])

  const handleStarClick = async (selectedRating: number) => {
    if (isUpdating) return

    setIsUpdating(true)
    const previousRating = rating
    setRating(selectedRating)
    setHoveredRating(null)

    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: selectedRating,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        // Revert on error
        setRating(previousRating)
        console.error('Failed to update rating:', data.error)
        alert('Failed to update rating. Please try again.')
      } else {
        // Success - ensure rating is set (should already be from optimistic update)
        if (data.data?.rating !== undefined) {
          setRating(data.data.rating)
        }
        // Silently refresh in background to sync with server (non-blocking)
        router.refresh()
      }
    } catch (err) {
      // Revert on error
      setRating(previousRating)
      console.error('Error updating rating:', err)
      alert('An error occurred while updating the rating. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const displayRating = hoveredRating ?? rating

  return (
    <div className="flex items-center gap-0.5" title="Click a star to rate this recipe">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starValue) => {
        const isStarFilled = displayRating !== null && starValue <= displayRating
        
        return (
          <button
            key={starValue}
            type="button"
            onClick={() => handleStarClick(starValue)}
            onMouseEnter={() => !isUpdating && setHoveredRating(starValue)}
            onMouseLeave={() => setHoveredRating(null)}
            disabled={isUpdating}
            className={`transition-all ${
              isUpdating ? 'cursor-wait opacity-50' : 'cursor-pointer hover:scale-125 active:scale-95'
            }`}
            aria-label={`Rate ${starValue} out of 10`}
          >
            <span
              className={`text-xl md:text-2xl transition-all duration-200 ${
                isStarFilled
                  ? ''
                  : 'text-gray-500 opacity-60'
              }`}
              style={isStarFilled ? { 
                color: '#DDC57A'
              } : {}}
            >
              ★
            </span>
          </button>
        )
      })}
    </div>
  )
}

