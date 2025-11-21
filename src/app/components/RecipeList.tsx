'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import ImportRecipeModal from './ImportRecipeModal'
import UserAvatar from './UserAvatar'

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

export default function RecipeList({ recipes }: RecipeListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState('date-desc')
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

  // Filter recipes based on unified search (title, ingredients, tags)
  const filteredRecipes = useMemo(() => {
    let filtered: Recipe[]

    if (!searchTerm.trim()) {
      filtered = recipes
    } else {
      // Split search query into tokens (words)
      const searchTokens = searchTerm
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)

      if (searchTokens.length === 0) {
        filtered = recipes
      } else {
        // Filter and rank recipes
        const recipesWithScores = recipes.map((recipe) => {
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

    // Apply sorting to filtered results
    return sortRecipes(filtered, sortOption)
  }, [recipes, searchTerm, sortOption])

  return (
    <section className="w-full">
      {/* Search + Sort + Import Row */}
      <div className="w-full mb-6" style={{ position: 'relative' }}>
        <div className="flex flex-col sm:flex-row items-center gap-4" style={{ position: 'relative' }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by title, ingredient, or tag..."
            className="flex-1 max-w-[85%] px-4 py-3 bg-white rounded-lg border focus:ring-2 focus:ring-[#D34E4E] focus:border-[#D34E4E] focus:outline-none"
            style={{
              borderColor: 'rgba(211, 78, 78, 0.2)',
              color: 'var(--text-main)'
            }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Sort Dropdown */}
          <div ref={sortDropdownRef} className="relative" style={{ zIndex: 50, position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsSortDropdownOpen(!isSortDropdownOpen)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border text-sm font-medium transition-all hover:shadow-md"
              style={{
                borderColor: '#D34E4E',
                color: '#D34E4E',
                cursor: 'pointer',
                width: '180px',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 1
              }}
            >
              <span>
                {sortOption === 'date-desc' && 'Date (Newest First)'}
                {sortOption === 'date-asc' && 'Date (Oldest First)'}
                {sortOption === 'rating-desc' && 'Rating (High → Low)'}
                {sortOption === 'rating-asc' && 'Rating (Low → High)'}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  transform: isSortDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0
                }}
              >
                <path
                  d="M6 9L1 4H11L6 9Z"
                  fill="#D34E4E"
                />
              </svg>
            </button>
            
            {isSortDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid rgba(211, 78, 78, 0.2)',
                  width: '180px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 10000,
                  overflow: 'hidden',
                  marginTop: 0,
                  pointerEvents: 'auto'
                }}
              >
                {[
                  { value: 'date-desc', label: 'Date (Newest First)' },
                  { value: 'date-asc', label: 'Date (Oldest First)' },
                  { value: 'rating-desc', label: 'Rating (High → Low)' },
                  { value: 'rating-asc', label: 'Rating (Low → High)' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSortOption(option.value)
                      setIsSortDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                    style={{
                      color: sortOption === option.value ? '#D34E4E' : 'var(--text-main)',
                      backgroundColor: sortOption === option.value ? 'rgba(211, 78, 78, 0.08)' : 'transparent',
                      fontWeight: sortOption === option.value ? '600' : '400'
                    }}
                    onMouseEnter={(e) => {
                      if (sortOption !== option.value) {
                        e.currentTarget.style.backgroundColor = 'rgba(211, 78, 78, 0.05)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (sortOption !== option.value) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Import Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="shrink-0 px-8 py-3 font-medium transition-colors hover:opacity-90 whitespace-nowrap"
            style={{
              background: '#D34E4E',
              color: 'white',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Import Recipe
          </button>
        </div>
      </div>

      {/* Recipe Count */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-main)' }}>
          Recipes {filteredRecipes.length !== recipes.length && `(${filteredRecipes.length} of ${recipes.length})`}
        </h2>
      </div>

      {/* Import Modal */}
      <ImportRecipeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Recipe List */}
      {filteredRecipes.length === 0 ? (
        <p style={{ color: 'rgba(43, 43, 43, 0.8)' }}>
          {recipes.length === 0
            ? 'No recipes yet'
            : 'No recipes match your search criteria'}
        </p>
      ) : (
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
            width: '100%'
          }}
        >
          {filteredRecipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              style={{
                display: 'block',
                border: '1px solid rgba(211, 78, 78, 0.1)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                backgroundColor: 'white',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Image */}
              <div 
                style={{
                  width: '100%',
                  height: '180px',
                  backgroundColor: 'var(--accent-light)',
                  overflow: 'hidden',
                  position: 'relative',
                  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
                }}
              >
                {recipe.image_url ? (
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      if (target.parentElement) {
                        target.parentElement.innerHTML = `<div style="width:100%;height:180px;display:flex;align-items:center;justify-content:center;background-color:var(--accent-light);"><span style="font-size:32px;">🍪</span></div>`
                      }
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--accent-light)'
                  }}>
                    <span style={{ fontSize: '32px' }}>🍪</span>
                  </div>
                )}
                {/* Creator Avatar in corner */}
                {recipe.creator && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 10
                  }}>
                    <UserAvatar
                      src={recipe.creator.avatar_url}
                      alt={recipe.creator.name}
                      name={recipe.creator.name}
                      size="default"
                    />
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '14px' }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-main)',
                  marginBottom: '8px',
                  lineHeight: '1.4',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {recipe.title}
                </h3>

                {/* Rating and Tags */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  marginTop: '6px'
                }}>
                  {recipe.rating !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: 'var(--accent-gold)', fontSize: '12px' }}>★</span>
                      <span style={{ color: 'rgba(43, 43, 43, 0.8)', fontSize: '12px', fontWeight: '500' }}>
                        {recipe.rating}/10
                      </span>
                    </div>
                  )}
                  
                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
                      {recipe.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            padding: '4px 10px',
                            fontSize: '10px',
                            borderRadius: '20px',
                            backgroundColor: 'var(--accent-gold)',
                            color: 'var(--text-main)',
                            fontWeight: '500'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {recipe.tags.length > 2 && (
                        <span style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          color: 'rgba(43, 43, 43, 0.6)'
                        }}>
                          +{recipe.tags.length - 2}
                        </span>
                      )}
                    </div>
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

