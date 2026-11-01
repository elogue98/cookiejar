'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AnimatedModal from './AnimatedModal'
import LoadingOverlay from './LoadingOverlay'
import { readImportResponse } from '@/lib/importResponse'
import { prepareImportImage } from '@/lib/importImage'
import ImageImportReview from './ImageImportReview'

type ImportMode = 'url' | 'image' | 'text'

interface ImportRecipeModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ExtractedRecipeData {
  title: string
  ingredients: string[]
  instructions: string
  tags: string[]
  imageBuffer: string
  imageMimeType: string
  ingredientSections: { section: string; items: string[] }[]
  instructionSections: { section: string; steps: string[] }[]
  sourcePhotoCount: number
  reviewWarnings: string[]
  sourceNotes: string[]
  // Metadata fields
  servings?: number | null
  prepTime?: string | null
  cookTime?: string | null
  totalTime?: string | null
  cuisine?: string | null
  mealType?: string | null
  nutrition?: {
    calories?: number | null
    protein?: number | null
    fat?: number | null
    carbs?: number | null
  } | null
  description?: string | null
}

export default function ImportRecipeModal({ isOpen, onClose }: ImportRecipeModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<ImportMode>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [draft, setDraft] = useState<ExtractedRecipeData | null>(null)
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const extractionRequest = useRef<AbortController | null>(null)

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Use the new AI-first import endpoint
      const res = await fetch('/api/import/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: url.trim(),
        }),
      })

      const data = await readImportResponse<{ id: string }>(res)

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to import recipe')
        setLoading(false)
        return
      }

      // Success - redirect to recipe page (no overlay for URL imports)
      setLoading(false)
      onClose()
      router.push(`/recipes/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!text.trim()) {
      setError('Please paste recipe text')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/import/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text.trim(),
        }),
      })

      const data = await readImportResponse<{ id: string }>(res)

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to import recipe')
        setLoading(false)
        return
      }

      // Success - redirect to recipe page (no overlay for text imports)
      setLoading(false)
      onClose()
      router.push(`/recipes/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const finalizeImageImport = async (
    dataToFinalize: ExtractedRecipeData,
    cookbookSourceOverride: string | null = null
  ) => {
    if (finalizing || (dataToFinalize.reviewWarnings.length > 0 && !reviewAcknowledged)) return
    setFinalizing(true)
    setError(null)

    console.log('[ImportRecipeModal] Finalizing extracted recipe:', {
      servings: dataToFinalize.servings,
      prepTime: dataToFinalize.prepTime,
      cookTime: dataToFinalize.cookTime,
      totalTime: dataToFinalize.totalTime,
      nutrition: dataToFinalize.nutrition,
      description: dataToFinalize.description,
    })

    try {
      const payload = {
        title: dataToFinalize.title,
        ingredients: dataToFinalize.ingredients,
        instructions: dataToFinalize.instructions,
        tags: dataToFinalize.tags,
        cookbookSource: cookbookSourceOverride,
        imageBuffer: dataToFinalize.imageBuffer,
        imageMimeType: dataToFinalize.imageMimeType,
        ingredientSections: dataToFinalize.ingredientSections,
        instructionSections: dataToFinalize.instructionSections,
        servings: dataToFinalize.servings,
        prepTime: dataToFinalize.prepTime,
        cookTime: dataToFinalize.cookTime,
        totalTime: dataToFinalize.totalTime,
        cuisine: dataToFinalize.cuisine,
        mealType: dataToFinalize.mealType,
        nutrition: dataToFinalize.nutrition,
        description: dataToFinalize.description,
        reviewWarnings: dataToFinalize.reviewWarnings,
        reviewAcknowledged,
      }

      const res = await fetch('/api/import/image/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await readImportResponse<{ id: string }>(res)

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to finalize recipe import')
        setFinalizing(false)
        return
      }

      resetForm()
      onClose()
      router.push(`/recipes/${data.data.id}?import=review`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setFinalizing(false)
    }
  }

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!files.length) {
      setError('Please select one or more recipe photos')
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (files.some(file => !validTypes.includes(file.type))) {
      setError('Please select a valid image file (JPG, PNG, or WEBP)')
      return
    }

    setLoading(true)
    setError(null)
    const controller = new AbortController()
    extractionRequest.current?.abort()
    extractionRequest.current = controller

    try {
      const formData = new FormData()
      const perPhotoBudget = Math.min(2_000_000, Math.floor(3_000_000 / files.length))
      for (const file of files) {
        const prepared = await prepareImportImage(file, perPhotoBudget)
        if (controller.signal.aborted) return
        formData.append('file', prepared)
      }

      const res = await fetch('/api/import/image', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      const data = await readImportResponse<ExtractedRecipeData>(res)
      if (controller.signal.aborted) return

      if (!res.ok || !data.success) {
        console.error('[ImportRecipeModal] Image extraction failed:', data.error)
        setError(data.error || 'Failed to extract recipe from image')
        setLoading(false)
        return
      }

      setLoading(false)
      setDraft(data.data)
      setReviewAcknowledged(false)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    addFiles(Array.from(e.dataTransfer.files))
  }

  const addFiles = (selected: File[]) => {
    if (loading || finalizing) return
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (selected.some(file => !validTypes.includes(file.type))) {
      setError('Please select JPG, PNG, or WEBP photos')
      return
    }
    const combined = [...files]
    for (const file of selected) {
      if (!combined.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) combined.push(file)
    }
    if (combined.length > 6) {
      setError('You can import up to six photos of one recipe at a time')
      return
    }
    setFiles(combined)
    setDraft(null)
    setReviewAcknowledged(false)
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []))
    e.target.value = ''
  }

  const resetForm = () => {
    console.log('[ImportRecipeModal] Resetting form')
    setUrl('')
    setText('')
    extractionRequest.current?.abort()
    setFiles([])
    setDraft(null)
    setReviewAcknowledged(false)
    setError(null)
    setLoading(false)
    setFinalizing(false)
  }

  const handleClose = () => {
    if (finalizing) return
    resetForm()
    onClose()
  }

  const handleCancel = () => {
    resetForm()
  }

  return (
    <>
      {loading && <LoadingOverlay onCancel={handleCancel} />}
      <AnimatedModal
        open={isOpen}
        onClose={handleClose}
        closeOnBackdrop
        ariaLabelledBy="import-recipe-modal-title"
        rootStyle={{ padding: 0, zIndex: 1000 }}
        backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        panelStyle={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            id="import-recipe-modal-title"
            style={{
              fontSize: '24px',
              fontWeight: '600',
              color: 'var(--text-main)',
              marginBottom: '8px',
            }}
          >
            {draft ? 'Review extracted recipe' : 'Import Recipe'}
          </h2>
          <p style={{ color: 'rgba(43, 43, 43, 0.7)', fontSize: '14px' }}>
            {draft ? 'Nothing is saved until you choose Save recipe.' : 'Import a recipe from a URL, photos, or paste text'}
          </p>
        </div>

        {/* Tabs */}
        {!draft && <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '2px solid rgba(211, 78, 78, 0.1)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('url')
              resetForm()
            }}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: mode === 'url' ? '2px solid #D34E4E' : '2px solid transparent',
              color: mode === 'url' ? '#D34E4E' : 'rgba(43, 43, 43, 0.7)',
              fontWeight: mode === 'url' ? '600' : '400',
              transition: 'all 0.2s',
              marginBottom: '-2px',
            }}
          >
            Import via URL
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('image')
              resetForm()
            }}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: mode === 'image' ? '2px solid #D34E4E' : '2px solid transparent',
              color: mode === 'image' ? '#D34E4E' : 'rgba(43, 43, 43, 0.7)',
              fontWeight: mode === 'image' ? '600' : '400',
              transition: 'all 0.2s',
              marginBottom: '-2px',
            }}
          >
            Import via Image
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('text')
              resetForm()
            }}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: mode === 'text' ? '2px solid #D34E4E' : '2px solid transparent',
              color: mode === 'text' ? '#D34E4E' : 'rgba(43, 43, 43, 0.7)',
              fontWeight: mode === 'text' ? '600' : '400',
              transition: 'all 0.2s',
              marginBottom: '-2px',
            }}
          >
            Paste Text
          </button>
        </div>}

        {/* URL Form */}
        {mode === 'url' && (
          <form onSubmit={handleUrlSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="url"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-main)',
                  marginBottom: '8px',
                }}
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
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid rgba(211, 78, 78, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '14px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#D34E4E'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(211, 78, 78, 0.2)'
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #DC2626',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px',
                }}
              >
                <p style={{ color: '#DC2626', fontSize: '14px' }}>{error}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  border: '1px solid rgba(211, 78, 78, 0.2)',
                  background: 'white',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  background: '#D34E4E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  fontWeight: '500',
                }}
              >
                {loading ? 'Importing...' : 'Import Recipe'}
              </button>
            </div>
          </form>
        )}

        {/* Text Form */}
        {mode === 'text' && (
          <form onSubmit={handleTextSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="text"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-main)',
                  marginBottom: '8px',
                }}
              >
                Paste Recipe Text
              </label>
              <textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste recipe text here... (ingredients, instructions, etc.)"
                disabled={loading}
                rows={12}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid rgba(211, 78, 78, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '14px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  opacity: loading ? 0.6 : 1,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#D34E4E'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(211, 78, 78, 0.2)'
                }}
              />
              <p style={{ fontSize: '12px', color: 'rgba(43, 43, 43, 0.6)', marginTop: '4px' }}>
                Supports any text format: copied recipes, handwritten notes, screenshots converted to text, etc.
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #DC2626',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px',
                }}
              >
                <p style={{ color: '#DC2626', fontSize: '14px' }}>{error}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  border: '1px solid rgba(211, 78, 78, 0.2)',
                  background: 'white',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !text.trim()}
                style={{
                  padding: '10px 24px',
                  background: '#D34E4E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !text.trim() ? 0.6 : 1,
                  fontWeight: '500',
                }}
              >
                {loading ? 'Importing...' : 'Import Recipe'}
              </button>
            </div>
          </form>
        )}

        {/* Image Form - Upload Step */}
        {mode === 'image' && draft && (
          <ImageImportReview
            draft={draft}
            photos={files}
            acknowledged={reviewAcknowledged}
            onAcknowledge={setReviewAcknowledged}
            onBack={() => { setDraft(null); setReviewAcknowledged(false); setError(null) }}
            onSave={() => { void finalizeImageImport(draft) }}
            saving={finalizing}
            error={error}
          />
        )}
        {mode === 'image' && !draft && (
          <form onSubmit={handleImageSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-main)',
                  marginBottom: '8px',
                }}
              >
                Recipe Photos
              </label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragActive ? '#D34E4E' : 'rgba(211, 78, 78, 0.3)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: dragActive ? 'rgba(211, 78, 78, 0.05)' : 'transparent',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {files.length > 0 ? (
                  <div>
                    <p style={{ color: 'var(--text-main)', marginBottom: '8px', fontWeight: '500' }}>
                      {files.length} {files.length === 1 ? 'photo' : 'photos'} selected
                    </p>
                    <p style={{ color: 'rgba(43, 43, 43, 0.6)', fontSize: '12px' }}>
                      Click to add another page
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: 'var(--text-main)', marginBottom: '8px' }}>
                      Drop recipe photos here, or click to select
                    </p>
                    <p style={{ color: 'rgba(43, 43, 43, 0.6)', fontSize: '12px' }}>
                      JPG, PNG, or WEBP · Up to six photos
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
              {files.length > 0 && <ol style={{ marginTop: 12, paddingLeft: 20, listStyle: 'decimal' }}>
                {files.map((file, index) => <li key={`${file.name}-${index}`} style={{ marginBottom: 8, overflowWrap: 'anywhere' }}>
                  {file.name}{' '}
                  <button type="button" aria-label={`Remove photo ${index + 1}`} disabled={loading || finalizing} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} style={{ color: '#b43b3b', padding: '4px 8px' }}>Remove</button>
                </li>)}
              </ol>}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: '#DDC57A',
                  color: '#2B2B2B',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                {files.length ? 'Add Photos' : 'Choose Photos'}
              </button>
              <p style={{ fontSize: '12px', color: 'rgba(43, 43, 43, 0.6)', marginTop: '10px' }}>
                Include every page of the same recipe in order. You’ll review the ingredients, method, and any warnings before saving.
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #DC2626',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px',
                }}
              >
                <p style={{ color: '#DC2626', fontSize: '14px' }}>{error}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading || finalizing}
                style={{
                  padding: '10px 24px',
                  border: '1px solid rgba(211, 78, 78, 0.2)',
                  background: 'white',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  cursor: loading || finalizing ? 'not-allowed' : 'pointer',
                  opacity: loading || finalizing ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || finalizing || !files.length}
                style={{
                  padding: '10px 24px',
                  background: '#D34E4E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: loading || finalizing || !files.length ? 'not-allowed' : 'pointer',
                  opacity: loading || finalizing || !files.length ? 0.6 : 1,
                  fontWeight: '500',
                }}
              >
                {loading || finalizing ? 'Reading photos...' : 'Extract & Review'}
              </button>
            </div>
          </form>
        )}

      </AnimatedModal>
    </>
  )
}
