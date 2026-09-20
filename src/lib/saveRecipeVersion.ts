import { createServerClient } from './supabase/server'
import { requireFamilyProfile } from './auth'
import type { Json } from '@/types/json'

interface SaveRecipeVersionParams {
  recipe_id: string
  field_changed: string
  previous_value: Json | Record<string, unknown> | unknown[] | null
  new_value: Json | Record<string, unknown> | unknown[] | null
  description?: string
}

/**
 * Saves a recipe version record to track changes
 */
export async function saveRecipeVersion({
  recipe_id,
  field_changed,
  previous_value,
  new_value,
  description,
}: SaveRecipeVersionParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { profileId } = await requireFamilyProfile()
    const supabase = await createServerClient()

    const { error } = await supabase.from('recipe_versions').insert({
      recipe_id,
      user_id: profileId,
      field_changed,
      previous_value: previous_value !== null && previous_value !== undefined ? JSON.stringify(previous_value) : null,
      new_value: new_value !== null && new_value !== undefined ? JSON.stringify(new_value) : null,
      description: description || null,
    })

    if (error) {
      console.error('Error saving recipe version:', error)
      return { success: false, error: 'Unable to save recipe history' }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error saving recipe version:', error)
    return {
      success: false,
      error: 'Unable to save recipe history',
    }
  }
}
