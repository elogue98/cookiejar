'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '../components/Logo'

export default function AddRecipePage() {
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Parse ingredients from textarea (one per line)
      const ingredientsArray = ingredients
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      // Parse rating
      const ratingNumber = rating.trim() ? parseFloat(rating) : null
      if (ratingNumber !== null && (isNaN(ratingNumber) || ratingNumber < 1 || ratingNumber > 10)) {
        setError('Rating must be a number between 1 and 10')
        setLoading(false)
        return
      }

      const res = await fetch('/api/recipes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          ingredients: ingredientsArray,
          instructions: instructions.trim() || undefined,
          tags: tags.trim() || undefined,
          rating: ratingNumber,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create recipe')
        setLoading(false)
        return
      }

      // Success - show message briefly then redirect
      setSuccess(true)
      setLoading(false)

      // Redirect to recipe detail page
      setTimeout(() => {
        router.push(`/recipes/${data.data.id}`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <header className="border-b" style={{ borderColor: 'rgba(211, 78, 78, 0.1)', background: '#F9E7B2' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-3xl font-bold transition-colors" style={{ color: 'var(--text-main)' }}>
              <Logo size={48} />
              <span>Cookie Jar</span>
            </Link>
            <Link
              href="/"
              className="transition-colors"
              style={{ color: 'var(--accent-clay)' }}
            >
              ← Back to Recipes
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section>
          <h2 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text-main)' }}>
            Add New Recipe
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-main)' }}
              >
                Title <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
                placeholder="e.g., Chicken Parmesan"
              />
            </div>

            {/* Ingredients */}
            <div>
              <label
                htmlFor="ingredients"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-main)' }}
              >
                Ingredients
              </label>
              <textarea
                id="ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                disabled={loading}
                rows={6}
                className="w-full px-4 py-3 bg-white border border-[#B77466]/50 rounded-lg text-[#6B563F] placeholder-[#6B563F]/60 focus:outline-none focus:ring-2 focus:ring-[#B77466] focus:border-[#B77466] disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                placeholder="Enter one ingredient per line&#10;e.g.,&#10;2 chicken breasts&#10;1 cup flour&#10;1/2 cup parmesan cheese"
              />
              <p className="mt-1 text-xs" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
                Enter one ingredient per line. AI will automatically generate tags based on your ingredients.
              </p>
            </div>

            {/* Instructions */}
            <div>
              <label
                htmlFor="instructions"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-main)' }}
              >
                Instructions
              </label>
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={loading}
                rows={8}
                className="w-full px-4 py-3 bg-white border border-[#B77466]/50 rounded-lg text-[#6B563F] placeholder-[#6B563F]/60 focus:outline-none focus:ring-2 focus:ring-[#B77466] focus:border-[#B77466] disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                placeholder="Enter step-by-step instructions..."
              />
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="tags"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-main)' }}
              >
                Tags (optional)
              </label>
              <input
                type="text"
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
                placeholder="e.g., italian, pasta, comfort-food (comma-separated)"
              />
              <p className="mt-1 text-xs" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
                Enter tags separated by commas. AI will also generate additional tags automatically.
              </p>
            </div>

            {/* Rating */}
            <div>
              <label
                htmlFor="rating"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-main)' }}
              >
                Rating (optional)
              </label>
              <input
                type="number"
                id="rating"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                disabled={loading}
                min="1"
                max="10"
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
                placeholder="1-10"
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-main)' }}
              >
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={4}
                className="w-full px-4 py-3 bg-white border border-[#B77466]/50 rounded-lg text-[#6B563F] placeholder-[#6B563F]/60 focus:outline-none focus:ring-2 focus:ring-[#B77466] focus:border-[#B77466] disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                placeholder="Any additional notes or modifications..."
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-600 bg-red-50 p-4">
                <p className="text-red-700 font-semibold mb-2">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-600 bg-green-50 p-4">
                <p className="text-green-700 font-semibold mb-2">Success!</p>
                <p className="text-green-600 text-sm">
                  Recipe created successfully. Redirecting...
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={loading || success}
                className="px-8 py-3 font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#D34E4E',
                  color: 'white',
                  borderRadius: '14px'
                }}
              >
                {loading ? 'Creating Recipe...' : 'Create Recipe'}
              </button>

              <Link
                href="/"
                className="px-8 py-3 font-medium transition-colors hover:opacity-90"
                style={{
                  background: '#DDC57A',
                  color: '#2B2B2B',
                  borderRadius: '14px'
                }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

