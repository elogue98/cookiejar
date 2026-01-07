'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchPlaces, Place } from '@/lib/places'
import PlacesMap from './Map'
import PlaceStarRating from './PlaceStarRating'
import { useUser } from '@/lib/userContext'

export default function PlacesList() {
  const { user } = useUser()
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [textFilter, setTextFilter] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [ratedFilter, setRatedFilter] = useState<'all' | 'rated' | 'unrated'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'rating'>('recent')
  const [showMap, setShowMap] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchPlaces()
        setPlaces(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load places')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [showAllTags, setShowAllTags] = useState(false)

  // Collect top tags (limit to keep UI tidy)
  const IGNORED_TAGS = ['establishment', 'point of interest', 'food', 'store']
  const tagCounts = places.reduce<Record<string, number>>((acc, place) => {
    place.cuisine_tags.forEach((tag) => {
      if (IGNORED_TAGS.includes(tag.toLowerCase())) return
      acc[tag] = (acc[tag] || 0) + 1
    })
    return acc
  }, {})

  const allTagsSorted = Object.entries(tagCounts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .map(([tag]) => tag)

  const VISIBLE_TAGS_COUNT = 15
  const visibleTags = showAllTags ? allTagsSorted : allTagsSorted.slice(0, VISIBLE_TAGS_COUNT)
  
  // Ensure selected tag is always visible
  if (tagFilter && !visibleTags.includes(tagFilter) && allTagsSorted.includes(tagFilter)) {
    visibleTags.push(tagFilter)
  }

  const searchTerms = textFilter
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const filteredPlaces = places
    .filter((p) => {
      const matchesText =
        searchTerms.length === 0 ||
        searchTerms.every((term) => {
          const inName = p.name.toLowerCase().includes(term)
          const inAddress = p.address?.toLowerCase().includes(term)
          const inTags = p.cuisine_tags.some((tag) => tag.toLowerCase().includes(term))
          return inName || inAddress || inTags
        })
      const matchesTag = !tagFilter || p.cuisine_tags.includes(tagFilter)
      const isRated =
        p.rating_average !== null && p.rating_average !== undefined && p.rating_count && p.rating_count > 0
      const matchesRated = ratedFilter === 'all' ? true : ratedFilter === 'rated' ? isRated : !isRated
      return matchesText && matchesTag && matchesRated
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        const ra = a.rating_average ?? 0
        const rb = b.rating_average ?? 0
        if (rb !== ra) return rb - ra
        return (b.rating_count ?? 0) - (a.rating_count ?? 0)
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  const selectedPlace = selectedPlaceId
    ? places.find((p) => p.id === selectedPlaceId)
    : null

  const handleRated = (placeId: string, average: number | null, total: number) => {
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === placeId ? { ...p, rating_average: average, rating_count: total } : p
      )
    )
  }

  const handleSaveNote = async (placeId: string, note: string) => {
    try {
      const res = await fetch(`/api/places/${placeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note }),
      })
      if (!res.ok) throw new Error('Failed to update note')
      
      setPlaces((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, notes: note } : p))
      )
      setEditingNoteId(null)
    } catch (err) {
      console.error('Error saving note:', err)
      alert('Failed to save note')
    }
  }

  const handleDelete = async (placeId: string, name: string) => {
    const ok = window.confirm(`Delete "${name}" from Tip Jar?`)
    if (!ok) return
    try {
      const res = await fetch(`/api/places/${placeId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to delete place')
        return
      }
      setPlaces((prev) => prev.filter((p) => p.id !== placeId))
      if (selectedPlaceId === placeId) {
        setSelectedPlaceId(null)
      }
    } catch (err) {
      console.error('Delete place failed', err)
      alert('Failed to delete place. Please try again.')
    }
  }

  useEffect(() => {
    if (!showMap) return
    if (!filteredPlaces.length) {
      if (selectedPlaceId) setSelectedPlaceId(null)
      return
    }
    const exists = filteredPlaces.some((p) => p.id === selectedPlaceId)
    if (!exists && selectedPlaceId) {
      setSelectedPlaceId(null)
    }
  }, [showMap, filteredPlaces, selectedPlaceId])

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>Tip Jar</h1>
          <p style={{ color: 'var(--text-muted)' }}>Your saved food & drink spots</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/places/import"
            className="px-5 py-2.5 font-medium rounded-full hover:opacity-90 transition-all flex items-center gap-2 shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--bg-main)' }}
          >
            <span>+</span> Import from Maps
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <input
              type="text"
              placeholder="Search places..."
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all outline-none"
              style={{ color: 'var(--text-main)' }}
            />
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors group-focus-within:text-[var(--primary)]"
              style={{ color: 'var(--text-muted)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-5 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: showMap ? 'var(--primary)' : 'var(--bg-card)',
              color: showMap ? 'var(--bg-main)' : 'var(--text-main)',
              border: showMap ? 'none' : '1px solid var(--border-color)'
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" />
            </svg>
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {allTagsSorted.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setTagFilter(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!tagFilter ? 'shadow-sm' : 'hover:bg-[var(--bg-card)]'}`}
                style={{
                  backgroundColor: !tagFilter ? 'var(--primary)' : 'transparent',
                  color: !tagFilter ? 'var(--bg-main)' : 'var(--text-muted)',
                  border: !tagFilter ? 'none' : '1px solid var(--border-color)'
                }}
              >
                All
              </button>
              {visibleTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${tag === tagFilter ? 'shadow-sm' : 'hover:bg-[var(--bg-card)]'}`}
                  style={{
                    backgroundColor: tag === tagFilter ? 'var(--primary)' : 'transparent',
                    color: tag === tagFilter ? 'var(--bg-main)' : 'var(--text-muted)',
                    border: tag === tagFilter ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  {tag}
                  {tagCounts[tag] > 1 && (
                    <span className="opacity-60 text-xs">
                      {tagCounts[tag]}
                    </span>
                  )}
                </button>
              ))}
              {allTagsSorted.length > VISIBLE_TAGS_COUNT && (
                <button
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full hover:bg-[var(--bg-card)] transition-colors"
                  style={{ color: 'var(--primary)' }}
                >
                  {showAllTags ? 'Show Less' : `+${allTagsSorted.length - VISIBLE_TAGS_COUNT} more`}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center ml-auto">
            <div className="flex p-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)]">
              {(['all', 'rated', 'unrated'] as const).map((state) => (
                <button
                  key={state}
                  onClick={() => setRatedFilter(state)}
                  className="px-4 py-1 rounded-full text-sm font-medium transition-all"
                  style={{
                    backgroundColor: ratedFilter === state ? 'var(--bg-main)' : 'transparent',
                    color: ratedFilter === state ? 'var(--text-main)' : 'var(--text-muted)',
                    boxShadow: ratedFilter === state ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {state === 'all' ? 'All' : state === 'rated' ? 'Rated' : 'Unrated'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)]">
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'rating')}
                className="text-sm bg-transparent outline-none cursor-pointer font-medium"
                style={{
                  color: 'var(--text-main)',
                }}
              >
                <option value="recent">Most recent</option>
                <option value="rating">Highest rated</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="h-48 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--bg-card)' }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-500/10 rounded-xl border border-red-500/20">
          <p className="text-red-400">{error}</p>
        </div>
      ) : filteredPlaces.length === 0 ? (
        <div 
          className="text-center py-12 rounded-xl"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="mb-4 font-medium" style={{ color: 'var(--text-muted)' }}>No places found matching your filters.</p>
          <Link 
            href="/places/import" 
            className="hover:underline"
            style={{ color: 'var(--primary)' }}
          >
            Import a new place
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List View */}
          <div className={`space-y-4 ${showMap ? 'lg:col-span-1' : 'lg:col-span-3 grid lg:grid-cols-3 lg:space-y-0 lg:gap-6'}`}>
            {filteredPlaces.map((place) => (
              <div
                key={place.id}
                onClick={() => setSelectedPlaceId(place.id)}
                className="group relative p-6 rounded-2xl transition-all cursor-pointer hover:-translate-y-1 hover:shadow-xl"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: selectedPlaceId === place.id && showMap 
                    ? '2px solid var(--primary)' 
                    : '1px solid var(--border-color)',
                  boxShadow: selectedPlaceId === place.id && showMap 
                    ? '0 0 20px rgba(20, 184, 166, 0.15)' 
                    : undefined
                }}
              >
                <div className="flex justify-between items-start mb-3 gap-3">
                  <h3 className="font-bold text-xl leading-tight line-clamp-1" style={{ color: 'var(--text-main)' }}>
                    {place.name}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {place.status === 'visited' && (
                      <span 
                        className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full"
                        style={{ 
                          backgroundColor: 'var(--bg-main)', 
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)'
                        }}
                      >
                        Visited
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(place.id, place.name)
                      }}
                      className="p-1.5 rounded-full hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete place"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {place.address && (
                  <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    {place.address}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-5">
                  {place.cuisine_tags.slice(0, 3).map((tag) => (
                    <span 
                      key={tag} 
                      className="px-2.5 py-1 text-xs font-medium rounded-full"
                      style={{ 
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  {place.cuisine_tags.length > 3 && (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                      +{place.cuisine_tags.length - 3}
                    </span>
                  )}
                </div>
                
                {/* Note Section */}
                <div 
                  className="mt-3 pt-3 border-t border-[var(--border-color)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingNoteId === place.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full text-sm p-2 rounded bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveNote(place.id, noteDraft)}
                          className="text-xs px-3 py-1 bg-[var(--primary)] text-white rounded font-medium hover:opacity-90"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group/note flex items-start gap-2 min-h-[24px]">
                      <div className="mt-0.5 text-[var(--text-muted)] shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      {place.notes ? (
                        <p 
                          className="text-sm italic text-[var(--text-muted)] line-clamp-2 hover:line-clamp-none transition-all cursor-text flex-1"
                          onClick={() => {
                            setNoteDraft(place.notes || '')
                            setEditingNoteId(place.id)
                          }}
                          title="Click to edit note"
                        >
                          {place.notes}
                        </p>
                      ) : (
                        <button
                          onClick={() => {
                            setNoteDraft('')
                            setEditingNoteId(place.id)
                          }}
                          className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors opacity-60 hover:opacity-100"
                        >
                          Add a note...
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4 mt-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      {place.rating_average !== null && place.rating_average !== undefined ? (
                        <>
                          <input
                            type="text"
                            defaultValue={place.rating_average?.toFixed(1) ?? ''}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const val = parseFloat(e.currentTarget.value)
                                if (!isNaN(val) && val >= 1 && val <= 10) {
                                  if (!user?.id) {
                                    alert('Please log in to rate places')
                                    return
                                  }
                                  
                                  // Optimistic update
                                  handleRated(place.id, val, place.rating_count ? place.rating_count : 1)
                                  
                                  try {
                                    const res = await fetch(`/api/places/${place.id}/ratings`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        userId: user.id,
                                        rating: val,
                                      }),
                                    })
                                    const data = await res.json()
                                    if (res.ok && data.success && data.data) {
                                      handleRated(place.id, data.data.averageRating, data.data.totalRatings)
                                    } else {
                                      // Revert or show error?
                                      console.error('Rating update failed', data.error)
                                    }
                                  } catch (err) {
                                    console.error('Error updating rating:', err)
                                  }
                                  e.currentTarget.blur()
                                }
                              }
                            }}
                            className="text-2xl font-bold w-12 bg-transparent border-b border-transparent hover:border-[var(--border-color)] focus:border-[var(--primary)] focus:outline-none p-0"
                            style={{ color: 'var(--text-main)' }}
                          />
                          <span className="text-sm self-end pb-1" style={{ color: 'var(--text-muted)' }}>/ 10</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                          No rating
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="scale-90 origin-right">
                      <PlaceStarRating
                        placeId={place.id}
                        initialAverage={place.rating_average ?? null}
                        onRated={(avg, total) => handleRated(place.id, avg, total)}
                      />
                    </div>
                  </div>
                </div>

                <div 
                  className="flex gap-4 pt-4 mt-auto"
                  style={{ borderTop: '1px solid var(--border-color)' }}
                >
                  {place.url && (
                    <a
                      href={place.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold flex items-center gap-1.5 transition-colors hover:text-[var(--primary)]"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Google Maps
                    </a>
                  )}
                  {place.website && (
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold flex items-center gap-1.5 transition-colors hover:text-[var(--primary)]"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Website
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Map View */}
          {showMap && (
            <div
              className="lg:col-span-2 sticky top-8 h-[calc(100vh-8rem)] rounded-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <PlacesMap
                places={filteredPlaces}
                selectedPlaceId={selectedPlaceId}
                onSelect={(id) => setSelectedPlaceId(id)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
