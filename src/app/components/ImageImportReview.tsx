import React, { useEffect, useRef } from 'react'
import styles from './ImageImportReview.module.css'

export type ImageReviewDraft = {
  title: string
  description?: string | null
  sourcePhotoCount: number
  ingredientSections: { section: string | null; items: string[] }[]
  instructionSections: { section: string | null; steps: string[] }[]
  reviewWarnings: string[]
  sourceNotes: string[]
}

type Props = {
  draft: ImageReviewDraft
  acknowledged: boolean
  onAcknowledge: (value: boolean) => void
  onBack: () => void
  onSave: () => void
  saving: boolean
  error: string | null
  photos?: File[]
}

const NO_PHOTOS: File[] = []

function SourcePhoto({ photo, index }: { photo: File; index: number }) {
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(photo)
    if (imageRef.current) imageRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [photo])
  // Local blob URLs cannot use server image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={imageRef} alt={`Recipe source photo ${index + 1}`} />
}

export default function ImageImportReview({ draft, acknowledged, onAcknowledge, onBack, onSave, saving, error, photos = NO_PHOTOS }: Props) {
  return (
    <div className={styles.review}>
      <h3>{draft.title}</h3>
      {draft.description && <p className={styles.description}>{draft.description}</p>}
      <p className={styles.hint}>Read from {draft.sourcePhotoCount} {draft.sourcePhotoCount === 1 ? 'photo' : 'photos'}. Compare the ingredients and method with your photos before saving.</p>
      {photos.length > 0 && <details className={styles.photos}>
        <summary>Show source photos</summary>
        {photos.map((photo, index) => <div key={`${photo.name}-${index}`}>
          <p>Photo {index + 1}</p>
          <SourcePhoto photo={photo} index={index} />
        </div>)}
      </details>}
      {draft.reviewWarnings.length > 0 && (
        <div className={styles.warning} role="alert">
          <h4>Check these parts</h4>
          <ul>{draft.reviewWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          <p>Review these points before saving, or go back and add another photo.</p>
        </div>
      )}
      {draft.sourceNotes.length > 0 && (
        <section className={styles.sourceNotes}>
          <h4>Handwritten and source notes</h4>
          <ul>{draft.sourceNotes.map((note, index) => <li key={index}>{note}</li>)}</ul>
        </section>
      )}
      <section>
        <h4>Ingredients</h4>
        {draft.ingredientSections.map((section, index) => (
          <div key={index}>
            {section.section && <h5>{section.section}</h5>}
            <ul>{section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
          </div>
        ))}
      </section>
      <section>
        <h4>Method</h4>
        {draft.instructionSections.map((section, index) => (
          <div key={index}>
            {section.section && <h5>{section.section}</h5>}
            <ol>{section.steps.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol>
          </div>
        ))}
        {!draft.instructionSections.some(section => section.steps.length) && <p>No instructions were readable in these photos.</p>}
      </section>
      {draft.reviewWarnings.length > 0 && (
        <label className={styles.acknowledge}>
          <input type="checkbox" checked={acknowledged} onChange={event => onAcknowledge(event.target.checked)} disabled={saving} />
          <span>I’ve reviewed these warnings and want to save this draft.</span>
        </label>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={onBack} disabled={saving}>Back to photos</button>
        <button type="button" className={styles.save} onClick={onSave} disabled={saving || (draft.reviewWarnings.length > 0 && !acknowledged)}>{saving ? 'Saving…' : 'Save recipe'}</button>
      </div>
    </div>
  )
}
