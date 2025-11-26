// Isolated default model and scorer with no external imports to keep client bundles safe.
type CandidateFeatures = {
  overlapRatio: number
  weightCoverage: number
  hasHeadNoun: number
  phraseHit: number
  synonymHit: number
  fuzzyHit: number
  uniqueHead: number
  tokenCount: number
  sectionAlign: number
  seasoning: number
}

export type LearnedModel = {
  weights: Record<keyof CandidateFeatures, number>
  bias: number
}

const DEFAULT_MODEL: LearnedModel = {
  bias: -0.5,
  weights: {
    overlapRatio: 2.0,
    weightCoverage: 1.4,
    hasHeadNoun: 0.8,
    phraseHit: 0.7,
    synonymHit: 0.3,
    fuzzyHit: 0.1,
    uniqueHead: 0.2,
    tokenCount: -0.05,
    sectionAlign: 0.4,
    seasoning: 0.2,
  },
}

export function loadLearnedModel(): LearnedModel {
  return DEFAULT_MODEL
}

export function scoreWithModel(features: CandidateFeatures, model?: LearnedModel): number {
  const m = model || loadLearnedModel()
  const bias = typeof m.bias === 'number' ? m.bias : 0
  let score = bias
  ;(Object.keys(m.weights) as (keyof CandidateFeatures)[]).forEach((key) => {
    score += (m.weights[key] || 0) * (features[key] ?? 0)
  })
  return score
}
