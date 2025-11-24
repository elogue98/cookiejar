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

export default function StructuredEditPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id as string

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'ingredients' | 'instructions'>('details')

  // Form state
  const [title, setTitle] = useState('')
  const [ingredientList, setIngredientList] = useState<string[]>([])
  const [instructionList, setInstructionList] = useState<string[]>([])
  const [tags, setTags] = useState('')
  const [rating, setRating] = useState<string>('')
  const [sourceUrl, setSourceUrl] = useState('')
  
  // Metadata
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState<string>('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [totalTime, setTotalTime] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [mealType, setMealType] = useState('')

  // Fetch recipe
  useEffect(() => {
    async function fetchRecipe() {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', id)
          .single()

        if (error || !data) throw new Error('Recipe not found')

        setRecipe(data)
        setTitle(data.title || '')
        
        // Ingredients parsing
        if (data.ingredients && Array.isArray(data.ingredients)) {
          const list: string[] = []
          // Flatten potential structured ingredients
          data.ingredients.forEach((item: any) => {
            if (typeof item === 'string') list.push(item)
            else if (typeof item === 'object') {
               if (item.section) list.push(`SECTION: ${item.section}`)
               if (item.items) list.push(...item.items)
            }
          })
          setIngredientList(list)
        }

        // Instructions parsing
        if (data.instructions) {
           // Simple split by newline for now, handling the JSON case via basic check
           let text = data.instructions
           try {
             if (text.startsWith('[') || text.startsWith('{')) {
                const parsed = JSON.parse(text)
                if (Array.isArray(parsed)) {
                   const steps: string[] = []
                   parsed.forEach((group: any) => {
                      if (group.section) steps.push(`SECTION: ${group.section}`)
                      if (group.steps) steps.push(...group.steps)
                   })
                   setInstructionList(steps)
                }
             } else {
                setInstructionList(text.split('\n').filter(t => t.trim()))
             }
           } catch {
              setInstructionList(text.split('\n').filter(t => t.trim()))
           }
        }

        setTags(data.tags?.join(', ') || '')
        setRating(data.rating?.toString() || '')
        setSourceUrl(data.source_url || '')

        // Metadata
        if (data.notes) {
          try {
            const parsed = JSON.parse(data.notes)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              setDescription(parsed.description || '')
              setServings(parsed.servings?.toString() || '')
              setPrepTime(parsed.prepTime || '')
              setCookTime(parsed.cookTime || '')
              setTotalTime(parsed.totalTime || '')
              setCuisine(parsed.cuisine || '')
              setMealType(parsed.mealType || '')
            }
          } catch (e) {
             // Ignore
          }
        }
        
        setLoading(false)
      } catch (err) {
        setLoading(false)
      }
    }

    if (id) fetchRecipe()
  }, [id])

  // List handlers
  const updateItem = (listSetter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    listSetter(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const addItem = (listSetter: React.Dispatch<React.SetStateAction<string[]>>) => {
    listSetter(prev => [...prev, ''])
  }

  const removeItem = (listSetter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    listSetter(prev => prev.filter((_, i) => i !== index))
  }

  const moveItem = (listSetter: React.Dispatch<React.SetStateAction<string[]>>, index: number, direction: 'up' | 'down') => {
    listSetter(prev => {
      if (direction === 'up' && index === 0) return prev
      if (direction === 'down' && index === prev.length - 1) return prev
      const next = [...prev]
      const swapIndex = direction === 'up' ? index - 1 : index + 1
      const temp = next[swapIndex]
      next[swapIndex] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    const metadata: RecipeMetadata = {}
    if (description) metadata.description = description
    if (servings) metadata.servings = parseInt(servings)
    if (prepTime) metadata.prepTime = prepTime
    if (cookTime) metadata.cookTime = cookTime
    if (totalTime) metadata.totalTime = totalTime
    if (cuisine) metadata.cuisine = cuisine
    if (mealType) metadata.mealType = mealType

    const notesToSave = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null

    // Convert lists back to strings/arrays for API
    const ingredients = ingredientList.filter(i => i.trim()) // API expects array or string, we'll send array if possible or just let the API handle it. Wait, API handles string[] or string.
    // Actually the API expects `ingredients` as string (newline separated) OR structured array.
    // Let's send string joined by newline for compatibility with existing logic which parses it?
    // Wait, existing logic in edit page sets ingredients as string.
    // Let's mimic the default edit page: convert list to newline separated string
    const ingredientsStr = ingredients.join('\n')
    const instructionsStr = instructionList.filter(i => i.trim()).join('\n\n')

    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          ingredients: ingredientsStr,
          instructions: instructionsStr,
          tags,
          rating: rating || null,
          notes: notesToSave,
          source_url: sourceUrl || null,
          user_id: user?.id || null,
        }),
      })

      if (!res.ok) throw new Error('Failed')
      router.push(`/recipes/${id}`)
    } catch (err) {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <Navigation />
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Link href={`/recipes/${id}`} className="text-slate-500 hover:text-slate-900">
              ← Cancel
            </Link>
            <div className="h-6 w-px bg-slate-200"></div>
            <span className="font-semibold text-slate-700">Structured Editor</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          
          {/* Sidebar Navigation */}
          <div className="col-span-3">
            <nav className="space-y-1 sticky top-24">
              <button 
                onClick={() => setActiveTab('details')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'details' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                1. Recipe Details
              </button>
              <button 
                onClick={() => setActiveTab('ingredients')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'ingredients' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                2. Ingredients
              </button>
              <button 
                onClick={() => setActiveTab('instructions')}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'instructions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                3. Instructions
              </button>
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="col-span-9 space-y-6">
            
            {/* Tab: Details */}
            {activeTab === 'details' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold mb-6">Basic Info</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold mb-6">Metadata</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prep Time</label>
                      <input
                        type="text"
                        value={prepTime}
                        onChange={(e) => setPrepTime(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        placeholder="15m"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cook Time</label>
                      <input
                        type="text"
                        value={cookTime}
                        onChange={(e) => setCookTime(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        placeholder="30m"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Servings</label>
                      <input
                        type="number"
                        value={servings}
                        onChange={(e) => setServings(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        placeholder="4"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Rating</label>
                      <input
                        type="number"
                        value={rating}
                        onChange={(e) => setRating(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        min="1" max="10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Ingredients */}
            {activeTab === 'ingredients' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Ingredients</h2>
                  <button 
                    onClick={() => addItem(setIngredientList)}
                    className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium hover:bg-blue-100"
                  >
                    + Add Item
                  </button>
                </div>
                
                <div className="space-y-3">
                  {ingredientList.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 group">
                      <div className="flex flex-col gap-1 text-slate-300">
                        <button onClick={() => moveItem(setIngredientList, idx, 'up')} className="hover:text-blue-500">▲</button>
                        <button onClick={() => moveItem(setIngredientList, idx, 'down')} className="hover:text-blue-500">▼</button>
                      </div>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateItem(setIngredientList, idx, e.target.value)}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={item.startsWith('SECTION:') ? 'Section Name...' : 'Ingredient...'}
                      />
                      <button 
                        onClick={() => removeItem(setIngredientList, idx)}
                        className="text-slate-300 hover:text-red-500 p-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {ingredientList.length === 0 && (
                    <p className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-100 rounded-lg">
                      No ingredients yet. Click "Add Item" to start.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Instructions */}
            {activeTab === 'instructions' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                 <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Instructions</h2>
                  <button 
                    onClick={() => addItem(setInstructionList)}
                    className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium hover:bg-blue-100"
                  >
                    + Add Step
                  </button>
                </div>

                <div className="space-y-4">
                  {instructionList.map((item, idx) => (
                    <div key={idx} className="flex gap-3 group">
                      <div className="flex flex-col gap-1 text-slate-300 mt-2">
                        <button onClick={() => moveItem(setInstructionList, idx, 'up')} className="hover:text-blue-500">▲</button>
                        <button onClick={() => moveItem(setInstructionList, idx, 'down')} className="hover:text-blue-500">▼</button>
                      </div>
                      <div className="flex-1">
                         <span className="text-xs font-semibold text-slate-400 mb-1 block">Step {idx + 1}</span>
                         <textarea
                          value={item}
                          onChange={(e) => updateItem(setInstructionList, idx, e.target.value)}
                          rows={2}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Describe this step..."
                        />
                      </div>
                      <button 
                        onClick={() => removeItem(setInstructionList, idx)}
                        className="text-slate-300 hover:text-red-500 p-2 mt-6"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                   {instructionList.length === 0 && (
                    <p className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-100 rounded-lg">
                      No instructions yet. Click "Add Step" to start.
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}

