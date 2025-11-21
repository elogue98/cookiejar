'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/userContext'

interface StarRatingProps {
  recipeId: string
  initialRating: number | null // This is now the average rating
}

export default function StarRating({ recipeId, initialRating }: StarRatingProps) {
  const router = useRouter()
  const { user } = useUser()
  const [userRating, setUserRating] = useState<number | null>(null) // Current user's rating
  const [averageRating, setAverageRating] = useState<number | null>(initialRating) // Average rating
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch rating data on mount and when user changes
  useEffect(() => {
    async function fetchRatings() {
      if (!user?.id) {
        // If not logged in, just show average rating
        setAverageRating(initialRating)
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/recipes/${recipeId}/ratings?userId=${user.id}`)
        const data = await res.json()

        if (res.ok && data.success) {
          setUserRating(data.data.userRating)
          setAverageRating(data.data.averageRating)
        } else {
          // Fallback to initial rating if API fails
          setAverageRating(initialRating)
        }
      } catch (error) {
        console.error('Error fetching ratings:', error)
        setAverageRating(initialRating)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRatings()
  }, [recipeId, user?.id, initialRating])

  const handleStarClick = async (selectedRating: number) => {
    if (isUpdating || !user?.id) {
      if (!user?.id) {
        alert('Please log in to rate recipes')
      }
      return
    }

    setIsUpdating(true)
    const previousUserRating = userRating
    setUserRating(selectedRating)
    setHoveredRating(null)

    try {
      const res = await fetch(`/api/recipes/${recipeId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          rating: selectedRating,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        // Revert on error
        setUserRating(previousUserRating)
        console.error('Failed to update rating:', data.error)
        alert(data.error || 'Failed to update rating. Please try again.')
      } else {
        // Success - update both user rating and average
        setUserRating(data.data.userRating)
        setAverageRating(data.data.averageRating)
        // Silently refresh in background to sync with server (non-blocking)
        router.refresh()
      }
    } catch (err) {
      // Revert on error
      setUserRating(previousUserRating)
      console.error('Error updating rating:', err)
      alert('An error occurred while updating the rating. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Display logic:
  // - If hovering: show hover rating
  // - If user has rated: show their rating (yellow stars)
  // - If user hasn't rated: show all grey stars (not filled)
  const displayRating = hoveredRating ?? userRating

  // Determine tooltip text
  const getTooltipText = () => {
    if (hoveredRating !== null) {
      return `Rate ${hoveredRating} out of 10`
    }
    if (userRating !== null && user) {
      return `Your rating: ${userRating}/10${averageRating !== null ? ` | Average: ${averageRating}/10` : ''}`
    }
    if (averageRating !== null) {
      return `Average rating: ${averageRating}/10${!user ? ' (Log in to rate)' : ' - Click a star to rate'}`
    }
    return user ? 'Click a star to rate this recipe' : 'Log in to rate this recipe'
  }

  return (
    <div className="flex items-center gap-0.5" title={getTooltipText()}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starValue) => {
        // Only fill stars if user has rated (or is hovering)
        // If user hasn't rated, all stars stay grey
        const isStarFilled = displayRating !== null && starValue <= displayRating
        
        return (
          <button
            key={starValue}
            type="button"
            onClick={() => handleStarClick(starValue)}
            onMouseEnter={() => !isUpdating && setHoveredRating(starValue)}
            onMouseLeave={() => setHoveredRating(null)}
            disabled={isUpdating || isLoading}
            className={`transition-all ${
              isUpdating || isLoading ? 'cursor-wait opacity-50' : user ? 'cursor-pointer hover:scale-125 active:scale-95' : 'cursor-not-allowed opacity-60'
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

