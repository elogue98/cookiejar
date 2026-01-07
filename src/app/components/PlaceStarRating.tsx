'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/userContext'

interface PlaceStarRatingProps {
  placeId: string
  initialAverage: number | null
  onRated?: (average: number | null, total: number) => void
}

type RatingsResponse = {
  success: boolean
  data?: {
    userRating: number | null
    averageRating: number | null
    totalRatings: number
  }
  error?: string
}

export default function PlaceStarRating({ placeId, initialAverage, onRated }: PlaceStarRatingProps) {
  const router = useRouter()
  const { user } = useUser()
  const [userRating, setUserRating] = useState<number | null>(null)
  const [averageRating, setAverageRating] = useState<number | null>(initialAverage)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRatings() {
      if (!user?.id) {
        setAverageRating(initialAverage)
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/places/${placeId}/ratings?userId=${user.id}`)
        const data: RatingsResponse = await res.json()

        if (res.ok && data.success && data.data) {
          setUserRating(data.data.userRating)
          setAverageRating(data.data.averageRating)
        } else {
          setAverageRating(initialAverage)
        }
      } catch (error) {
        console.error('Error fetching place ratings:', error)
        setAverageRating(initialAverage)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRatings()
  }, [placeId, user?.id, initialAverage])

  const handleStarClick = async (selectedRating: number) => {
    if (isUpdating || !user?.id) {
      if (!user?.id) {
        alert('Please log in to rate places')
      }
      return
    }

    setIsUpdating(true)
    const previousUserRating = userRating
    setUserRating(selectedRating)
    setHoveredRating(null)

    try {
      const res = await fetch(`/api/places/${placeId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          rating: selectedRating,
        }),
      })

      const data: RatingsResponse = await res.json()

      if (!res.ok || !data.success || !data.data) {
        setUserRating(previousUserRating)
        console.error('Failed to update place rating:', data.error)
        alert(data.error || 'Failed to update rating. Please try again.')
      } else {
        setUserRating(data.data.userRating)
        setAverageRating(data.data.averageRating)
        onRated?.(data.data.averageRating, data.data.totalRatings)
        router.refresh()
      }
    } catch (err) {
      setUserRating(previousUserRating)
      console.error('Error updating place rating:', err)
      alert('An error occurred while updating the rating. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const displayRating = hoveredRating ?? userRating

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
    return user ? 'Click a star to rate this place' : 'Log in to rate this place'
  }

  const handleRatingInput = async (newValue: string) => {
    // Only allow update if valid number between 1-10
    const rating = parseFloat(newValue)
    if (isNaN(rating) || rating < 1 || rating > 10) return

    // Round to 1 decimal place
    const rounded = Math.round(rating * 10) / 10
    handleStarClick(rounded)
  }

  return (
    <div className="flex items-center gap-0.5" title={getTooltipText()}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starValue) => {
        const isStarFilled = displayRating !== null && starValue <= Math.round(displayRating)

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => handleStarClick(starValue)}
            onMouseEnter={() => !isUpdating && setHoveredRating(starValue)}
            onMouseLeave={() => setHoveredRating(null)}
            disabled={isUpdating || isLoading}
            className={`transition-all ${
              isUpdating || isLoading
                ? 'cursor-wait opacity-50'
                : user
                ? 'cursor-pointer hover:scale-125 active:scale-95'
                : 'cursor-not-allowed opacity-60'
            }`}
            aria-label={`Rate ${starValue} out of 10`}
          >
            <span
              className={`text-xl transition-all duration-200 ${
                isStarFilled ? '' : 'text-[var(--text-muted)] opacity-60'
              }`}
              style={isStarFilled ? { color: '#3B82F6' } : {}}
            >
              ★
            </span>
          </button>
        )
      })}
    </div>
  )
}


