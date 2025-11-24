'use client'

import { useUser } from '@/lib/userContext'
import type { Recipe } from '@/types/recipe'
import Navigation from '@/app/components/Navigation'
import RecipeList from '@/app/components/RecipeList'
import WelcomeLanding from '@/app/components/WelcomeLanding'

interface HomePageContentProps {
  recipes: Recipe[]
  errorMessage?: string | null
  errorHint?: string | null
}

export default function HomePageContent({ recipes, errorMessage, errorHint }: HomePageContentProps) {
  const { user, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F4F6] text-[#2B2B2B]">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
            <p className="text-slate-600 font-semibold">Loading your kitchen...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!user) {
    return <WelcomeLanding />
  }

  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#2B2B2B]">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {errorMessage ? (
          <div className="rounded-lg border border-red-600 bg-red-50 p-4">
            <p className="text-red-700 font-semibold mb-2">Error loading recipes</p>
            <p className="text-red-600 text-sm">{errorMessage || 'Unable to fetch recipes from database'}</p>
            {errorHint && (
              <p className="text-red-700 text-xs mt-2">
                {errorHint}
              </p>
            )}
          </div>
        ) : (
          <RecipeList recipes={recipes} />
        )}
      </main>
    </div>
  )
}


