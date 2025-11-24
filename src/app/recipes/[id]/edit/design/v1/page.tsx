'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function MinimalistEditPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id as string

  // Auto-resize textarea ref
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')
  const [rating, setRating] = useState<string>('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [showMetadata, setShowMetadata] = useState(false)
  
  // Metadata state
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState<string>('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [totalTime, setTotalTime] = useState('')

  // Fetch recipe
  useEffect(() => {
    async function fetchRecipe() {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        if (!data) throw new Error('Recipe not found')

        setRecipe(data)
        setTitle(data.title || '')
        
        // Ingredients
        if (data.ingredients && Array.isArray(data.ingredients)) {
          if (data.ingredients.length > 0 && typeof data.ingredients[0] === 'object' && data.ingredients[0] !== null && 'section' in data.ingredients[0]) {
            const parts: string[] = []
            data.ingredients.forEach((group: { section?: string; items?: string[] }) => {
              if (group.section?.trim()) parts.push(group.section.trim())
              group.items?.forEach((item: string) => {
                if (item?.trim()) parts.push(item.trim())
              })
            })
            setIngredients(parts.join('\n'))
          } else {
            setIngredients(data.ingredients.join('\n'))
          }
        } else {
          setIngredients('')
        }
        
        // Instructions
        if (data.instructions) {
          try {
            if (data.instructions.trim().startsWith('[') || data.instructions.trim().startsWith('{')) {
              const parsed = JSON.parse(data.instructions)
              if (Array.isArray(parsed)) {
                const parts: string[] = []
                parsed.forEach((group: any) => {
                  if (group.section) parts.push(group.section)
                  group.steps?.forEach((step: string, idx: number) => {
                    parts.push(`${idx + 1}. ${step}`)
                  })
                })
                setInstructions(parts.length > 0 ? parts.join('\n\n') : data.instructions)
              } else {
                setInstructions(data.instructions)
              }
            } else {
              setInstructions(data.instructions)
            }
          } catch (e) {
            setInstructions(data.instructions)
          }
        } else {
          setInstructions('')
        }

        setTags(data.tags?.join(', ') || '')
        setRating(data.rating?.toString() || '')
        setSourceUrl(data.source_url || '')

        // Parse metadata
        if (data.notes) {
          try {
            const parsed = JSON.parse(data.notes)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              setDescription(parsed.description || '')
              setServings(parsed.servings?.toString() || '')
              setPrepTime(parsed.prepTime || '')
              setCookTime(parsed.cookTime || '')
              setTotalTime(parsed.totalTime || '')
            }
          } catch (e) {
            // Ignore plain notes in this view for simplicity
          }
        }
        
        setLoading(false)
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }

    if (id) fetchRecipe()
  }, [id])

  // Track changes
  useEffect(() => {
    if (!loading) setHasChanges(true)
  }, [title, ingredients, instructions, tags, rating, description, servings, prepTime, cookTime])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    // Construct metadata
    const metadata: RecipeMetadata = {}
    if (description.trim()) metadata.description = description.trim()
    if (servings.trim()) metadata.servings = parseInt(servings, 10)
    if (prepTime.trim()) metadata.prepTime = prepTime.trim()
    if (cookTime.trim()) metadata.cookTime = cookTime.trim()
    if (totalTime.trim()) metadata.totalTime = totalTime.trim()

    const notesToSave = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null

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
          user_id: user?.id || null,
        }),
      })

      if (!res.ok) throw new Error('Failed to save')
      
      setHasChanges(false)
      setSaving(false)
      router.push(`/recipes/${id}`)
    } catch (err) {
      setError('Failed to save changes')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2B2B2B]">
      <Navigation />
      
      {/* Floating Action Bar */}
      <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${hasChanges ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
        <div className="bg-white shadow-lg rounded-full px-6 py-3 flex items-center gap-4 border border-stone-200">
          <span className="text-sm text-stone-500">Unsaved changes</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-stone-900 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-8 py-16">
        <div className="space-y-12">
          {/* Header / Title */}
          <div>
            <Link href={`/recipes/${id}`} className="text-sm text-stone-400 hover:text-stone-600 mb-4 block">
              ← Back to Recipe
            </Link>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-4xl font-serif bg-transparent border-none focus:ring-0 p-0 placeholder-stone-300"
              placeholder="Recipe Title"
            />
            <div className="mt-4 flex gap-4 text-sm text-stone-500">
              <div className="flex items-center gap-2">
                <span>Rating:</span>
                <input
                  type="number"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-12 bg-transparent border-b border-stone-200 focus:border-stone-400 focus:ring-0 p-0 text-center"
                  placeholder="-"
                  min="0" max="10"
                />
                <span>/ 10</span>
              </div>
              <button 
                onClick={() => setShowMetadata(!showMetadata)}
                className="hover:text-stone-800 underline decoration-dotted"
              >
                {showMetadata ? 'Hide Details' : 'Edit Details'}
              </button>
            </div>
          </div>

          {/* Collapsible Metadata */}
          {showMetadata && (
            <div className="grid grid-cols-2 gap-8 p-6 bg-white rounded-xl border border-stone-100 shadow-sm">
               <div className="col-span-2">
                <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent border-b border-stone-200 focus:border-stone-400 focus:ring-0 p-1 resize-none"
                  placeholder="Add a brief description..."
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Prep Time</label>
                <input
                  type="text"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="w-full bg-transparent border-b border-stone-200 focus:border-stone-400 focus:ring-0 p-1"
                  placeholder="e.g. 15m"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Cook Time</label>
                <input
                  type="text"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  className="w-full bg-transparent border-b border-stone-200 focus:border-stone-400 focus:ring-0 p-1"
                  placeholder="e.g. 45m"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Servings</label>
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="w-full bg-transparent border-b border-stone-200 focus:border-stone-400 focus:ring-0 p-1"
                  placeholder="4"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-400 mb-1">Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-transparent border-b border-stone-200 focus:border-stone-400 focus:ring-0 p-1"
                  placeholder="dinner, healthy..."
                />
              </div>
            </div>
          )}

          {/* Ingredients */}
          <div className="relative group">
            <h3 className="text-lg font-serif mb-4 text-stone-800">Ingredients</h3>
            <div className="relative">
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                rows={10}
                className="w-full bg-white rounded-xl p-6 border border-transparent hover:border-stone-200 focus:border-stone-300 focus:ring-0 transition-all leading-relaxed resize-none shadow-sm"
                placeholder="List ingredients here..."
                style={{ minHeight: '300px' }}
              />
              <div className="absolute top-4 right-4 text-xs text-stone-300 pointer-events-none">
                Simple List
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="relative group">
            <h3 className="text-lg font-serif mb-4 text-stone-800">Instructions</h3>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={15}
              className="w-full bg-white rounded-xl p-6 border border-transparent hover:border-stone-200 focus:border-stone-300 focus:ring-0 transition-all leading-relaxed resize-none shadow-sm"
              placeholder="Write instructions here..."
              style={{ minHeight: '400px' }}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

