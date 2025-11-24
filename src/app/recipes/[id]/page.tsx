import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DeleteRecipeButton from '@/app/components/DeleteRecipeButton'
import StarRating from '@/app/components/StarRating'
import Navigation from '@/app/components/Navigation'
import RecipeImageWithModal from '@/app/components/RecipeImageWithModal'
import UserAvatar from '@/app/components/UserAvatar'
import CookieBot from '@/app/components/CookieBot'
import RecipeComments from '@/app/components/RecipeComments'
import RecipeHistory from '@/app/components/RecipeHistory'
import RecipeInteractionWrapper from '@/app/components/RecipeInteractionWrapper'

// Helper functions
function getDomain(url: string): string {
  try {
    let domain = new URL(url).hostname.replace(/^www\./, '')
    // Remove standard TLDs (last segment if it matches common patterns)
    // We split by dot
    const parts = domain.split('.')
    if (parts.length > 1) {
       // If the last part is a TLD, remove it
       // .com, .org, .net, etc.
       const last = parts[parts.length - 1]
       if (/^(com|org|net|edu|gov|mil|int|co|uk|us|ca|au|nz|de|fr|it|es|io|me|info|biz|tv)$/i.test(last)) {
         parts.pop()
       }
       // If the NEW last part is 'co' or 'com' (like in .co.uk or .com.au), remove it too
       if (parts.length > 1) {
          const secondLast = parts[parts.length - 1]
          if (/^(co|com)$/i.test(secondLast)) {
             parts.pop()
          }
       }
       return parts.join('.')
    }
    return domain
  } catch (e) {
    return 'Original Link'
  }
}

function cleanIngredient(raw: string): string {
  return raw
    .replace(/^\s*[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanInstruction(raw: string): string {
  return raw
    .replace(/^\d+[\).]\s*/, '')
    .replace(/^\s*[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanSectionHeader(raw: string): string {
  return raw
    .replace(/^\d+[\).]?\s*/, '')
    .replace(/:\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function formatTime(time: string): string {
  if (!time) return time
  if (time.toLowerCase().includes('min')) return time
  return time.replace(/\s*minutes?\s*/gi, ' min').trim()
}

function isSectionHeader(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const withoutNumber = t.replace(/^\d+[\).]?\s*/, '')
  const stripped = withoutNumber.replace(/:\s*$/, '').trim()
  if (/\d/.test(stripped)) return false
  if (/(g|kg|tbsp|tsp|cup|cups|ml|oz|lb|pound|pounds|gram|grams|kilogram|kilograms|tablespoon|teaspoon|milliliter|milliliters|ounce|ounces)\b/i.test(stripped)) return false
  if (/^(for|to make|make the|assemble|prepare)/i.test(stripped)) return true
  if (stripped.length >= 3 && stripped.length < 60 && stripped === stripped.toUpperCase() && !/^\w+ \w+ \w+ \w+/.test(stripped)) return true
  if (withoutNumber.endsWith(':')) {
    if (/^(for|to make|make the|assemble|prepare)/i.test(stripped)) return true
    if (stripped === stripped.toUpperCase() && stripped.length >= 3 && stripped.length < 60) return true
  }
  return false
}

function organizeIntoGroups(items: string[], isInstructions: boolean = false): { section: string; items: string[] }[] {
  const groups: { section: string; items: string[] }[] = []
  let currentGroup: { section: string; items: string[] } = { section: '', items: [] }

  for (const item of items) {
    const cleaned = item.trim()
    if (!cleaned) continue

    if (isSectionHeader(cleaned)) {
      if (currentGroup.items.length > 0 || currentGroup.section.trim().length > 0) {
        groups.push(currentGroup)
      }
      currentGroup = {
        section: cleanSectionHeader(cleaned),
        items: []
      }
    } else {
      const cleanedItem = isInstructions ? cleanInstruction(cleaned) : cleanIngredient(cleaned)
      if (cleanedItem.length > 0) {
        currentGroup.items.push(cleanedItem)
      }
    }
  }

  if (currentGroup.items.length > 0 || currentGroup.section.trim().length > 0) {
    groups.push(currentGroup)
  }

  return groups.length > 0 ? groups : [{ section: '', items: [] }]
}

interface Recipe {
  id: string
  title: string
  ingredients: { section: string; items: string[] }[] | null
  instructions: { section: string; steps: string[] }[] | null
  tags: string[] | null
  rating: number | null
  notes: string | null
  created_at: string | null
  image_url: string | null
  source_url: string | null
  cookbookSource: string | null
  created_by?: string | null
  creator?: {
    id: string
    name: string
    avatar_url: string
  } | null
}

type RecipeRow = Recipe & {
  cookbooksource?: string | null
  created_by?: string | null
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RecipeDetail({ params }: PageProps) {
  const { id } = await params

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single<RecipeRow>()

  if (error || !recipe) {
    notFound()
  }

  let creator: { id: string; name: string; avatar_url: string } | null = null
  if (recipe?.created_by) {
    const { data: creatorData, error: creatorError } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('id', recipe.created_by)
      .single()
    
    if (!creatorError && creatorData) {
      creator = creatorData
    }
  }

  let averageRating: number | null = null
  let ratingEntries: { user: string; rating: number; avatar_url: string; user_id: string }[] | null = null
  
  try {
    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .select('rating, user_id')
      .eq('recipe_id', id)

    if (ratingsError) {
       averageRating = recipe.rating
       ratingEntries = null
    } else if (ratings && ratings.length > 0) {
      const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
      averageRating = Math.round((sum / ratings.length) * 10) / 10
      
      const userIds = [...new Set(ratings.map(r => r.user_id))]
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', userIds)
      
      const usersMap = new Map<string, { name: string; avatar_url: string }>()
      if (users && !usersError) {
        users.forEach(u => usersMap.set(u.id, { name: u.name, avatar_url: u.avatar_url }))
      }
      
      ratingEntries = ratings.map(r => {
        const userData = usersMap.get(r.user_id)
        return {
          user: userData?.name || 'Unknown',
          rating: r.rating,
          avatar_url: userData?.avatar_url || '',
          user_id: r.user_id
        }
      })
    } else {
      averageRating = null
      ratingEntries = []
    }
  } catch (error) {
    averageRating = recipe.rating
    ratingEntries = null
  }

  let normalizedIngredients: { section: string; items: string[] }[] | null = null
  if (recipe.ingredients) {
    if (Array.isArray(recipe.ingredients)) {
      if (recipe.ingredients.length > 0 && typeof recipe.ingredients[0] === 'object' && recipe.ingredients[0] !== null && 'section' in recipe.ingredients[0]) {
        normalizedIngredients = (recipe.ingredients as { section: string; items: string[] }[]).map(group => {
          const cleanedSection = cleanSectionHeader(group.section || '')
          const cleanedItems = (group.items || [])
            .map(cleanIngredient)
            .filter(item => item.length > 0 && !isSectionHeader(item))
          
          return {
            section: cleanedSection,
            items: cleanedItems
          }
        }).filter(group => group.items.length > 0 || group.section.trim().length > 0)
      } else {
        const cleanedItems = (recipe.ingredients as string[])
          .map(item => item.trim())
          .filter(item => item.length > 0)
        if (cleanedItems.length > 0) {
          normalizedIngredients = organizeIntoGroups(cleanedItems, false)
        }
      }
    }
  }

  let normalizedInstructions: { section: string; steps: string[] }[] | null = null
  if (recipe.instructions) {
    if (Array.isArray(recipe.instructions)) {
      if (
        recipe.instructions.length > 0 &&
        typeof recipe.instructions[0] === 'object' &&
        recipe.instructions[0] !== null &&
        'section' in recipe.instructions[0]
      ) {
        normalizedInstructions = (recipe.instructions as { section: string; steps: string[] }[]).map((group) => {
          const cleanedSection = cleanSectionHeader(group.section || '')
          const cleanedSteps = (group.steps || [])
            .map(cleanInstruction)
            .filter((step) => step.length > 0 && !isSectionHeader(step))

          return {
            section: cleanedSection,
            steps: cleanedSteps,
          }
        }).filter((group) => group.steps.length > 0 || group.section.trim().length > 0)
      }
    } else if (typeof recipe.instructions === 'string') {
      const trimmed = recipe.instructions.trim()
      let parsedStructured: unknown = null
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          parsedStructured = JSON.parse(trimmed)
        } catch {
          parsedStructured = null
        }
      }

      if (
        Array.isArray(parsedStructured) &&
        parsedStructured.length > 0 &&
        typeof parsedStructured[0] === 'object' &&
        parsedStructured[0] !== null
      ) {
        normalizedInstructions = (parsedStructured as { section?: string; steps?: string[] }[])
          .map((group) => {
            const cleanedSection = cleanSectionHeader(group.section || '')
            const cleanedSteps = (group.steps || [])
              .map((step) => cleanInstruction(step || ''))
              .filter((step) => step.length > 0 && !isSectionHeader(step))

            return {
              section: cleanedSection,
              steps: cleanedSteps,
            }
          })
          .filter((group) => group.steps.length > 0 || group.section.trim().length > 0)
      } else {
        const steps = trimmed
          .split('\n')
          .map((step: string) => step.trim())
          .filter((step: string) => step.length > 0)
        if (steps.length > 0) {
          const organized = organizeIntoGroups(steps, true)
          normalizedInstructions = organized.map((g) => ({ section: g.section, steps: g.items }))
        }
      }
    }
  }

  const recipeData: Recipe = {
    ...recipe,
    ingredients: normalizedIngredients || [],
    instructions: normalizedInstructions || [],
    cookbookSource: recipe.cookbooksource || recipe.cookbookSource || null,
    created_by: recipe.created_by || null,
    creator: creator
  }

  let metadata: {
    description?: string
    servings?: number
    prepTime?: string
    cookTime?: string
    totalTime?: string
    cuisine?: string
    mealType?: string
    nutrition?: {
      calories?: number
      protein?: number
      fat?: number
      carbs?: number
    }
  } | null = null

  if (recipeData.notes && typeof recipeData.notes === 'string') {
    try {
      const parsed = JSON.parse(recipeData.notes)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed
      }
    } catch (e) {
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <Navigation />
      
      {/* 
        We need to split the layout into two parts for the client wrapper:
        1. Static content (Title, Meta, Image) that stays server-side rendered for SEO/Performance
        2. Interactive content (Ingredients + Instructions) that goes into the wrapper
      */}
      
      <RecipeInteractionWrapper 
        ingredients={recipeData.ingredients || []} 
        instructions={recipeData.instructions || []}
      >
        {{
          sidebarTop: (
            <>
             {/* Back / Actions */}
             <div className="flex items-center justify-between text-sm">
               <Link href="/" className="text-slate-500 hover:text-slate-900 font-medium">← Back</Link>
               <div className="flex items-center gap-2">
                 <Link 
                   href={`/recipes/${id}/edit`} 
                   className="px-4 py-2 font-medium transition-colors hover:opacity-90 text-center flex items-center"
                   style={{
                     background: '#F9E7B2',
                     color: '#CE7E5A',
                     borderRadius: '14px'
                   }}
                 >
                   Edit
                 </Link>
                 <DeleteRecipeButton recipeId={id} recipeTitle={recipeData.title} />
               </div>
             </div>
  
             {/* Title & Meta */}
             <div>
               <div className="flex items-center gap-2 mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  {metadata?.cuisine && <span>{metadata.cuisine}</span>}
                  {metadata?.mealType && <span>• {metadata.mealType}</span>}
               </div>
               <h1 className="text-3xl md:text-4xl font-serif font-medium text-slate-900 mb-4 leading-tight">{recipeData.title}</h1>
               
               <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 mt-4">
                  {/* Creator & Date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       {recipeData.creator && (
                         <UserAvatar
                           src={recipeData.creator.avatar_url}
                           alt={recipeData.creator.name || 'Recipe creator'}
                           name={recipeData.creator.name}
                         />
                       )}
                       <div className="text-sm">
                          <div className="font-medium">{recipeData.creator?.name || 'Unknown Chef'}</div>
                          <div className="text-slate-400 text-xs">
                             {recipeData.created_at && new Date(recipeData.created_at).toLocaleDateString('en-GB')}
                          </div>
                       </div>
                    </div>
                    <RecipeHistory recipeId={id} />
                  </div>
  
                  {/* Rating Section */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                     <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rating</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg text-[#D34E4E]">★</span>
                          <span className="font-medium text-lg">{averageRating || '-'}</span>
                          <span className="text-xs text-slate-400">/10</span>
                        </div>
                     </div>
                     <div>
                        <StarRating recipeId={id} initialRating={averageRating} />
                     </div>
                  </div>
               </div>
             </div>
  
             {/* Image */}
             <div className="mb-6">
               {recipeData.image_url ? (
                 <div className="rounded-xl overflow-hidden shadow-sm">
                   <RecipeImageWithModal imageUrl={recipeData.image_url} alt={recipeData.title} />
                 </div>
               ) : (
                 <div className="rounded-xl overflow-hidden shadow-sm aspect-[4/3] bg-slate-200 flex items-center justify-center text-4xl text-slate-400">
                   🍪
                 </div>
               )}
             </div>
  
             {/* Metadata (Prep/Cook/Total/Servings) */}
             {metadata && (
               <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  {metadata.prepTime && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Prep</div>
                      <div className="font-medium text-slate-900">{formatTime(metadata.prepTime)}</div>
                    </div>
                  )}
                  {metadata.cookTime && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cook</div>
                      <div className="font-medium text-slate-900">{formatTime(metadata.cookTime)}</div>
                    </div>
                  )}
                  {metadata.totalTime && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total</div>
                      <div className="font-medium text-slate-900">{formatTime(metadata.totalTime)}</div>
                    </div>
                  )}
                  {metadata.servings && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Servings</div>
                      <div className="font-medium text-slate-900">{metadata.servings}</div>
                    </div>
                  )}
               </div>
             )}
             
             {/* Nutrition Mini-Panel */}
             {metadata?.nutrition && (
               <div className="bg-white p-4 rounded-lg border border-slate-100 text-xs space-y-2">
                  <div className="flex justify-between font-bold text-slate-700">
                     <span>Calories</span>
                     <span>{metadata.nutrition.calories}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-slate-500 pt-2 border-t border-slate-50">
                     <div>
                        <span className="block font-medium text-slate-900">{metadata.nutrition.protein}g</span>
                        Protein
                     </div>
                     <div>
                        <span className="block font-medium text-slate-900">{metadata.nutrition.carbs}g</span>
                        Carbs
                     </div>
                     <div>
                        <span className="block font-medium text-slate-900">{metadata.nutrition.fat}g</span>
                        Fat
                     </div>
                  </div>
               </div>
             )}
            </>
          ),
          mainContentTop: (
            <>
             {/* Description */}
             {metadata?.description && (
               <div className="font-serif text-lg leading-relaxed text-slate-700 mb-10 italic">
                 {metadata.description}
               </div>
             )}
  
             {/* Notes (if not metadata) */}
             {recipeData.notes && !metadata && (
               <div className="bg-amber-50 p-6 rounded-xl mb-10 text-amber-900 leading-relaxed">
                 <h3 className="font-bold mb-2 text-sm uppercase tracking-wider opacity-70">Chef's Notes</h3>
                 {recipeData.notes}
               </div>
             )}
            </>
          ),
          mainContentBottom: (
            <>
             {/* Actions Footer */}
             <div className="py-8 border-t border-slate-200 flex flex-col gap-8">
                {/* Tags */}
                {recipeData.tags && recipeData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recipeData.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm hover:bg-slate-200 cursor-default">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Source */}
                {(recipeData.source_url || recipeData.cookbookSource) && (
                  <div className="text-sm text-slate-500">
                     Source: {recipeData.source_url ? <a href={recipeData.source_url} className="text-[#D34E4E] underline" target="_blank">{getDomain(recipeData.source_url)}</a> : recipeData.cookbookSource}
                  </div>
                )}
             </div>
  
             {/* Comments */}
             <div className="mt-8">
               <RecipeComments recipeId={id} />
             </div>
            </>
          )
        }}
      </RecipeInteractionWrapper>

      <CookieBot recipeId={id} recipeTitle={recipeData.title} ingredients={recipeData.ingredients} instructions={recipeData.instructions} tags={recipeData.tags} />
    </div>
  )
}
