import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DeleteRecipeButton from '@/app/components/DeleteRecipeButton'
import StarRating from '@/app/components/StarRating'
import Logo from '@/app/components/Logo'
import RecipeImageWithModal from '@/app/components/RecipeImageWithModal'

// Helper to clean ingredient text - remove leading bullets and normalize whitespace
function cleanIngredient(raw: string): string {
  return raw
    .replace(/^\s*[-•*]\s*/, '') // remove leading dashes/bullets
    .replace(/\s+/g, ' ')
    .trim()
}

// Helper to clean instruction text - remove leading numbers and bullets
function cleanInstruction(raw: string): string {
  return raw
    .replace(/^\d+[\).]\s*/, '') // remove leading numbers "1." or "1)"
    .replace(/^\s*[-•*]\s*/, '') // remove leading bullets
    .replace(/\s+/g, ' ')
    .trim()
}

// Helper to clean section header - remove trailing colon, leading numbers, and normalize
function cleanSectionHeader(raw: string): string {
  return raw
    .replace(/^\d+[\).]?\s*/, '') // remove numbering
    .replace(/:\s*$/, '') // remove trailing colon
    .trim()
    .replace(/\s+/g, ' ') // normalize spaces
}

// Helper to format time strings (e.g., "10 minutes" -> "10 min")
function formatTime(time: string): string {
  if (!time) return time
  // If it already contains "min" or is well-formatted, return as-is
  if (time.toLowerCase().includes('min')) return time
  // Otherwise, try to normalize common patterns
  return time.replace(/\s*minutes?\s*/gi, ' min').trim()
}

// Helper to check if a string looks like a section header (strict version)
function isSectionHeader(text: string): boolean {
  const t = text.trim()

  if (!t) return false

  // Remove leading numbering (e.g., "1. For the cake")
  const withoutNumber = t.replace(/^\d+[\).]?\s*/, '')

  // REMOVE trailing colon only for analysis
  const stripped = withoutNumber.replace(/:\s*$/, '').trim()

  // CRITICAL: If it contains digits or units, it's NOT a header (it's an ingredient)
  if (/\d/.test(stripped)) return false
  if (/(g|kg|tbsp|tsp|cup|cups|ml|oz|lb|pound|pounds|gram|grams|kilogram|kilograms|tablespoon|teaspoon|milliliter|milliliters|ounce|ounces)\b/i.test(stripped)) return false

  // 1. Patterns like "For the cake", "For cake", "To make the ganache", etc.
  // MUST start with these patterns to be a header
  if (/^(for|to make|make the|assemble|prepare)/i.test(stripped)) {
    return true
  }

  // 2. All-uppercase sections (e.g., "CAKE", "BUTTERCREAM", "PARMESAN RISOTTO")
  // Must be all uppercase, at least 3 chars, and not look like an ingredient
  if (
    stripped.length >= 3 &&
    stripped.length < 60 &&
    stripped === stripped.toUpperCase() &&
    !/^\w+ \w+ \w+ \w+/.test(stripped) // Not a long multi-word ingredient-like phrase
  ) {
    return true
  }

  // 3. If it ends with colon AND matches header patterns (safety check)
  if (withoutNumber.endsWith(':')) {
    // Only if it matches known header patterns or is all uppercase
    if (/^(for|to make|make the|assemble|prepare)/i.test(stripped)) return true
    if (stripped === stripped.toUpperCase() && stripped.length >= 3 && stripped.length < 60) return true
  }

  return false
}

// Helper to extract and organize items/steps into groups based on section headers
function organizeIntoGroups(items: string[], isInstructions: boolean = false): { section: string; items: string[] }[] {
  const groups: { section: string; items: string[] }[] = []
  let currentGroup: { section: string; items: string[] } = { section: '', items: [] }

  for (const item of items) {
    const cleaned = item.trim()
    if (!cleaned) continue

    // Check if this item is a section header
    if (isSectionHeader(cleaned)) {
      // Save previous group if it has items
      if (currentGroup.items.length > 0 || currentGroup.section.trim().length > 0) {
        groups.push(currentGroup)
      }
      // Start new group with this section header
      currentGroup = {
        section: cleanSectionHeader(cleaned),
        items: []
      }
    } else {
      // This is a regular item/step - add to current group
      const cleanedItem = isInstructions ? cleanInstruction(cleaned) : cleanIngredient(cleaned)
      if (cleanedItem.length > 0) {
        currentGroup.items.push(cleanedItem)
      }
    }
  }

  // Add the last group
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
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RecipeDetailPage({ params }: PageProps) {
  const { id } = await params

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !recipe) {
    notFound()
  }

  // Normalize ingredients to structured format
  let normalizedIngredients: { section: string; items: string[] }[] | null = null
  if (recipe.ingredients) {
    if (Array.isArray(recipe.ingredients)) {
      // Check if it's already in the new structured format
      if (recipe.ingredients.length > 0 && typeof recipe.ingredients[0] === 'object' && recipe.ingredients[0] !== null && 'section' in recipe.ingredients[0]) {
        // Data is already structured - clean and preserve structure
        normalizedIngredients = (recipe.ingredients as { section: string; items: string[] }[]).map(group => {
          const cleanedSection = cleanSectionHeader(group.section || '')
          const cleanedItems = (group.items || [])
            .map(cleanIngredient)
            .filter(item => item.length > 0 && !isSectionHeader(item)) // Filter out any section headers that leaked into items
          
          return {
            section: cleanedSection,
            items: cleanedItems
          }
        }).filter(group => group.items.length > 0 || group.section.trim().length > 0)
      } else {
        // Old format: string[] - convert to structured format, extracting section headers
        const cleanedItems = (recipe.ingredients as string[])
          .map(item => item.trim())
          .filter(item => item.length > 0)
        if (cleanedItems.length > 0) {
          normalizedIngredients = organizeIntoGroups(cleanedItems, false)
        }
      }
    }
  }

  // Normalize instructions to structured format
  let normalizedInstructions: { section: string; steps: string[] }[] | null = null
  if (recipe.instructions) {
    if (Array.isArray(recipe.instructions)) {
      // Check if it's already in the new structured format
      if (recipe.instructions.length > 0 && typeof recipe.instructions[0] === 'object' && recipe.instructions[0] !== null && 'section' in recipe.instructions[0]) {
        // Data is already structured - clean and preserve structure
        normalizedInstructions = (recipe.instructions as { section: string; steps: string[] }[]).map(group => {
          const cleanedSection = cleanSectionHeader(group.section || '')
          const cleanedSteps = (group.steps || [])
            .map(cleanInstruction)
            .filter(step => step.length > 0 && !isSectionHeader(step)) // Filter out any section headers that leaked into steps
          
          return {
            section: cleanedSection,
            steps: cleanedSteps
          }
        }).filter(group => group.steps.length > 0 || group.section.trim().length > 0)
      }
    } else if (typeof recipe.instructions === 'string') {
      // Old format: string - convert to structured format, extracting section headers
      const steps = recipe.instructions
        .split('\n')
        .map((step: string) => step.trim())
        .filter((step: string) => step.length > 0)
      if (steps.length > 0) {
        const organized = organizeIntoGroups(steps, true)
        normalizedInstructions = organized.map(g => ({ section: g.section, steps: g.items }))
      }
    }
  }

  const recipeData: Recipe = {
    ...recipe,
    ingredients: normalizedIngredients,
    instructions: normalizedInstructions,
    // Map cookbooksource (database) to cookbookSource (TypeScript)
    cookbookSource: (recipe as any).cookbooksource || (recipe as any).cookbookSource || null
  }

  // Parse metadata from notes if it contains JSON
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
      // If parsing fails, metadata remains null and notes will be displayed as-is
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <header className="border-b" style={{ borderColor: 'rgba(211, 78, 78, 0.1)', background: '#F9E7B2' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-3xl font-bold transition-colors cursor-pointer" style={{ color: 'var(--text-main)' }}>
              <Logo size={48} />
              <span>Cookie Jar</span>
            </Link>
            <div className="flex gap-3">
              <Link
                href={`/recipes/${id}/edit`}
                className="px-4 py-2 font-medium transition-colors hover:opacity-90"
                style={{
                  background: '#DDC57A',
                  color: '#2B2B2B',
                  borderRadius: '14px'
                }}
              >
                Edit Recipe
              </Link>
              <DeleteRecipeButton recipeId={id} recipeTitle={recipeData.title} />
              <Link
                href="/"
                className="px-4 py-2 font-medium transition-colors hover:opacity-90"
                style={{
                  background: '#D34E4E',
                  color: 'white',
                  borderRadius: '14px'
                }}
              >
                ← Back to Recipes
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="rounded-lg border p-6 md:p-8" style={{ 
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          borderColor: 'rgba(211, 78, 78, 0.1)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
        {/* OUTER WRAPPER */}
<div className="md:grid md:grid-cols-[350px_1fr] gap-8 mb-8">

{/* LEFT COLUMN */}
{recipeData.image_url && (
  <div className="w-full max-w-[350px]">
    <RecipeImageWithModal
      imageUrl={recipeData.image_url}
      alt={recipeData.title}
    />
  </div>
)}

{/* RIGHT COLUMN */}
<div className="flex flex-col gap-6 flex-1 [&>*]:block [&>*]:w-full">
  {/* ROW 1: Title + Rating */}
  <div className="flex justify-between items-start w-full">
    <h2 className="text-3xl md:text-4xl font-bold leading-tight">
      {recipeData.title}
    </h2>
    <StarRating recipeId={id} initialRating={recipeData.rating} />
  </div>

  {/* ROW 2: Description */}
  {metadata?.description && (
    <div className="block w-full">
      <p className="text-gray-700 leading-relaxed block w-full">
        {metadata.description}
      </p>
    </div>
  )}

  {/* ROW 3 — Cook Times + Servings */}
  {metadata && (
    <div className="flex justify-between items-start text-xs font-medium w-full">
      {/* Prep/Cook/Total grouped together */}
      <div className="flex gap-4">
        {metadata.prepTime && (
          <div><strong>Prep:</strong> {formatTime(metadata.prepTime)}</div>
        )}
        {metadata.cookTime && (
          <div><strong>Cook:</strong> {formatTime(metadata.cookTime)}</div>
        )}
        {metadata.totalTime && (
          <div><strong>Total:</strong> {formatTime(metadata.totalTime)}</div>
        )}
      </div>

      {/* Servings on the right */}
      {metadata.servings && (
        <div><strong>Servings:</strong> {metadata.servings}</div>
      )}
    </div>
  )}
</div>
</div>

          {/* NUTRITION BELOW IMAGE */}
          <div className="mt-6">
            {metadata?.nutrition && (
              <div className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed max-w-[300px] shadow-sm">
                <h3 className="font-semibold mb-2">Nutrition per serving</h3>
                <div>Calories: {metadata.nutrition.calories}</div>
                <div>Protein: {metadata.nutrition.protein}g</div>
                <div>Fat: {metadata.nutrition.fat}g</div>
                <div>Carbs: {metadata.nutrition.carbs}g</div>
              </div>
            )}

            {recipeData.source_url && (
              <div className="mt-4">
                <a
                  href={recipeData.source_url}
                  target="_blank"
                  className="text-sm underline text-[#D34E4E]"
                >
                  View Original Source
                </a>
              </div>
            )}
          </div>

          {/* Cookbook Source */}
          {recipeData.cookbookSource && (
            <div>
              <p className="text-sm" style={{ color: 'rgba(43, 43, 43, 0.7)' }}>
                <span style={{ fontWeight: '500' }}>Source:</span> {recipeData.cookbookSource}
              </p>
            </div>
          )}

          {/* Tags */}
          {recipeData.tags && recipeData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {recipeData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 text-sm font-medium"
                  style={{
                    borderRadius: '20px',
                    backgroundColor: 'var(--accent-gold)',
                    color: 'var(--text-main)'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Ingredients */}
          {Array.isArray(recipeData.ingredients) && recipeData.ingredients.length > 0 && (
            <section className="mb-8 p-5 rounded-lg" style={{
              backgroundColor: 'var(--accent-light)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
                Ingredients
              </h3>
              <div className="space-y-6">
                {recipeData.ingredients.map((group, index) => (
                  <div key={index}>
                    {group.section && group.section.trim() && (
                      <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-main)' }}>
                        {group.section}
                      </h4>
                    )}
                    {group.items && group.items.length > 0 && (
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        {group.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Instructions */}
          {Array.isArray(recipeData.instructions) && recipeData.instructions.length > 0 && (
            <section className="mb-8 p-5 rounded-lg" style={{
              backgroundColor: 'var(--accent-light)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
                Instructions
              </h3>
              <div className="space-y-6">
                {recipeData.instructions.map((group, index) => (
                  <div key={index}>
                    {group.section && group.section.trim() && (
                      <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-main)' }}>
                        {group.section}
                      </h4>
                    )}
                    {group.steps && group.steps.length > 0 && (
                      <ol className="list-decimal list-inside ml-4 space-y-2">
                        {group.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          {recipeData.notes && (
            <section className="mb-6 p-5 rounded-lg" style={{
              backgroundColor: 'var(--accent-light)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-main)' }}>
                Notes
              </h3>
              <div className="whitespace-pre-line leading-relaxed" style={{ color: 'var(--text-main)' }}>
                {recipeData.notes}
              </div>
            </section>
          )}

          {/* Created Date */}
          {recipeData.created_at && (
            <div className="text-sm mt-6 pt-6 border-t" style={{
              color: 'rgba(43, 43, 43, 0.7)',
              borderColor: 'rgba(211, 78, 78, 0.1)'
            }}>
              Added on {new Date(recipeData.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          )}
        </article>
      </main>
    </div>
  )
}

