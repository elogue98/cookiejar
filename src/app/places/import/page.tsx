'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navigation from '@/app/components/Navigation'
import { useUser } from '@/lib/userContext'

type ImportResponse = {
  success: boolean
  error?: string
  data?: {
    place: {
      id: string
      name: string
      address: string | null
      url: string | null
      website: string | null
      cuisine_tags?: string[]
    }
  }
}

export default function PlacesImportPage() {
  const router = useRouter()
  const { user, isLoading } = useUser()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debug, setDebug] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResponse['data'] | null>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError('Please paste a Google Maps place URL')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setDebug(null)

    try {
      const res = await fetch('/api/places/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
        }),
      })

      const data: ImportResponse = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to import place')
        const detailParts = [
          data.debug && (typeof data.debug === 'string' ? data.debug : JSON.stringify(data.debug)),
          data.google_status,
          data.google_error,
        ]
          .filter(Boolean)
          .join(' — ')
        if (detailParts) {
          setDebug(detailParts)
        }
      } else {
        setResult(data.data ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error importing place')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen transition-colors duration-300" 
      style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
    >
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="max-w-3xl">
          <h2 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text-main)' }}>
            Tip Jar: Import from Google Maps
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="url" className="block text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                Google Maps URL
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.google.com/maps/place/..."
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ 
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-red-400 font-semibold mb-2">Import Failed</p>
                <p className="text-red-400/80 text-sm">{error}</p>
                {debug && <p className="text-red-400/60 text-xs mt-2">Details: {debug}</p>}
              </div>
            )}

            {result && (
              <div 
                className="rounded-lg p-4 space-y-2"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--bg-main)'
                }}
              >
                <p className="font-semibold">Imported to Tip Jar</p>
                <p className="text-sm opacity-90">
                  Saved with auto-tags.{' '}
                  <Link href="/" className="underline font-medium">
                    View all places
                  </Link>
                </p>
                <div 
                  className="mt-2 p-3 rounded-lg"
                  style={{ 
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{result.place.name}</p>
                  {result.place.address && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{result.place.address}</p>
                  )}
                  {result.place.cuisine_tags?.length ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {result.place.cuisine_tags.map((tag) => (
                        <span 
                          key={tag} 
                          className="px-2 py-1 text-xs rounded-full"
                          style={{ 
                            backgroundColor: 'var(--accent-gold)',
                            color: 'var(--bg-main)'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex gap-3">
                    {result.place.url && (
                      <a
                        href={result.place.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium underline"
                        style={{ color: 'var(--primary)' }}
                      >
                        Open in Maps
                      </a>
                    )}
                    {result.place.website && (
                      <a
                        href={result.place.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium underline"
                        style={{ color: 'var(--primary)' }}
                      >
                        Website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-2 items-start">
              <div className="relative">
                {error === 'Please paste a Google Maps place URL' && !loading && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-2.5 rounded-lg shadow-xl bg-white border border-orange-200 text-xs font-bold text-orange-600 w-max z-20 animate-[bounce_1s_infinite]">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Please enter a URL.
                    </span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-orange-200"></div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: 'var(--primary)', 
                    color: 'var(--bg-main)', 
                    borderRadius: '14px' 
                  }}
                >
                  {loading ? 'Importing...' : 'Import place'}
                </button>
              </div>
              <Link
                href="/"
                className="px-8 py-3 font-medium transition-colors hover:opacity-90"
                style={{ 
                  backgroundColor: 'var(--accent-gold)', 
                  color: 'var(--bg-main)', 
                  borderRadius: '14px' 
                }}
              >
                Back home
              </Link>
            </div>
          </form>

          <div
            className="mt-10 p-5 rounded-lg"
            style={{ 
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)' 
            }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Paste any Google Maps place URL (e.g. a café or restaurant). We'll resolve the place,
              pull its details from Google, and drop it into Tip Jar with auto-tags (cuisine/type).
              Perfect for planning London food crawls or saving coffee spots to try later.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
