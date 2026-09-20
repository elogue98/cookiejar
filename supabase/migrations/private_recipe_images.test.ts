import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260823000200_private_recipe_images.sql', import.meta.url),
  'utf8',
)

describe('private recipe image migration', () => {
  it('bypasses attribution only while backfilling legacy image paths', () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.recipes DISABLE TRIGGER recipes_set_attribution;[\s\S]*UPDATE public\.recipes[\s\S]*ALTER TABLE public\.recipes ENABLE TRIGGER recipes_set_attribution;/,
    )
  })

  it('leaves managed storage table ownership and grants untouched', () => {
    expect(migration).not.toMatch(/ALTER TABLE storage\.objects/)
    expect(migration).not.toMatch(/(?:REVOKE|GRANT).*ON TABLE storage\.objects/)
  })
})
