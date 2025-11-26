import fs from 'node:fs'
import path from 'node:path'

import { Trainer } from './Trainer'

const DATASET_DIR = path.join(process.cwd(), 'data/ingredient_highlights')

type DatasetSummary = { id: string; title?: string; file: string }

function loadDatasetSummaries(): DatasetSummary[] {
  if (!fs.existsSync(DATASET_DIR)) return []
  return fs
    .readdirSync(DATASET_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      try {
        const payload = JSON.parse(fs.readFileSync(path.join(DATASET_DIR, file), 'utf-8'))
        return { id: payload.id, title: payload.title, file }
      } catch {
        return null
      }
    })
    .filter(Boolean) as DatasetSummary[]
}

export default function HighlightTrainingPage() {
  const datasets = loadDatasetSummaries()
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Highlight Training</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review steps and ingredients side by side. Toggle ingredient IDs per step, then save to update
          expectedMatches.
        </p>
      </div>
      {datasets.length === 0 ? (
        <p className="text-slate-500">No datasets found in data/ingredient_highlights.</p>
      ) : (
        <Trainer datasets={datasets} />
      )}
    </main>
  )
}
