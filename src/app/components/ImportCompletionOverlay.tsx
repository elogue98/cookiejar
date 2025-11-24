'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ImportCompletionOverlayProps {
  isOpen: boolean
  recipeTitle?: string | null
  destinationPath: string
  recipeId: string
  initialCookbookSource?: string | null
}

export default function ImportCompletionOverlay({
  isOpen,
  recipeTitle,
  destinationPath,
  recipeId,
  initialCookbookSource,
}: ImportCompletionOverlayProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(isOpen)
  const [cookbookSource, setCookbookSource] = useState(initialCookbookSource || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setVisible(isOpen)
  }, [isOpen])

  useEffect(() => {
    setCookbookSource(initialCookbookSource || '')
  }, [initialCookbookSource])

  if (!visible) {
    return null
  }

  const handleFinish = async () => {
    if (saving) return
    setError(null)

    const trimmed = cookbookSource.trim()
    const initialTrimmed = (initialCookbookSource || '').trim()

    if (trimmed === initialTrimmed) {
      setVisible(false)
      router.replace(destinationPath)
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookbookSource: trimmed || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save cookbook info')
      }

      setVisible(false)
      router.replace(destinationPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cookbook info')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '560px',
          padding: '40px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.18)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            color: '#0F9D58',
          }}
        >
          ✓
        </div>

        <h2 style={{ fontSize: '26px', marginBottom: '12px', color: 'var(--text-main)' }}>
          Recipe imported!
        </h2>
        <p style={{ margin: 0, color: 'rgba(43, 43, 43, 0.75)', fontSize: '16px' }}>
          <strong>{recipeTitle || 'Your recipe'}</strong> is ready. Add optional cookbook details below before finishing.
        </p>

        <div style={{ marginTop: '24px', textAlign: 'left' }}>
          <label
            htmlFor="overlayCookbookSource"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-main)',
              marginBottom: '6px',
            }}
          >
            Cookbook Source (optional)
          </label>
          <input
            id="overlayCookbookSource"
            type="text"
            value={cookbookSource}
            onChange={(e) => setCookbookSource(e.target.value)}
            placeholder="e.g., Ottolenghi — Simple, page 134"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: '15px',
              outline: 'none',
            }}
            disabled={saving}
          />
          <p style={{ fontSize: '12px', color: 'rgba(43, 43, 43, 0.6)', marginTop: '6px' }}>
            Helps you remember where this recipe came from
          </p>
        </div>

        {error && (
          <div
            style={{
              marginTop: '16px',
              color: '#DC2626',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleFinish}
          disabled={saving}
          style={{
            marginTop: '28px',
            padding: '14px 26px',
            backgroundColor: '#D34E4E',
            color: 'white',
            border: 'none',
            borderRadius: '999px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Finish import'}
        </button>
      </div>
    </div>
  )
}

