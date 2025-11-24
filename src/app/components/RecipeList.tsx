'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import ImportRecipeModal from './ImportRecipeModal'
import { useUser } from '@/lib/userContext'

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
  created_by?: string | null
  creator?: {
    id: string
    name: string
    avatar_url: string
  } | null
}

interface RecipeListProps {
  recipes: Recipe[]
}

type FilterMode = 'all' | 'mine'

export default function RecipeList({ recipes }: RecipeListProps) {
  const { user } = useUser()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState('date-desc')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isSortDropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false)
      }
    }

    // Delay adding listener to avoid immediate closure
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 250)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isSortDropdownOpen])

  // Helper function to sort recipes
  function sortRecipes(recipesToSort: Recipe[], sortOption: string): Recipe[] {
    switch (sortOption) {
      case 'rating-desc':
        return [...recipesToSort].sort((a, b) => {
          const ratingA = a.rating ?? 0
          const ratingB = b.rating ?? 0
          return ratingB - ratingA
        })
      case 'rating-asc':
        return [...recipesToSort].sort((a, b) => {
          const ratingA = a.rating ?? 0
          const ratingB = b.rating ?? 0
          return ratingA - ratingB
        })
      case 'date-desc':
        return [...recipesToSort].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateB - dateA
        })
      case 'date-asc':
        return [...recipesToSort].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateA - dateB
        })
      default:
        return recipesToSort
    }
  }

  // Filter recipes based on unified search (title, ingredients, tags) AND ownership
  const filteredRecipes = useMemo(() => {
    let filtered = recipes

    // 1. Filter by ownership (My Recipes vs All)
    if (filterMode === 'mine' && user) {
      filtered = filtered.filter(recipe => recipe.created_by === user.id)
    }

    // 2. Filter by search term
    if (searchTerm.trim()) {
      // Split search query into tokens (words)
      const searchTokens = searchTerm
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)

      if (searchTokens.length > 0) {
        // Filter and rank recipes
        const recipesWithScores = filtered.map((recipe) => {
          const titleLower = recipe.title.toLowerCase()
          
          // Handle ingredients: can be string[] or structured format { section: string; items: string[] }[]
          let ingredientsText = ''
          if (recipe.ingredients && recipe.ingredients.length > 0) {
            // Check if it's structured format (first item is an object with 'items' property)
            if (typeof recipe.ingredients[0] === 'object' && recipe.ingredients[0] !== null && 'items' in recipe.ingredients[0]) {
              // Structured format: extract all items from all sections
              ingredientsText = (recipe.ingredients as unknown as { section: string; items: string[] }[])
                .flatMap((group) => group.items || [])
                .join(' ')
                .toLowerCase()
            } else {
              // Simple string array format
              ingredientsText = (recipe.ingredients as string[]).join(' ').toLowerCase()
            }
          }
          
          const tagsText = recipe.tags?.join(' ').toLowerCase() || ''

          // Check if ANY token matches in title, ingredients, or tags
          let matchesAnyToken = false
          let score = 0

          for (const token of searchTokens) {
            const titleMatch = titleLower.includes(token)
            const ingredientMatch = ingredientsText.includes(token)
            const tagMatch = tagsText.includes(token)

            if (titleMatch || ingredientMatch || tagMatch) {
              matchesAnyToken = true
              // Rank: title matches are highest priority
              if (titleMatch) score += 3
              if (ingredientMatch) score += 2
              if (tagMatch) score += 1
            }
          }

          return { recipe, matchesAnyToken, score }
        })

        // Filter to only matching recipes and sort by score (highest first)
        filtered = recipesWithScores
          .filter((item) => item.matchesAnyToken)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.recipe)
      }
    }

    // 3. Apply sorting
    return sortRecipes(filtered, sortOption)
  }, [recipes, searchTerm, sortOption, filterMode, user])

  // Set initial filter mode based on user presence (optional - defaults to 'all')
  // If you want logged-in users to see "My Recipes" by default, uncomment below:
  /* 
  useEffect(() => {
    if (user) setFilterMode('mine')
  }, [user])
  */

  return (
    <section className="w-full">
      {/* Header Row: Title, Filter Toggle, and Add Button */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2B2B2B]">
            {filterMode === 'mine' ? 'My Recipes' : 'All Recipes'}
          </h1>
          <p className="text-[#2B2B2B]/60 mt-1">
            {filterMode === 'mine' 
              ? "Your personal collection of culinary experiments." 
              : "Browse all recipes from the collection."}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Toggle Filter (Only show if user is logged in) */}
          {user && (
            <div 
              onClick={() => setFilterMode(prev => prev === 'all' ? 'mine' : 'all')}
              className="bg-white p-1 rounded-full border border-gray-200 flex items-center shadow-sm relative cursor-pointer hover:bg-gray-50 transition-colors select-none"
            >
              {/* Sliding Background Pill */}
              <div
                className={`absolute top-1 bottom-1 rounded-full bg-[#F9E7B2] shadow-sm transition-all duration-300 ease-out border border-[#DDC57A]`}
                style={{
                  left: filterMode === 'all' ? '4px' : '50%',
                  width: 'calc(50% - 4px)',
                }}
              />
              
              <div
                className={`relative z-10 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300 text-center whitespace-nowrap ${
                  filterMode === 'all' 
                    ? 'text-[#CE7E5A]' 
                    : 'text-[#2B2B2B]/60'
                }`}
                style={{ minWidth: '120px' }}
              >
                All Recipes
              </div>
              <div
                className={`relative z-10 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300 text-center whitespace-nowrap ${
                  filterMode === 'mine' 
                    ? 'text-[#CE7E5A]' 
                    : 'text-[#2B2B2B]/60'
                }`}
                style={{ minWidth: '120px' }}
              >
                My Recipes
              </div>
            </div>
          )}

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-[#D34E4E] text-white px-6 py-3 rounded-[20px] font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#D34E4E]/20 whitespace-nowrap"
          >
            + New Recipe
          </button>
        </div>
      </div>

      {/* Search + Sort Row */}
      <div className="w-full mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by title, ingredient, or tag..."
            className="flex-1 w-full px-5 py-3 bg-white rounded-[16px] border-0 shadow-[0_2px_10px_rgba(0,0,0,0.03)] focus:ring-2 focus:ring-[#D34E4E]/20 focus:outline-none text-[#2B2B2B]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          {/* Sort Dropdown */}
          <div ref={sortDropdownRef} className="relative shrink-0 w-full sm:w-auto z-20">
            <button
              type="button"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="w-full sm:w-auto flex items-center justify-between gap-3 px-5 py-3 bg-white rounded-[16px] text-sm font-medium text-[#D34E4E] hover:bg-white/80 transition-colors shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
            >
              <span>
                {sortOption === 'date-desc' && 'Date (Newest)'}
                {sortOption === 'date-asc' && 'Date (Oldest)'}
                {sortOption === 'rating-desc' && 'Rating (High)'}
                {sortOption === 'rating-asc' && 'Rating (Low)'}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transform transition-transform duration-200 ${isSortDropdownOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9L1 4H11L6 9Z" fill="currentColor" />
              </svg>
            </button>
            
            {isSortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,0.1)] overflow-hidden py-1 border border-gray-100 z-50">
                {[
                  { value: 'date-desc', label: 'Date (Newest First)' },
                  { value: 'date-asc', label: 'Date (Oldest First)' },
                  { value: 'rating-desc', label: 'Rating (High → Low)' },
                  { value: 'rating-asc', label: 'Rating (Low → High)' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortOption(option.value)
                      setIsSortDropdownOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[#F9E7B2]/20 ${
                      sortOption === option.value ? 'text-[#D34E4E] font-semibold bg-[#F9E7B2]/10' : 'text-[#2B2B2B]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <ImportRecipeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Recipe List */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#2B2B2B]/60 text-lg">
            {recipes.length === 0
              ? "No recipes found."
              : filterMode === 'mine'
              ? "You haven't created any recipes yet."
              : "No recipes match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="group bg-white rounded-[24px] p-3 hover:-translate-y-1 transition-all duration-300 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex flex-col"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] rounded-[20px] overflow-hidden mb-4 bg-[#F9E7B2] shrink-0">
                {recipe.image_url ? (
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🍪</div>
                )}
              </div>

              {/* Content */}
              <div className="px-2 pb-2 flex flex-col flex-grow">
                <h3 className="font-bold text-lg mb-3 text-[#2B2B2B] leading-tight group-hover:text-[#D34E4E] transition-colors line-clamp-2 min-h-[1.5em]">
                  {recipe.title}
                </h3>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {recipe.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="px-3 py-1 bg-[#F9E7B2]/30 text-[#CE7E5A] text-xs font-semibold rounded-full">
                      {tag}
                    </span>
                  ))}
                  {(recipe.tags?.length || 0) > 3 && (
                    <span className="px-2 py-1 text-[#CE7E5A]/60 text-xs font-semibold">
                      +{recipe.tags!.length - 3}
                    </span>
                  )}
                </div>

                <div className="mt-auto pt-3 border-t border-gray-100 flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    {recipe.creator ? (
                      <>
                        <img src={recipe.creator.avatar_url} className="w-6 h-6 rounded-full bg-gray-200 object-cover" alt="" />
                        <span className="text-xs font-medium text-gray-500 truncate max-w-[100px]">{recipe.creator.name}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Unknown Chef</span>
                    )}
                  </div>
                  
                  {recipe.rating ? (
                    <div className="flex items-center gap-1 text-[#D34E4E] font-bold text-sm">
                      <span>★</span>
                      <span>{recipe.rating}/10</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">No rating</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
