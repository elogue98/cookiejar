export interface Recipe {
  id: string
  title: string
  rating: number | null
  tags: string[] | null
  ingredients: string[] | null
  image_url: string | null
  instructions: string | null
  created_at: string | null
  cookbookSource: string | null
  created_by?: string | null
  creator?: {
    id: string
    name: string
    avatar_url: string
  } | null
}


