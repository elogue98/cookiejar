import { requireFamilyPage } from '@/lib/serverPageAuth'
import { createServerClient } from '@/lib/supabase/server'
import HomePageContent from './components/HomePageContent'
import type { Recipe } from '@/types/recipe'
import { createSignedRecipeImageUrls } from '@/lib/imageUrls'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function Home() {
  await requireFamilyPage()
  const supabase = await createServerClient()
  const recipesPromise = supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })

  // Ratings do not depend on recipes; start them while the collection loads.
  const ratingsPromise = (async () => {
    const averages: Record<string, number> = {}
    try {
      const { data, error } = await supabase.from('ratings').select('recipe_id, rating')
      if (error) {
        if (error.code !== '42P01' && !error.message.includes('does not exist')) {
          console.error('Error fetching ratings:', { code: error.code })
        }
      } else if (data) {
        const grouped: Record<string, number[]> = {}
        for (const rating of data) {
          (grouped[rating.recipe_id] ??= []).push(rating.rating)
        }
        for (const [id, ratings] of Object.entries(grouped)) {
          averages[id] = Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10
        }
      }
    } catch {
      console.error('Error fetching ratings')
    }
    return averages
  })()

  const { data: recipes, error } = await recipesPromise
  if (error) console.error('Error fetching recipes:', { code: error.code })
  const recipeList: Recipe[] = Array.isArray(recipes) ? recipes : []
  const imageUrlsPromise = createSignedRecipeImageUrls(supabase, recipeList.map(recipe => recipe.image_path))
  const creatorIds = [...new Set(recipeList.map(recipe => recipe.created_by)
    .filter((id): id is string => typeof id === 'string' && id.length > 0))]

  const creatorsPromise = (async () => {
    const creatorsMap: Record<string, { id: string; name: string; avatar_url: string }> = {}
    if (creatorIds.length > 0) {
      try {
        const { data, error } = await supabase.from('users').select('id, name, avatar_url').in('id', creatorIds)
        if (!error && data) {
          for (const creator of data) creatorsMap[creator.id] = creator
        }
      } catch {
        console.error('Error fetching creators')
      }
    }
    return creatorsMap
  })()

  const [averageRatingsMap, creatorsMap, imageUrls] = await Promise.all([
    ratingsPromise, creatorsPromise, imageUrlsPromise,
  ])
  const recipesWithAverageRatings: Recipe[] = recipeList.map(recipe => ({
    ...recipe,
    image_url: recipe.image_path ? imageUrls.get(recipe.image_path) ?? null : null,
    rating: averageRatingsMap[recipe.id] ?? recipe.rating,
    created_by: recipe.created_by || null,
    creator: recipe.created_by ? creatorsMap[recipe.created_by] ?? null : null,
  }))

  return (
    <HomePageContent
      recipes={recipesWithAverageRatings}
      errorMessage={error ? 'Unable to load recipes right now.' : null}
      errorHint={null}
    />
  )
}
