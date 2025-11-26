import { supabase } from '@/lib/supabaseClient'
import HomePageContent from './components/HomePageContent'
import type { Recipe } from '@/types/recipe'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching recipes:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      fullError: JSON.stringify(error, null, 2)
    })
  }

  // Fetch all ratings for all recipes in one query
  const averageRatingsMap: Record<string, number | null> = {}
  try {
    const { data: allRatings, error: ratingsError } = await supabase
      .from('ratings')
      .select('recipe_id, rating')

    // If ratings table doesn't exist, use recipe.rating as fallback
    if (ratingsError) {
      if (ratingsError.code !== '42P01' && !ratingsError.message.includes('does not exist')) {
        console.error('Error fetching ratings:', ratingsError)
      }
    } else if (allRatings) {
      // Group ratings by recipe_id and calculate averages
      const ratingsByRecipe: Record<string, number[]> = {}
      allRatings.forEach((r) => {
        if (!ratingsByRecipe[r.recipe_id]) {
          ratingsByRecipe[r.recipe_id] = []
        }
        ratingsByRecipe[r.recipe_id].push(r.rating)
      })

      // Calculate average for each recipe
      Object.keys(ratingsByRecipe).forEach((recipeId) => {
        const ratings = ratingsByRecipe[recipeId]
        const sum = ratings.reduce((acc, r) => acc + r, 0)
        const average = Math.round((sum / ratings.length) * 10) / 10
        averageRatingsMap[recipeId] = average
      })
    }
  } catch (error) {
    // If ratings table doesn't exist, use recipe.rating as fallback
    console.error('Error fetching ratings:', error)
  }

  const recipeList: Recipe[] = Array.isArray(recipes) ? recipes : []

  // Fetch all creators for recipes that have created_by
  const creatorIds = [
    ...new Set(
      recipeList
        .map((r) => r.created_by)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ]
  const creatorsMap: Record<string, { id: string; name: string; avatar_url: string }> = {}
  
  if (creatorIds.length > 0) {
    try {
      const { data: creators, error: creatorsError } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', creatorIds)
      
      if (!creatorsError && creators) {
        creators.forEach(creator => {
          creatorsMap[creator.id] = creator
        })
      }
    } catch (error) {
      console.error('Error fetching creators:', error)
    }
  }

  // Map recipes with average ratings and creator info
  const recipesWithAverageRatings: Recipe[] = recipeList.map((recipe) => {
    const averageRating = averageRatingsMap[recipe.id] ?? recipe.rating
    const createdBy = recipe.created_by
    const creator = createdBy && creatorsMap[createdBy] ? creatorsMap[createdBy] : null
    
    return {
      ...recipe,
      rating: averageRating,
      created_by: createdBy || null,
      creator: creator
    }
  })

  const errorMessage = error?.message ?? null
  const errorHint = error
    ? error.hint || 'Please check your Supabase connection and ensure the "recipes" table exists.'
    : null

  return (
    <HomePageContent
      recipes={recipesWithAverageRatings}
      errorMessage={errorMessage}
      errorHint={errorHint}
    />
  )
}
