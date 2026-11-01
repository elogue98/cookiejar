import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import ImageImportReview from './ImageImportReview'

const draft = {
  title: 'Roasted sausages', sourcePhotoCount: 2,
  description: 'Sausages roasted with squash and served with onion gravy.',
  ingredientSections: [{ section: 'For the onion gravy', items: ['2 onions', '500ml chicken or beef stock'] }],
  instructionSections: [{ section: 'For the onion gravy', steps: ['Fry the onions for half an hour until golden brown.'] }],
  reviewWarnings: ['The temperature correction is unclear.'], sourceNotes: ['Handwritten: Brown the sausages.'],
}

it('shows all extracted sections and requires acknowledgement before a warned recipe can be saved', () => {
  const save = vi.fn()
  const html = renderToStaticMarkup(<ImageImportReview draft={draft} acknowledged={false} onAcknowledge={() => {}} onBack={() => {}} onSave={save} saving={false} error={null} />)
  expect(html).toContain('500ml chicken or beef stock')
  expect(html).toContain('Sausages roasted with squash and served with onion gravy.')
  expect(html).toContain('Fry the onions for half an hour')
  expect(html).toContain('The temperature correction is unclear.')
  expect(html).toContain('Handwritten: Brown the sausages.')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save recipe<\/button>/)
  expect(save).not.toHaveBeenCalled()
})

it('permits an acknowledged draft and disables duplicate saves while saving', () => {
  const props = { draft, acknowledged: true, onAcknowledge: () => {}, onBack: () => {}, onSave: () => {}, error: null }
  const html = renderToStaticMarkup(<ImageImportReview {...props} saving={false} />)
  expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Save recipe<\/button>/)
  const saving = renderToStaticMarkup(<ImageImportReview {...props} saving />)
  expect(saving).toMatch(/<button[^>]*disabled=""[^>]*>Saving…<\/button>/)
})
