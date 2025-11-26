export type IngredientGroup = {
  section: string
  items: string[]
}

export type InstructionGroup = {
  section: string
  steps: string[]
}

export interface Recipe {
  id: string
  title: string
  rating: number | null
  tags: string[] | null
  ingredients: (string | IngredientGroup)[] | null
  image_url: string | null
  instructions: string | InstructionGroup[] | null
  created_at: string | null
  cookbookSource: string | null
  source_url?: string | null
  notes?: string | null
  expected_matches?: Record<string, string[]> | null
  created_by?: string | null
  creator?: {
    id: string
    name: string
    avatar_url: string
  } | null
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
}

