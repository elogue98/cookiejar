import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ingredientEmbeddingCache.ts', import.meta.url), 'utf8')

describe('ingredient embedding cache packaging', () => {
  it('does not depend on an ignored local cache file', () => {
    expect(source).not.toContain("../../.cache/ingredient_embeddings.json")
  })
})
