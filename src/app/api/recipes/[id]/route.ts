import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { saveRecipeVersion } from '@/lib/saveRecipeVersion'
import type { Json } from '@/types/json'

type IngredientGroup = { section: string; items: string[] }
type InstructionGroup = { section: string; steps: string[] }

type IngredientValue = IngredientGroup[] | string[] | string | null | undefined
type InstructionValue = InstructionGroup[] | string | null | undefined

/**
 * Generate a detailed description of ingredient changes
 */
function generateIngredientChangeDescription(
  previous: IngredientValue,
  updated: IngredientValue
): string {
  // Normalize both to structured format for comparison
  const normalizeIngredients = (ing: IngredientValue): IngredientGroup[] => {
    if (!ing) return []
    if (Array.isArray(ing)) {
      if (ing.length === 0) return []
      // Check if already structured
      if (typeof ing[0] === 'object' && ing[0] !== null && 'section' in ing[0]) {
        return ing as IngredientGroup[]
      }
      // Legacy format - convert to structured
      const legacyItems = ing.filter((item) => typeof item === 'string') as string[]
      return [{ section: '', items: legacyItems }]
    }
    return []
  }

  const prev = normalizeIngredients(previous)
  const upd = normalizeIngredients(updated)

  // Flatten all items for comparison
  const prevItems = prev.flatMap(g => g.items || [])
  const updItems = upd.flatMap(g => g.items || [])

  // Extract ingredient names (remove quantities/units) for better matching
  const extractIngredientName = (item: string): string => {
    // Remove leading numbers, fractions, and units
    return item
      .replace(/^[\d\s\/\.]+(tbsp|tsp|cup|cups|g|kg|ml|oz|lb|pound|pounds|gram|grams|kilogram|kilograms|tablespoon|teaspoon|milliliter|milliliters|ounce|ounces)\s+/i, '')
      .replace(/^[\d\s\/\.]+\s*/, '') // Remove any remaining leading numbers
      .trim()
      .toLowerCase()
  }

  // Find modified items first (same base ingredient, different quantity/description)
  const modified: string[] = []
  const modifiedOldItems = new Set<string>()
  const modifiedNewItems = new Set<string>()

  for (const newItem of updItems) {
    const newName = extractIngredientName(newItem)
    const matchingOld = prevItems.find(oldItem => {
      const oldName = extractIngredientName(oldItem)
      return oldName === newName && oldItem !== newItem && oldName.length > 0
    })
    if (matchingOld) {
      modified.push(`${matchingOld} → ${newItem}`)
      modifiedOldItems.add(matchingOld)
      modifiedNewItems.add(newItem)
    }
  }

  // Find added items (excluding modified ones)
  const added = updItems.filter(item => 
    !prevItems.includes(item) && !modifiedNewItems.has(item)
  )
  
  // Find removed items (excluding modified ones)
  const removed = prevItems.filter(item => 
    !updItems.includes(item) && !modifiedOldItems.has(item)
  )

  // Build description
  const changes: string[] = []
  if (modified.length > 0) {
    if (modified.length === 1) {
      changes.push(modified[0])
    } else if (modified.length <= 3) {
      changes.push(modified.join(', '))
    } else {
      changes.push(`${modified.slice(0, 2).join(', ')} and ${modified.length - 2} more`)
    }
  }
  if (added.length > 0) {
    if (added.length === 1) {
      changes.push(`added ${added[0]}`)
    } else {
      changes.push(`added ${added.length} ingredients`)
    }
  }
  if (removed.length > 0) {
    if (removed.length === 1) {
      changes.push(`removed ${removed[0]}`)
    } else {
      changes.push(`removed ${removed.length} ingredients`)
    }
  }

  if (changes.length === 0) {
    return 'User updated ingredients'
  }

  return `User updated ingredients: ${changes.join('; ')}`
}

/**
 * Generate a detailed description of instruction changes
 */
function generateInstructionChangeDescription(
  previous: InstructionValue,
  updated: InstructionValue
): string {
  // Normalize both to structured format
  const normalizeInstructions = (inst: InstructionValue): InstructionGroup[] => {
    if (!inst) return []
    if (Array.isArray(inst)) {
      if (inst.length === 0) return []
      if (typeof inst[0] === 'object' && inst[0] !== null && 'section' in inst[0]) {
        return inst as InstructionGroup[]
      }
      // Legacy format
      const legacySteps = inst.filter((step) => typeof step === 'string') as string[]
      return [{ section: '', steps: legacySteps }]
    }
    if (typeof inst === 'string') {
      // Parse string format
      const steps = inst.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      return [{ section: '', steps }]
    }
    return []
  }

  const prev = normalizeInstructions(previous)
  const upd = normalizeInstructions(updated)

  const prevSteps = prev.flatMap(g => g.steps || [])
  const updSteps = upd.flatMap(g => g.steps || [])

  if (prevSteps.length === updSteps.length) {
    // Same number of steps - likely modifications
    const changedCount = prevSteps.filter((step, idx) => step !== updSteps[idx]).length
    if (changedCount > 0) {
      if (changedCount === 1) {
        return 'User updated 1 instruction step'
      }
      return `User updated ${changedCount} instruction steps`
    }
  } else if (updSteps.length > prevSteps.length) {
    const added = updSteps.length - prevSteps.length
    return `User added ${added} instruction step${added > 1 ? 's' : ''}`
  } else {
    const removed = prevSteps.length - updSteps.length
    return `User removed ${removed} instruction step${removed > 1 ? 's' : ''}`
  }

  return 'User updated instructions'
}

/**
 * PUT /api/recipes/[id]
 * 
 * Updates an existing recipe in the Supabase recipes table.
 * 
 * Body: { title, ingredients, instructions, tags, rating, notes }
 * Returns: { success: boolean, data?: Recipe, error?: string }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Parse request body
    const body = await req.json()
    const { 
      title, 
      ingredients, 
      instructions, 
      tags, 
      rating, 
      notes, 
      source_url, 
      cookbookSource, 
      user_id,
      // Metadata fields
      servings,
      prep_time,
      cook_time,
      total_time,
      cuisine,
      meal_type,
      // Nutrition (per serving)
      calories,
      protein_grams,
      fat_grams,
      carbs_grams
    } = body

    // Get Supabase client
    const supabase = createServerClient()

    // Always fetch existing recipe first to track versions
    const { data: existing, error: fetchError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Recipe not found' },
        { status: 404 }
      )
    }

    const existingRecipe = existing

    // Validate title if provided
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Title cannot be empty' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: {
      title?: string
      ingredients?: string[] | IngredientGroup[]
      instructions?: string | null
      tags?: string[]
      rating?: number | null
      notes?: string | null
      source_url?: string | null
      cookbooksource?: string | null
      // Metadata fields
      servings?: number | null
      prep_time?: string | null
      cook_time?: string | null
      total_time?: string | null
      cuisine?: string | null
      meal_type?: string | null
      // Nutrition (per serving)
      calories?: number | null
      protein_grams?: number | null
      fat_grams?: number | null
      carbs_grams?: number | null
    } = {}

    // Only include title if provided
    if (title !== undefined) {
      updateData.title = title.trim()
    }

    // Handle ingredients - support both structured format and legacy format
    let normalizedIngredients: IngredientGroup[] | string[] | string | null = null
    if (ingredients !== undefined) {
      if (typeof ingredients === 'string') {
        normalizedIngredients = ingredients
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
        updateData.ingredients = normalizedIngredients
      } else if (Array.isArray(ingredients)) {
        // Check if it's structured format (array of objects with section/items)
        if (ingredients.length > 0 && typeof ingredients[0] === 'object' && ingredients[0] !== null && 'section' in ingredients[0]) {
          // Structured format - store as-is
          normalizedIngredients = ingredients
          updateData.ingredients = ingredients
        } else {
          // Legacy format - array of strings
          normalizedIngredients = ingredients
          updateData.ingredients = ingredients
        }
      } else {
        normalizedIngredients = []
        updateData.ingredients = []
      }
    }

    // Handle instructions - support both structured format and legacy string format
    let normalizedInstructions: InstructionGroup[] | string | null = null
    if (instructions !== undefined) {
      if (typeof instructions === 'string') {
        normalizedInstructions = instructions.trim() || null
        updateData.instructions = normalizedInstructions
      } else if (Array.isArray(instructions)) {
        // Structured format - convert to string for storage (legacy compatibility)
        // But we'll track the structured version for versioning
        normalizedInstructions = instructions
        const instructionParts: string[] = []
        instructions.forEach((group: { section?: string; steps?: string[] }) => {
          if (group.section && group.section.trim()) {
            instructionParts.push(group.section)
          }
          if (group.steps && Array.isArray(group.steps)) {
            group.steps.forEach((step: string, idx: number) => {
              instructionParts.push(`${idx + 1}. ${step}`)
            })
          }
        })
        updateData.instructions = instructionParts.join('\n\n') || null
      } else {
        normalizedInstructions = null
        updateData.instructions = null
      }
    }

    // Handle tags - convert comma-separated string to array if needed
    if (tags !== undefined) {
      if (typeof tags === 'string') {
        updateData.tags = tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      } else if (Array.isArray(tags)) {
        updateData.tags = tags
      } else {
        updateData.tags = []
      }
    }

    // Handle rating - validate it's between 1-10
    if (rating !== undefined) {
      if (rating === null || rating === '') {
        updateData.rating = null
      } else {
        const ratingNum = typeof rating === 'string' ? parseInt(rating, 10) : rating
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
          return NextResponse.json(
            { success: false, error: 'Rating must be a number between 1 and 10' },
            { status: 400 }
          )
        }
        updateData.rating = ratingNum
      }
    }

    // Handle notes
    if (notes !== undefined) {
      updateData.notes = notes && typeof notes === 'string' 
        ? notes.trim() || null 
        : null
    }

    // Handle source_url
    if (source_url !== undefined) {
      updateData.source_url = source_url && typeof source_url === 'string' 
        ? source_url.trim() || null 
        : null
    }

    // Handle cookbookSource (database column is lowercase: cookbooksource)
    if (cookbookSource !== undefined) {
      updateData.cookbooksource = cookbookSource && typeof cookbookSource === 'string' 
        ? cookbookSource.trim() || null 
        : null
    }

    // Handle metadata fields
    if (servings !== undefined) {
      updateData.servings = servings && typeof servings === 'number' ? servings : null
    }
    if (prep_time !== undefined) {
      updateData.prep_time = prep_time && typeof prep_time === 'string' ? prep_time.trim() || null : null
    }
    if (cook_time !== undefined) {
      updateData.cook_time = cook_time && typeof cook_time === 'string' ? cook_time.trim() || null : null
    }
    if (total_time !== undefined) {
      updateData.total_time = total_time && typeof total_time === 'string' ? total_time.trim() || null : null
    }
    if (cuisine !== undefined) {
      updateData.cuisine = cuisine && typeof cuisine === 'string' ? cuisine.trim() || null : null
    }
    if (meal_type !== undefined) {
      updateData.meal_type = meal_type && typeof meal_type === 'string' ? meal_type.trim() || null : null
    }

    // Handle nutrition fields
    if (calories !== undefined) {
      updateData.calories = calories && typeof calories === 'number' ? calories : null
    }
    if (protein_grams !== undefined) {
      updateData.protein_grams = protein_grams && typeof protein_grams === 'number' ? protein_grams : null
    }
    if (fat_grams !== undefined) {
      updateData.fat_grams = fat_grams && typeof fat_grams === 'number' ? fat_grams : null
    }
    if (carbs_grams !== undefined) {
      updateData.carbs_grams = carbs_grams && typeof carbs_grams === 'number' ? carbs_grams : null
    }

    // Ensure at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Track versions for changed fields (only if user_id is provided)
    if (user_id && typeof user_id === 'string') {
      const fieldsToTrack = ['title', 'ingredients', 'instructions', 'tags', 'servings', 'nutrition']
      
      for (const field of fieldsToTrack) {
        if (field in updateData) {
          let previousValue: Json | IngredientValue | InstructionValue | string[] | null = null
          let newValue: Json | IngredientValue | InstructionValue | string[] | null = null
          let description: string | undefined = undefined

          if (field === 'title') {
            previousValue = existingRecipe.title
            newValue = updateData.title
            if (previousValue !== newValue) {
              description = `User updated title from "${previousValue}" to "${newValue}"`
            }
          } else if (field === 'ingredients') {
            previousValue = existingRecipe.ingredients
            newValue = normalizedIngredients || updateData.ingredients
            if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
              description = generateIngredientChangeDescription(
                previousValue as IngredientValue,
                newValue as IngredientValue
              )
            }
          } else if (field === 'instructions') {
            previousValue = existingRecipe.instructions
            // Use normalizedInstructions if available (structured format), otherwise use the string
            newValue = normalizedInstructions || updateData.instructions
            // Compare as strings for now (structured format will be compared as JSON)
            const prevStr = typeof previousValue === 'string' ? previousValue : JSON.stringify(previousValue)
            const newStr = typeof newValue === 'string' ? newValue : JSON.stringify(newValue)
            if (prevStr !== newStr) {
              description = generateInstructionChangeDescription(
                previousValue as InstructionValue,
                newValue as InstructionValue
              )
            }
          } else if (field === 'tags') {
            previousValue = existingRecipe.tags
            newValue = updateData.tags
            if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
              const previousTags = Array.isArray(previousValue) ? previousValue : []
              const nextTags = Array.isArray(newValue) ? newValue : []
              description = `User updated tags from [${previousTags.join(', ')}] to [${nextTags.join(', ')}]`
            }
          } else if (field === 'servings' || field === 'nutrition') {
            // These might be in notes/metadata - check if they're being updated
            // For now, we'll handle this when notes are parsed
            continue
          }

          // Only save version if values actually changed
          if (description) {
            const safePrevious = previousValue === undefined ? null : previousValue
            const safeNew = newValue === undefined ? null : newValue
            await saveRecipeVersion({
              recipe_id: id,
              user_id,
              field_changed: field,
              previous_value: safePrevious,
              new_value: safeNew,
              description,
            })
          }
        }
      }

      // Check for nutrition/servings changes in notes (metadata)
      if (notes !== undefined && notes !== existingRecipe.notes) {
        try {
          const oldMetadata = existingRecipe.notes ? JSON.parse(existingRecipe.notes) : null
          const newMetadata = notes ? JSON.parse(notes) : null
          
          if (oldMetadata?.nutrition && newMetadata?.nutrition && 
              JSON.stringify(oldMetadata.nutrition) !== JSON.stringify(newMetadata.nutrition)) {
            await saveRecipeVersion({
              recipe_id: id,
              user_id,
              field_changed: 'nutrition',
              previous_value: oldMetadata.nutrition,
              new_value: newMetadata.nutrition,
              description: 'User updated nutrition information',
            })
          }
          
          if (oldMetadata?.servings !== newMetadata?.servings) {
            await saveRecipeVersion({
              recipe_id: id,
              user_id,
              field_changed: 'servings',
              previous_value: oldMetadata?.servings || null,
              new_value: newMetadata?.servings || null,
              description: `User updated servings from ${oldMetadata?.servings || 'N/A'} to ${newMetadata?.servings || 'N/A'}`,
            })
          }
        } catch (e) {
          // If notes aren't JSON, skip metadata versioning
        }
      }
    }

    // Update in Supabase using server client (bypasses RLS)
    const { data, error } = await supabase
      .from('recipes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Recipe not found' },
        { status: 404 }
      )
    }

    // Return the updated record
    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

