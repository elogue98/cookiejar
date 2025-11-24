import { createServerClient } from './supabaseClient'

interface SaveRecipeVersionParams {
  recipe_id: string
  user_id: string
  field_changed: string
  previous_value: any
  new_value: any
  description?: string
}

/**
 * Saves a recipe version record to track changes
 */
export async function saveRecipeVersion({
  recipe_id,
  user_id,
  field_changed,
  previous_value,
  new_value,
  description,
}: SaveRecipeVersionParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerClient()

    const { error } = await supabase.from('recipe_versions').insert({
      recipe_id,
      user_id,
      field_changed,
      previous_value: previous_value !== null && previous_value !== undefined ? JSON.stringify(previous_value) : null,
      new_value: new_value !== null && new_value !== undefined ? JSON.stringify(new_value) : null,
      description: description || null,
    })

    if (error) {
      console.error('Error saving recipe version:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error saving recipe version:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

