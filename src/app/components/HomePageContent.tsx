'use client'

import { useUser } from '@/lib/userContext'
import type { Recipe } from '@/types/recipe'
import Navigation from '@/app/components/Navigation'
import RecipeList from '@/app/components/RecipeList'
import WelcomeLanding from '@/app/components/WelcomeLanding'
import KitchenLoading from './KitchenLoading'

interface HomePageContentProps {
  recipes: Recipe[]
  errorMessage?: string | null
  errorHint?: string | null
}

export default function HomePageContent({ recipes, errorMessage, errorHint }: HomePageContentProps) {
  const { user, isLoading } = useUser()

  if (isLoading) {
    return (
      <div 
        className="min-h-screen transition-colors duration-300"
        style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
      >
        <Navigation forceTheme="cookie" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <KitchenLoading />
        </main>
      </div>
    )
  }

  if (!user) {
    return <WelcomeLanding />
  }

  return (
    <div 
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <Navigation forceTheme="cookie" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <>
          {errorMessage ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-red-400 font-semibold mb-2">Error loading recipes</p>
              <p className="text-red-400/80 text-sm">{errorMessage || 'Unable to fetch recipes from database'}</p>
              {errorHint && <p className="text-red-400/60 text-xs mt-2">{errorHint}</p>}
            </div>
          ) : (
            <RecipeList recipes={recipes} />
          )}
        </>
      </main>
    </div>
  )
}
