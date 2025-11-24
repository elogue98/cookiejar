'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/lib/userContext'
import Navigation from '@/app/components/Navigation'

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

type NutritionMetadata = {
  calories?: number
  protein?: number
  fat?: number
  carbs?: number
}

type RecipeMetadata = {
  description?: string
  servings?: number
  prepTime?: string
  cookTime?: string
  totalTime?: string
  cuisine?: string
  mealType?: string
  nutrition?: NutritionMetadata
}

export default function EditRecipePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
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
  
  // Metadata state (parsed from notes JSON)
  const [hasMetadata, setHasMetadata] = useState(false)
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState<string>('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [totalTime, setTotalTime] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [mealType, setMealType] = useState('')
  const [calories, setCalories] = useState<string>('')
  const [protein, setProtein] = useState<string>('')
  const [fat, setFat] = useState<string>('')
  const [carbs, setCarbs] = useState<string>('')

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
        
        // Handle ingredients - check if structured format
        if (data.ingredients && Array.isArray(data.ingredients)) {
          if (data.ingredients.length > 0 && typeof data.ingredients[0] === 'object' && data.ingredients[0] !== null && 'section' in data.ingredients[0]) {
            // Structured format - convert to text with sections
            const parts: string[] = []
            data.ingredients.forEach((group: { section?: string; items?: string[] }) => {
              if (group.section && group.section.trim()) {
                parts.push(group.section.trim())
              }
              if (group.items && Array.isArray(group.items)) {
                group.items.forEach((item: string) => {
                  if (item && item.trim()) {
                    parts.push(item.trim())
                  }
                })
              }
            })
            setIngredients(parts.join('\n'))
          } else {
            // Legacy format - array of strings
            setIngredients(data.ingredients.join('\n'))
          }
        } else {
          setIngredients('')
        }
        
        setInstructions(data.instructions || '')
        setTags(data.tags?.join(', ') || '')
        setRating(data.rating?.toString() || '')
        setSourceUrl(data.source_url || '')
        
        // Parse notes - check if it's JSON metadata
        if (data.notes) {
          try {
            const parsed = JSON.parse(data.notes)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              // It's metadata JSON
              setHasMetadata(true)
              setDescription(parsed.description || '')
              setServings(parsed.servings?.toString() || '')
              setPrepTime(parsed.prepTime || '')
              setCookTime(parsed.cookTime || '')
              setTotalTime(parsed.totalTime || '')
              setCuisine(parsed.cuisine || '')
              setMealType(parsed.mealType || '')
              setCalories(parsed.nutrition?.calories?.toString() || '')
              setProtein(parsed.nutrition?.protein?.toString() || '')
              setFat(parsed.nutrition?.fat?.toString() || '')
              setCarbs(parsed.nutrition?.carbs?.toString() || '')
              setNotes('') // Clear notes since we're using structured fields
            } else {
              // Not metadata, use as plain text
              setHasMetadata(false)
              setNotes(data.notes)
            }
          } catch (e) {
            // Not JSON, use as plain text
            setHasMetadata(false)
            setNotes(data.notes)
          }
        } else {
          setHasMetadata(false)
          setNotes('')
        }
        
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

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    // Build notes - either JSON metadata or plain text
    let notesToSave: string | null = null
    if (hasMetadata) {
      // Build metadata object
      const metadata: RecipeMetadata = {}
      if (description.trim()) metadata.description = description.trim()
      if (servings.trim()) metadata.servings = parseInt(servings, 10)
      if (prepTime.trim()) metadata.prepTime = prepTime.trim()
      if (cookTime.trim()) metadata.cookTime = cookTime.trim()
      if (totalTime.trim()) metadata.totalTime = totalTime.trim()
      if (cuisine.trim()) metadata.cuisine = cuisine.trim()
      if (mealType.trim()) metadata.mealType = mealType.trim()
      
      const nutrition: NutritionMetadata = {}
      if (calories.trim()) nutrition.calories = parseInt(calories, 10)
      if (protein.trim()) nutrition.protein = parseFloat(protein)
      if (fat.trim()) nutrition.fat = parseFloat(fat)
      if (carbs.trim()) nutrition.carbs = parseFloat(carbs)
      
      if (Object.keys(nutrition).length > 0) {
        metadata.nutrition = nutrition
      }
      
      if (Object.keys(metadata).length > 0) {
        notesToSave = JSON.stringify(metadata)
      }
    } else {
      notesToSave = notes.trim() || null
    }

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
          notes: notesToSave,
          source_url: sourceUrl || null,
          user_id: user?.id || null, // Pass user_id for version tracking
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p style={{ color: 'var(--text-main)' }}>Loading recipe...</p>
        </main>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <Navigation />
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
    <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <Navigation />
      <div className="border-b" style={{ borderColor: 'rgba(211, 78, 78, 0.1)', background: '#F9E7B2' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="px-4 py-2 font-medium transition-colors hover:opacity-90"
              style={{
                background: '#DDC57A',
                color: '#2B2B2B',
                borderRadius: '14px'
              }}
            >
              ← Back to Recipe
            </Link>
          </div>
        </div>
      </div>
      
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

            {/* Metadata Section */}
            <div className="space-y-6 p-5 rounded-lg border" style={{
              backgroundColor: 'var(--accent-light)',
              borderColor: 'rgba(211, 78, 78, 0.2)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <label className="block text-sm font-semibold mb-4" style={{ color: 'var(--text-main)' }}>
                Recipe Metadata
              </label>

              {hasMetadata ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of the recipe..."
                      disabled={saving}
                      rows={3}
                      className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: 'rgba(211, 78, 78, 0.2)',
                        color: 'var(--text-main)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="servings" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                        Servings
                      </label>
                      <input
                        type="number"
                        id="servings"
                        value={servings}
                        onChange={(e) => setServings(e.target.value)}
                        placeholder="4"
                        min="1"
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
                      <label htmlFor="mealType" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                        Meal Type
                      </label>
                      <select
                        id="mealType"
                        value={mealType}
                        onChange={(e) => setMealType(e.target.value)}
                        disabled={saving}
                        className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          borderColor: 'rgba(211, 78, 78, 0.2)',
                          color: 'var(--text-main)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        <option value="">Select meal type...</option>
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="snack">Snack</option>
                        <option value="dessert">Dessert</option>
                        <option value="drink">Drink</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="prepTime" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                        Prep Time
                      </label>
                      <input
                        type="text"
                        id="prepTime"
                        value={prepTime}
                        onChange={(e) => setPrepTime(e.target.value)}
                        placeholder="10 minutes"
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
                      <label htmlFor="cookTime" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                        Cook Time
                      </label>
                      <input
                        type="text"
                        id="cookTime"
                        value={cookTime}
                        onChange={(e) => setCookTime(e.target.value)}
                        placeholder="20 minutes"
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
                      <label htmlFor="totalTime" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                        Total Time
                      </label>
                      <input
                        type="text"
                        id="totalTime"
                        value={totalTime}
                        onChange={(e) => setTotalTime(e.target.value)}
                        placeholder="30 minutes"
                        disabled={saving}
                        className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          borderColor: 'rgba(211, 78, 78, 0.2)',
                          color: 'var(--text-main)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cuisine" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                      Cuisine
                    </label>
                    <input
                      type="text"
                      id="cuisine"
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                      placeholder="Italian, British, etc."
                      disabled={saving}
                      className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: 'rgba(211, 78, 78, 0.2)',
                        color: 'var(--text-main)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    />
                  </div>

                  <div className="border-t pt-4" style={{ borderColor: 'rgba(211, 78, 78, 0.2)' }}>
                    <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
                      Nutrition (per serving)
                    </label>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="calories" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-main)' }}>
                          Calories
                        </label>
                        <input
                          type="number"
                          id="calories"
                          value={calories}
                          onChange={(e) => setCalories(e.target.value)}
                          placeholder="250"
                          min="0"
                          disabled={saving}
                          className="w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          style={{
                            borderColor: 'rgba(211, 78, 78, 0.2)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor="protein" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-main)' }}>
                          Protein (g)
                        </label>
                        <input
                          type="number"
                          id="protein"
                          value={protein}
                          onChange={(e) => setProtein(e.target.value)}
                          placeholder="10"
                          min="0"
                          step="0.1"
                          disabled={saving}
                          className="w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          style={{
                            borderColor: 'rgba(211, 78, 78, 0.2)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor="fat" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-main)' }}>
                          Fat (g)
                        </label>
                        <input
                          type="number"
                          id="fat"
                          value={fat}
                          onChange={(e) => setFat(e.target.value)}
                          placeholder="8"
                          min="0"
                          step="0.1"
                          disabled={saving}
                          className="w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          style={{
                            borderColor: 'rgba(211, 78, 78, 0.2)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor="carbs" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-main)' }}>
                          Carbs (g)
                        </label>
                        <input
                          type="number"
                          id="carbs"
                          value={carbs}
                          onChange={(e) => setCarbs(e.target.value)}
                          placeholder="35"
                          min="0"
                          step="0.1"
                          disabled={saving}
                          className="w-full px-3 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          style={{
                            borderColor: 'rgba(211, 78, 78, 0.2)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-main)' }}>
                    Notes (Plain Text)
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
              )}
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

