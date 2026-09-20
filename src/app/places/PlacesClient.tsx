'use client'

import Navigation from '../components/Navigation'
import PlacesList from '../components/PlacesList'

export default function PlacesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <Navigation forceTheme="tipjar" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlacesList />
      </main>
    </div>
  )
}
