'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/lib/userContext'
import Navigation from '@/app/components/Navigation'
import RecipeInteractionWrapper from '@/app/components/RecipeInteractionWrapper'

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

// Helpers to parse raw text into structured format for preview
function parseIngredients(text: string): { section: string; items: string[] }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)
  const groups: { section: string; items: string[] }[] = []
  let currentGroup: { section: string; items: string[] } = { section: '', items: [] }

  lines.forEach(line => {
    // Simple heuristic for sections: ends with colon or is all caps
    const isHeader = line.endsWith(':') || (line === line.toUpperCase() && line.length < 50 && !line.match(/^\d/))
    
    if (isHeader) {
      if (currentGroup.items.length > 0 || currentGroup.section) {
        groups.push(currentGroup)
      }
      currentGroup = { section: line.replace(/:$/, ''), items: [] }
    } else {
      currentGroup.items.push(line)
    }
  })

  if (currentGroup.items.length > 0 || currentGroup.section) {
    groups.push(currentGroup)
  }
  
  return groups.length > 0 ? groups : [{ section: '', items: [] }]
}

function parseInstructions(text: string): { section: string; steps: string[] }[] {
  // Split by double newline for paragraphs/steps
  const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l)
  const groups: { section: string; steps: string[] }[] = []
  let currentGroup: { section: string; steps: string[] } = { section: '', steps: [] }

  lines.forEach(line => {
    const isHeader = line.endsWith(':') || (line === line.toUpperCase() && line.length < 50 && !line.match(/^\d/))

    if (isHeader) {
      if (currentGroup.steps.length > 0 || currentGroup.section) {
        groups.push(currentGroup)
      }
      currentGroup = { section: line.replace(/:$/, ''), steps: [] }
    } else {
      // Strip numbering if present (e.g. "1. Mix..." -> "Mix...")
      const cleanStep = line.replace(/^\d+[\).]\s*/, '')
      currentGroup.steps.push(cleanStep)
    }
  })

  if (currentGroup.steps.length > 0 || currentGroup.section) {
    groups.push(currentGroup)
  }

  return groups.length > 0 ? groups : [{ section: '', steps: [] }]
}

export default function SplitViewEditPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')
  const [rating, setRating] = useState<string>('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')

  // Live Preview Data
  const previewIngredients = useMemo(() => parseIngredients(ingredients), [ingredients])
  const previewInstructions = useMemo(() => parseInstructions(instructions), [instructions])

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', id)
          .single()

        if (error || !data) throw new Error('Recipe not found')

        setTitle(data.title || '')
        
        // Ingredients
        if (data.ingredients && Array.isArray(data.ingredients)) {
          if (data.ingredients.length > 0 && typeof data.ingredients[0] === 'object' && data.ingredients[0] !== null && 'section' in data.ingredients[0]) {
            const parts: string[] = []
            data.ingredients.forEach((group: { section?: string; items?: string[] }) => {
              if (group.section?.trim()) parts.push(`${group.section.trim()}:`)
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
             const text = data.instructions
             if (text.startsWith('[') || text.startsWith('{')) {
                const parsed = JSON.parse(text)
                if (Array.isArray(parsed)) {
                   const parts: string[] = []
                   parsed.forEach((group: any) => {
                      if (group.section) parts.push(`${group.section}:`)
                      group.steps?.forEach((step: string, idx: number) => {
                         parts.push(`${idx + 1}. ${step}`)
                      })
                   })
                   setInstructions(parts.length > 0 ? parts.join('\n\n') : text)
                } else {
                   setInstructions(text)
                }
             } else {
                setInstructions(text)
             }
           } catch {
              setInstructions(data.instructions)
           }
        } else {
           setInstructions('')
        }

        setTags(data.tags?.join(', ') || '')
        setRating(data.rating?.toString() || '')
        setSourceUrl(data.source_url || '')
        setNotes(data.notes || '')
        
        setLoading(false)
      } catch (err) {
        setLoading(false)
      }
    }

    if (id) fetchRecipe()
  }, [id])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

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
          notes: notes.trim() || null,
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
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b flex items-center justify-between px-6 bg-white z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/recipes/${id}`} className="text-sm font-medium text-stone-500 hover:text-stone-900">
            ← Exit
          </Link>
          <span className="text-stone-300">|</span>
          <span className="font-semibold text-stone-800">Live Editor</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-stone-900 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-stone-800"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Editor */}
        <div className="w-1/2 h-full flex flex-col border-r border-stone-200 bg-stone-50 overflow-y-auto p-8">
          <div className="max-w-xl mx-auto w-full space-y-8">
            <div>
              <label className="block text-xs font-bold uppercase text-stone-400 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-2xl font-serif bg-transparent border-b border-stone-300 focus:border-stone-800 focus:ring-0 px-0 py-2"
                placeholder="Recipe Title"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div>
                 <label className="block text-xs font-bold uppercase text-stone-400 mb-2">Rating (0-10)</label>
                 <input
                   type="number"
                   value={rating}
                   onChange={(e) => setRating(e.target.value)}
                   className="w-full bg-white border border-stone-300 rounded-md px-3 py-2"
                   min="0" max="10"
                 />
               </div>
               <div>
                 <label className="block text-xs font-bold uppercase text-stone-400 mb-2">Tags</label>
                 <input
                   type="text"
                   value={tags}
                   onChange={(e) => setTags(e.target.value)}
                   className="w-full bg-white border border-stone-300 rounded-md px-3 py-2"
                   placeholder="tag1, tag2"
                 />
               </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-stone-400 mb-2">Ingredients</label>
              <p className="text-xs text-stone-500 mb-2">One per line. Use headers ending in colon (e.g. "Dough:") to create sections.</p>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                className="w-full h-64 bg-white border border-stone-300 rounded-md p-4 font-mono text-sm leading-relaxed"
                placeholder="1 cup flour..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-stone-400 mb-2">Instructions</label>
              <p className="text-xs text-stone-500 mb-2">Separate steps with newlines. Headers end in colon.</p>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full h-96 bg-white border border-stone-300 rounded-md p-4 font-mono text-sm leading-relaxed"
                placeholder="1. Mix ingredients..."
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div className="w-1/2 h-full overflow-y-auto bg-white relative">
          <div className="absolute top-4 right-4 bg-stone-100 text-stone-500 px-3 py-1 rounded-full text-xs font-medium z-10 pointer-events-none opacity-70">
            Live Preview
          </div>
          
          {/* Wrapped in a div to isolate styles if needed */}
          <div className="transform origin-top transition-all">
             <RecipeInteractionWrapper 
               ingredients={previewIngredients}
               instructions={previewInstructions}
             >
               {{
                 sidebarTop: (
                   <div className="mb-8">
                     <h1 className="text-3xl font-serif text-stone-900 mb-2">{title || 'Untitled Recipe'}</h1>
                     <div className="flex gap-2">
                        {tags.split(',').map(t => t.trim()).filter(t => t).map(t => (
                           <span key={t} className="text-xs bg-stone-100 px-2 py-1 rounded-full text-stone-600">#{t}</span>
                        ))}
                     </div>
                   </div>
                 ),
                 mainContentBottom: (
                   <div className="mt-12 pt-8 border-t border-stone-100 text-stone-400 text-center text-sm italic">
                     Preview Mode - Comments and other interactions disabled
                   </div>
                 )
               }}
             </RecipeInteractionWrapper>
          </div>
        </div>
      </div>
    </div>
  )
}

