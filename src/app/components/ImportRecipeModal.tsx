'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/userContext'
import LoadingOverlay from './LoadingOverlay'

type ImportMode = 'url' | 'image'

interface ImportRecipeModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ExtractedRecipeData {
  title: string
  ingredients: string[]
  instructions: string
  tags: string[]
  metadataNotes?: string | null
  imageDataUrl: string
  imageBuffer: string
  imageMimeType: string
}

export default function ImportRecipeModal({ isOpen, onClose }: ImportRecipeModalProps) {
  const router = useRouter()
  const { user } = useUser()
  const [mode, setMode] = useState<ImportMode>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedRecipeData | null>(null)
  const [cookbookSource, setCookbookSource] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

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
          userId: user?.id,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to import recipe')
        setLoading(false)
        return
      }

      // Success - close modal and redirect
      onClose()
      router.push(`/recipes/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      setError('Please select an image')
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPG, PNG, or WEBP)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import/image', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to extract recipe from image')
        setLoading(false)
        return
      }

      // Store extracted data and show preview
      setExtractedData(data.data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleFinalizeImport = async () => {
    if (!extractedData) return

    setFinalizing(true)
    setError(null)

    try {
      const res = await fetch('/api/import/image/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extractedData.title,
          ingredients: extractedData.ingredients,
          instructions: extractedData.instructions,
          tags: extractedData.tags,
          cookbookSource: cookbookSource.trim() || null,
          metadataNotes: extractedData.metadataNotes || null,
          imageBuffer: extractedData.imageBuffer,
          imageMimeType: extractedData.imageMimeType,
          userId: user?.id,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to finalize recipe import')
        setFinalizing(false)
        return
      }

      // Success - close modal and redirect
      onClose()
      router.push(`/recipes/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setFinalizing(false)
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (validTypes.includes(droppedFile.type)) {
        setFile(droppedFile)
        setError(null)
      } else {
        setError('Please select a valid image file (JPG, PNG, or WEBP)')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile)
        setError(null)
      } else {
        setError('Please select a valid image file (JPG, PNG, or WEBP)')
      }
    }
  }

  const resetForm = () => {
    setUrl('')
    setFile(null)
    setError(null)
    setLoading(false)
    setExtractedData(null)
    setCookbookSource('')
    setFinalizing(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleCancel = () => {
    resetForm()
  }

  return (
    <>
      {(loading || finalizing) && <LoadingOverlay onCancel={handleCancel} />}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={handleClose}
      >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '600',
              color: 'var(--text-main)',
              marginBottom: '8px',
            }}
          >
            Import Recipe
          </h2>
          <p style={{ color: 'rgba(43, 43, 43, 0.7)', fontSize: '14px' }}>
            Import a recipe from a URL or upload an image
          </p>
        </div>

        {/* Tabs */}
        <div
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
        </div>

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

        {/* Image Form - Upload Step */}
        {mode === 'image' && !extractedData && (
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
                Recipe Image
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
                {file ? (
                  <div>
                    <p style={{ color: 'var(--text-main)', marginBottom: '8px', fontWeight: '500' }}>
                      {file.name}
                    </p>
                    <p style={{ color: 'rgba(43, 43, 43, 0.6)', fontSize: '12px' }}>
                      Click to change file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: 'var(--text-main)', marginBottom: '8px' }}>
                      Drag and drop an image here, or click to select
                    </p>
                    <p style={{ color: 'rgba(43, 43, 43, 0.6)', fontSize: '12px' }}>
                      Supports JPG, PNG, and WEBP
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
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
                Choose Image
              </button>
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
                disabled={loading || !file}
                style={{
                  padding: '10px 24px',
                  background: '#D34E4E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: loading || !file ? 'not-allowed' : 'pointer',
                  opacity: loading || !file ? 0.6 : 1,
                  fontWeight: '500',
                }}
              >
                {loading ? 'Processing...' : 'Extract Recipe'}
              </button>
            </div>
          </form>
        )}

        {/* Image Form - Preview Step */}
        {mode === 'image' && extractedData && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text-main)',
                marginBottom: '16px',
              }}>
                Review Extracted Recipe
              </h3>

              {/* Preview Image */}
              {extractedData.imageDataUrl && (
                <div style={{ marginBottom: '16px' }}>
                  <img
                    src={extractedData.imageDataUrl}
                    alt="Recipe preview"
                    style={{
                      width: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(211, 78, 78, 0.2)',
                    }}
                  />
                </div>
              )}

              {/* Title Preview */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: 'rgba(43, 43, 43, 0.6)', marginBottom: '4px' }}>Title</p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)' }}>
                  {extractedData.title}
                </p>
              </div>

              {/* Tags Preview */}
              {extractedData.tags && extractedData.tags.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'rgba(43, 43, 43, 0.6)', marginBottom: '4px' }}>Tags</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {extractedData.tags.map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          borderRadius: '20px',
                          backgroundColor: 'var(--accent-gold)',
                          color: 'var(--text-main)',
                          fontWeight: '500',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cookbook Source Field */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="cookbookSource"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-main)',
                    marginBottom: '8px',
                  }}
                >
                  Cookbook Source (optional)
                </label>
                <input
                  type="text"
                  id="cookbookSource"
                  value={cookbookSource}
                  onChange={(e) => setCookbookSource(e.target.value)}
                  placeholder="e.g., Ottolenghi — Simple, page 134"
                  disabled={finalizing}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid rgba(211, 78, 78, 0.2)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    outline: 'none',
                    opacity: finalizing ? 0.6 : 1,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#D34E4E'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(211, 78, 78, 0.2)'
                  }}
                />
                <p style={{ fontSize: '12px', color: 'rgba(43, 43, 43, 0.6)', marginTop: '4px' }}>
                  Add the cookbook name and page number if this recipe came from a cookbook
                </p>
              </div>
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
                onClick={() => {
                  setExtractedData(null)
                  setCookbookSource('')
                  setError(null)
                }}
                disabled={finalizing}
                style={{
                  padding: '10px 24px',
                  border: '1px solid rgba(211, 78, 78, 0.2)',
                  background: 'white',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  cursor: finalizing ? 'not-allowed' : 'pointer',
                  opacity: finalizing ? 0.6 : 1,
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalizeImport}
                disabled={finalizing}
                style={{
                  padding: '10px 24px',
                  background: '#D34E4E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: finalizing ? 'not-allowed' : 'pointer',
                  opacity: finalizing ? 0.6 : 1,
                  fontWeight: '500',
                }}
              >
                {finalizing ? 'Importing...' : 'Import Recipe'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

