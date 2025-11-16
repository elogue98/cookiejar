'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '../components/Logo'

export default function ImportPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/recipes/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to import recipe')
        setLoading(false)
        return
      }

      // Success - show message briefly then redirect
      setSuccess(true)
      setLoading(false)
      
      // Redirect to homepage after a short delay
      setTimeout(() => {
        router.push('/')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <header className="border-b" style={{ borderColor: 'rgba(211, 78, 78, 0.1)', background: '#F9E7B2' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-3xl font-bold transition-colors" style={{ color: 'var(--text-main)' }}>
              <Logo size={48} />
              <span>Cookie Jar</span>
            </Link>
            <Link 
              href="/" 
              className="transition-colors"
              style={{ color: 'var(--accent-clay)' }}
            >
              ← Back to Recipes
            </Link>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="max-w-2xl">
          <h2 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text-main)' }}>
            Import Recipe from URL
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="url" 
                className="block text-sm font-medium mb-3"
                style={{ color: 'var(--text-main)' }}
              >
                Recipe URL
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/recipe"
                disabled={loading}
                className="w-full px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'rgba(211, 78, 78, 0.2)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-600 bg-red-50 p-4">
                <p className="text-red-700 font-semibold mb-2">Import Failed</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-600 bg-green-50 p-4">
                <p className="text-green-700 font-semibold mb-2">Success!</p>
                <p className="text-green-600 text-sm">
                  Recipe imported successfully. Redirecting to homepage...
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={loading || success}
                className="px-8 py-3 font-medium transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#D34E4E',
                  color: 'white',
                  borderRadius: '14px'
                }}
              >
                {loading ? 'Importing...' : 'Import Recipe'}
              </button>
              
              <Link
                href="/"
                className="px-8 py-3 font-medium transition-colors hover:opacity-90"
                style={{
                  background: '#DDC57A',
                  color: '#2B2B2B',
                  borderRadius: '14px'
                }}
              >
                Cancel
              </Link>
            </div>
          </form>

          <div className="mt-10 p-5 rounded-lg" style={{
            backgroundColor: 'var(--accent-light)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-main)' }}>
              <strong>How it works:</strong> Paste a recipe URL from any cooking website. 
              We'll automatically extract the recipe title, ingredients, and instructions and add it to your CookieJar.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

