import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import RecipeList from './components/RecipeList'
import Logo from './components/Logo'

interface Recipe {
  id: string
  title: string
  rating: number | null
  tags: string[] | null
  ingredients: string[] | null
  image_url: string | null
  instructions: string | null
  created_at: string | null
  cookbookSource: string | null
}

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

  const recipeList: Recipe[] = recipes || []

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <header className="border-b" style={{ borderColor: 'rgba(211, 78, 78, 0.1)', background: '#F9E7B2' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="flex items-center gap-3 text-3xl font-bold transition-colors cursor-pointer" style={{ color: 'var(--text-main)' }}>
            <Logo size={48} />
            <span>Cookie Jar</span>
          </Link>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg border border-red-600 bg-red-50 p-4">
            <p className="text-red-700 font-semibold mb-2">Error loading recipes</p>
            <p className="text-red-600 text-sm">
              {error.message || 'Unable to fetch recipes from database'}
            </p>
            <p className="text-red-700 text-xs mt-2">
              {error.hint || 'Please check your Supabase connection and ensure the "recipes" table exists.'}
            </p>
          </div>
        ) : (
          <RecipeList recipes={recipeList} />
        )}
      </main>
    </div>
  )
}
