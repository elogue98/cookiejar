import embeddingData from '../../.cache/ingredient_embeddings.json'

type EmbeddingCache = {
  version: number
  dimension: number
  vectors: Record<string, number[]>
}

const cache: EmbeddingCache = embeddingData as EmbeddingCache
const DIMENSION = cache.dimension || 256
const vectorMap = new Map<string, number[]>()

Object.entries(cache.vectors || {}).forEach(([token, vector]) => {
  if (Array.isArray(vector) && vector.length === DIMENSION) {
    vectorMap.set(token, vector)
  }
})

const normalizeVector = (vector: number[]): number[] => {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (magnitude === 0) return vector.map(() => 0)
  return vector.map((value) => value / magnitude)
}

const pseudoRandom = (seed: number): () => number => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const hashedVectorCache = new Map<string, number[]>()

const generateHashedVector = (token: string): number[] => {
  if (hashedVectorCache.has(token)) {
    return hashedVectorCache.get(token) as number[]
  }
  let seed = 0
  for (let i = 0; i < token.length; i += 1) {
    seed = (seed * 31 + token.charCodeAt(i)) >>> 0
  }
  const rand = pseudoRandom(seed || 1)
  const vector = Array.from({ length: DIMENSION }, () => rand() * 2 - 1)
  const normalized = normalizeVector(vector)
  hashedVectorCache.set(token, normalized)
  return normalized
}

const getVectorForToken = (token: string): number[] => {
  const key = token.toLowerCase()
  const stored = vectorMap.get(key)
  if (stored) {
    return stored
  }
  return generateHashedVector(key)
}

const averageVectors = (vectors: number[][]): number[] | null => {
  if (vectors.length === 0) return null
  const accumulator = Array.from({ length: DIMENSION }, () => 0)
  vectors.forEach((vector) => {
    vector.forEach((value, index) => {
      accumulator[index] += value
    })
  })
  return normalizeVector(accumulator)
}

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  if (magA === 0 || magB === 0) return 0
  return dot / Math.sqrt(magA * magB)
}

export const buildEmbeddingForTokens = (tokens: string[]): number[] | null => {
  if (!tokens.length) return null
  const vectors = tokens.map((token) => getVectorForToken(token))
  return averageVectors(vectors)
}

export const embeddingSimilarity = (
  ingredientTokens: string[],
  stepTokens: string[],
): number | null => {
  const ingredientVector = buildEmbeddingForTokens(ingredientTokens)
  const stepVector = buildEmbeddingForTokens(stepTokens)
  if (!ingredientVector || !stepVector) return null
  return cosineSimilarity(ingredientVector, stepVector)
}

