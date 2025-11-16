'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import Logo from '@/app/components/Logo'

interface Recipe {
  id: string
  title: string
  ingredients: string[] | null
  instructions: string | null
  tags: string[] | null
  rating: number | null
  notes: string | null
  created_at: string | null
  source_url: string | null
  cookbookSource: string | null
}

export default function EditRecipePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')
  const [rating, setRating] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  // Fetch recipe on mount
  useEffect(() => {
    async function fetchRecipe() {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', id)
          .single()

        if (error) {
          setFetchError(error.message)
          setLoading(false)
          return
        }

        if (!data) {
          setFetchError('Recipe not found')
          setLoading(false)
          return
        }

        setRecipe(data)
        
        // Pre-fill form
        setTitle(data.title || '')
        setIngredients(data.ingredients?.join('\n') || '')
        setInstructions(data.instructions || '')
        setTags(data.tags?.join(', ') || '')
        setRating(data.rating?.toString() || '')
        setNotes(data.notes || '')
        setSourceUrl(data.source_url || '')
        
        setLoading(false)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load recipe')
        setLoading(false)
      }
    }

    if (id) {
      fetchRecipe()
    }
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          ingredients,
          instructions,
          tags,
          rating: rating || null,
          notes,
          source_url: sourceUrl || null,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to update recipe')
        setSaving(false)
        return
      }

      // Success - redirect to recipe detail page
      router.push(`/recipes/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <header className="border-b" style={{ borderColor: 'rgba(211, 78, 78, 0.1)', background: '#F9E7B2' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Link href="/" className="flex items-center gap-3 text-3xl font-bold transition-colors" style={{ color: 'var(--text-main)' }}>
              <Logo size={48} />
              <span>Cookie Jar</span>
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p style={{ color: 'var(--text-main)' }}>Loading recipe...</p>
        </main>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <header className="border-b" style={{ borderColor: 'rgba(211, 78, 78, 0.1)', background: '#F9E7B2' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Link href="/" className="flex items-center gap-3 text-3xl font-bold transition-colors" style={{ color: 'var(--text-main)' }}>
              <Logo size={48} />
              <span>Cookie Jar</span>
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-lg border border-red-600 bg-red-50 p-4">
            <p className="text-red-700 font-semibold mb-2">Error</p>
            <p className="text-red-600 text-sm">{fetchError}</p>
            <Link
              href="/"
              className="mt-4 inline-block px-4 py-2 font-medium transition-colors hover:opacity-90"
              style={{
                background: '#D34E4E',
                color: 'white',
                borderRadius: '14px'
              }}
            >
              Back to Recipes
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E2B59A] text-[#6B563F]">
      <header className="border-b border-[#B77466]/30 bg-[#E2B59A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-3xl font-bold transition-colors" style={{ color: 'var(--text-main)' }}>
              <Logo size={48} />
              <span>Cookie Jar</span>
            </Link>
            <Link
              href={`/recipes/${id}`}
              className="px-4 py-2 bg-[#B77466] hover:bg-[#A86558] text-[#FFE1AF] font-medium rounded-lg transition-colors border border-[#B77466]/50"
            >
              ← Back to Recipe
            </Link>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="max-w-2xl">
          <h2 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text-main)' }}>
            Edit Recipe
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="title" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Recipe title"
                disabled={saving}
                required
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            <div>
              <label 
                htmlFor="ingredients" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Ingredients (one per line)
              </label>
              <textarea
                id="ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="2 cups flour&#10;1 cup sugar&#10;..."
                disabled={saving}
                rows={8}
                className="w-full px-4 py-3 bg-white border border-[#B77466]/50 rounded-lg text-[#6B563F] placeholder-[#6B563F]/60 focus:outline-none focus:ring-2 focus:ring-[#B77466] focus:border-[#B77466] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />
            </div>

            <div>
              <label 
                htmlFor="instructions" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Instructions
              </label>
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Step 1: Mix ingredients...&#10;Step 2: Bake at 350°F..."
                disabled={saving}
                rows={8}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            <div>
              <label 
                htmlFor="tags" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="dessert, cookies, chocolate"
                disabled={saving}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            <div>
              <label 
                htmlFor="rating" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Rating (1-10)
              </label>
              <input
                type="number"
                id="rating"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="8"
                min="1"
                max="10"
                disabled={saving}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            <div>
              <label 
                htmlFor="notes" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or tips..."
                disabled={saving}
                rows={4}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            <div>
              <label 
                htmlFor="sourceUrl" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Source URL
              </label>
              <input
                type="url"
                id="sourceUrl"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/recipe"
                disabled={saving}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
              <p className="mt-2 text-xs" style={{ color: 'rgba(43, 43, 43, 0.6)' }}>
                Original URL where this recipe was imported from
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-600 bg-red-50 p-4">
                <p className="text-red-700 font-semibold mb-2">Update Failed</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#D34E4E',
                  color: 'white',
                  borderRadius: '14px'
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              
              <Link
                href={`/recipes/${id}`}
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

