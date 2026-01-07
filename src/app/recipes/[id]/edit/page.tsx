'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useUser } from '@/lib/userContext'
import Navigation from '@/app/components/Navigation'
import type { IngredientGroup, InstructionGroup } from '@/types/recipe'

export default function StructuredEditPage() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const pathname = usePathname()
  const { user } = useUser()

  // Prefer params, but fall back to path parsing in case params is undefined
  const id = useMemo(() => {
    const paramId = params?.id
    if (paramId && paramId !== 'undefined') return paramId
    if (pathname) {
      const parts = pathname.split('/').filter(Boolean)
      // /recipes/[id]/edit -> ['recipes', '{id}', 'edit']
      if (parts.length >= 3 && parts[0] === 'recipes') {
        return parts[1]
      }
    }
    return ''
  }, [params?.id, pathname])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'ingredients' | 'instructions'>('details')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [ingredientList, setIngredientList] = useState<string[]>([])
  const [instructionList, setInstructionList] = useState<string[]>([])
  const [tags, setTags] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  
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
    let isCancelled = false

    async function fetchRecipe() {
      // If no id, surface an error so we don't stay stuck on loading
      if (!id) {
        setError('Missing recipe id')
        setLoading(false)
        return
      }

      try {
        console.log('edit page: fetching recipe', id)
        const res = await fetch(`/api/recipes/${id}`, { cache: 'no-store' })
        const payload = await res.json()
        console.log('edit page: fetch response', { id, status: res.status, payload })

        if (!res.ok || !payload?.data) {
          const message =
            payload?.error ||
            payload?.details?.message ||
            `Request failed (${res.status})`
          if (!isCancelled) {
            setError(message)
          }
          console.error('Recipe fetch failed', { id, status: res.status, payload })
          return
        }

        const data = payload.data

        if (isCancelled) return

        setTitle(data.title || '')
        setImageUrl(data.image_url || '')
        setError(null)

        // Ingredients parsing
        if (data.ingredients && Array.isArray(data.ingredients)) {
          const list: string[] = []
          data.ingredients.forEach((item: string | IngredientGroup) => {
            if (typeof item === 'string') {
              list.push(item)
            } else if (item && typeof item === 'object' && 'items' in item) {
              const group = item as IngredientGroup
              if (group.section) list.push(`SECTION: ${group.section}`)
              if (Array.isArray(group.items)) list.push(...group.items)
            }
          })
          setIngredientList(list)
        }

        // Instructions parsing
        if (data.instructions) {
          if (Array.isArray(data.instructions)) {
            const steps: string[] = []
            data.instructions.forEach((group: InstructionGroup | string) => {
              if (typeof group === 'string') {
                steps.push(group)
                return
              }
              const typedGroup = group as InstructionGroup
              if (typedGroup.section) steps.push(`SECTION: ${typedGroup.section}`)
              if (Array.isArray(typedGroup.steps)) steps.push(...typedGroup.steps)
            })
            setInstructionList(steps)
          } else {
            const text = data.instructions
            if (typeof text === 'string') {
              try {
                if (text.startsWith('[') || text.startsWith('{')) {
                  const parsed = JSON.parse(text)
                  if (Array.isArray(parsed)) {
                    const steps: string[] = []
                    parsed.forEach((group) => {
                      if (group && typeof group === 'object' && 'steps' in group) {
                        const typed = group as InstructionGroup
                        if (typed.section) steps.push(`SECTION: ${typed.section}`)
                        if (Array.isArray(typed.steps)) steps.push(...typed.steps)
                      }
                    })
                    setInstructionList(steps)
                    return
                  }
                }
                setInstructionList(text.split('\n').filter((line: string) => line.trim()))
              } catch {
                setInstructionList(text.split('\n').filter((line: string) => line.trim()))
              }
            }
          }
        }

        const tagValue =
          Array.isArray(data.tags) ? data.tags.join(', ') : typeof data.tags === 'string' ? data.tags : ''

        setTags(tagValue)
        setSourceUrl(data.source_url || '')

        // Metadata - read from proper database columns first
        setDescription(data.notes || '')
        setServings(data.servings?.toString() || '')
        setPrepTime(data.prep_time || '')
        setCookTime(data.cook_time || '')
        setTotalTime(data.total_time || '')
        setCuisine(data.cuisine || '')
        setMealType(data.meal_type || '')
        
        // Fallback: try parsing old JSON format from notes if new fields are empty
        if (!data.servings && !data.prep_time && !data.cook_time && data.notes) {
          try {
            const parsed = JSON.parse(data.notes)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              if (parsed.description) setDescription(parsed.description)
              if (parsed.servings) setServings(parsed.servings?.toString())
              if (parsed.prepTime) setPrepTime(parsed.prepTime)
              if (parsed.cookTime) setCookTime(parsed.cookTime)
              if (parsed.totalTime) setTotalTime(parsed.totalTime)
              if (parsed.cuisine) setCuisine(parsed.cuisine)
              if (parsed.mealType) setMealType(parsed.mealType)
            }
          } catch {
             // Ignore - not JSON
          }
        }
      } catch (err) {
        console.error('Error loading recipe:', err)
        if (!isCancelled) {
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Unable to load recipe. Please try again.'
          )
        }
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    fetchRecipe()
    return () => {
      isCancelled = true
    }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    const file = e.target.files[0]
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/recipes/${id}/image`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload image')
      }

      setImageUrl(data.imageUrl)
      setUploading(false)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image. Please try again.')
      setUploading(false)
    }
  }

  const parseSectionLabel = (text: string): string | null => {
    const trimmed = text.trim()
    if (!trimmed) return null

    const sectionPrefixMatch = trimmed.match(/^section\s*:\s*(.+)$/i)
    if (sectionPrefixMatch) {
      return sectionPrefixMatch[1].trim()
    }

    const withoutTrailingColon = trimmed.endsWith(':')
      ? trimmed.slice(0, -1).trim()
      : trimmed

    if (!withoutTrailingColon) return null

    const commonHeaders = [
      'ingredients',
      'ingredient',
      'instructions',
      'instruction',
      'directions',
      'direction',
      'method',
      'dough',
      'batter',
      'filling',
      'glaze',
      'topping',
      'assembly',
      'icing',
      'frosting',
      'garnish'
    ]

    if (
      commonHeaders.some((header) =>
        withoutTrailingColon.toLowerCase().startsWith(header)
      )
    ) {
      return withoutTrailingColon
    }

    if (
      withoutTrailingColon === withoutTrailingColon.toUpperCase() &&
      withoutTrailingColon.length <= 60 &&
      !/\d/.test(withoutTrailingColon)
    ) {
      return withoutTrailingColon
    }

    return null
  }

  const handleSave = async () => {
    if (!title.trim()) return
    if (!id) {
      setError('Missing recipe id')
      return
    }
    setSaveError(null)
    setSaving(true)

    // Helper to convert flat list with SECTION markers into structured array
    const buildStructuredList = (list: string[], itemKey: 'items' | 'steps') => {
      const groups: { section: string; items?: string[]; steps?: string[] }[] = []
      let currentGroup: { section: string; items?: string[]; steps?: string[] } = { 
        section: '', 
        [itemKey]: [] 
      }

      list.forEach((rawValue) => {
        const value = rawValue.trim()
        if (!value) return

        const potentialSection = parseSectionLabel(value)

        if (potentialSection !== null) {
          if (
            (itemKey === 'items' && currentGroup.items && currentGroup.items.length > 0) ||
            (itemKey === 'steps' && currentGroup.steps && currentGroup.steps.length > 0) ||
            currentGroup.section
          ) {
            groups.push(currentGroup)
          }

          currentGroup = {
            section: potentialSection,
            [itemKey]: []
          }
        } else {
          if (itemKey === 'items') {
            currentGroup.items!.push(value)
          } else {
            currentGroup.steps!.push(value)
          }
        }
      })

      if (
        (itemKey === 'items' && currentGroup.items && currentGroup.items.length > 0) ||
        (itemKey === 'steps' && currentGroup.steps && currentGroup.steps.length > 0) ||
        currentGroup.section
      ) {
        groups.push(currentGroup)
      }

      return groups.length > 0 ? groups : []
    }

    // Build structured data
    const structuredIngredients = buildStructuredList(
      ingredientList.filter((i) => i.trim()),
      'items'
    )
    const structuredInstructions = buildStructuredList(
      instructionList.filter((i) => i.trim()),
      'steps'
    )

    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          ingredients: structuredIngredients, // Send structured data directly
          instructions: structuredInstructions, // Send structured data directly
          tags,
          notes: description || null, // Store description in notes field
          source_url: sourceUrl || null,
          user_id: user?.id || null,
          // Metadata fields (store in proper database columns)
          servings: servings ? parseInt(servings) : null,
          prep_time: prepTime || null,
          cook_time: cookTime || null,
          total_time: totalTime || null,
          cuisine: cuisine || null,
          meal_type: mealType || null,
        }),
      })

      const responseBody = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          responseBody?.error ||
          responseBody?.details?.message ||
          'Failed to save changes'
        setSaveError(message)
        throw new Error(message)
      }

      // On success, return to the recipe detail page
      router.push(`/recipes/${id}`)
    } catch (err) {
      console.error('Error saving recipe:', err)
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-xl font-semibold text-slate-800">We hit a snag loading this recipe.</p>
          <p className="text-sm text-slate-500">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setError(null)
                setLoading(true)
                router.refresh()
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
            <Link
              href={id ? `/recipes/${id}` : '/'}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors"
            >
              Back to recipe
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
            <span className="font-semibold text-slate-700">Edit Recipe</span>
          </div>
          <div className="flex items-center gap-4">
            {saveError && (
              <span className="text-sm text-red-600">{saveError}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
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
                  <div className="space-y-6">
                    {/* Image Upload Section */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Recipe Photo</label>
                      <div className="flex items-center gap-6">
                        <div className="w-32 h-32 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden relative">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt="Recipe preview"
                              fill
                              sizes="128px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-4xl text-slate-300">📷</span>
                          )}
                          {uploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="inline-block px-4 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 text-center">
                            {uploading ? 'Uploading...' : imageUrl ? 'Change Photo' : 'Upload Photo'}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={uploading}
                            />
                          </label>
                          {imageUrl && (
                            <button 
                              onClick={() => setImageUrl('')}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove Photo
                            </button>
                          )}
                          <p className="text-xs text-slate-500">JPG, PNG or WebP up to 5MB</p>
                        </div>
                      </div>
                    </div>

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
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Servings</label>
                      <input
                        type="number"
                        value={servings}
                        onChange={(e) => setServings(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                        placeholder="4"
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
                      No ingredients yet. Click &quot;Add Item&quot; to start.
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
                      No instructions yet. Click &quot;Add Step&quot; to start.
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
