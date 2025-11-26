'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  mapIngredientsToSteps,
  normalizeIngredientGroups,
  normalizeInstructionGroups,
} from '@/lib/ingredientMatcher'

type IngredientGroup = {
  section: string
  items: string[]
}

type InstructionGroup = {
  section: string
  steps: string[]
}

type Dataset = {
  id: string
  title?: string
  ingredients: IngredientGroup[]
  instructions: InstructionGroup[]
  expectedMatches?: Record<string, string[]>
}

type DatasetSummary = { id: string; title?: string; file: string }

type Props = {
  datasets: DatasetSummary[]
}

type StepDescriptor = {
  id: string
  text: string
  section?: string
}

type IngredientDescriptor = {
  id: string
  text: string
  section?: string
}

export function Trainer({ datasets }: Props) {
  const [selectedId, setSelectedId] = useState<string>(datasets[0]?.id || '')
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [matches, setMatches] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const ingredients: IngredientDescriptor[] = useMemo(() => {
    if (!dataset) return []
    const acc: IngredientDescriptor[] = []
    dataset.ingredients.forEach((group, gIdx) => {
      group.items.forEach((item, iIdx) => {
        acc.push({ id: `${gIdx}-${iIdx}`, text: item, section: group.section })
      })
    })
    return acc
  }, [dataset])

  const steps: StepDescriptor[] = useMemo(() => {
    if (!dataset) return []
    const acc: StepDescriptor[] = []
    let counter = 0
    dataset.instructions.forEach((group) => {
      group.steps.forEach((step) => {
        acc.push({ id: `step-${counter}`, text: step, section: group.section })
        counter += 1
      })
    })
    return acc
  }, [dataset])

  const suggestions = useMemo(() => {
    if (!dataset) return {}
    const ing = normalizeIngredientGroups(dataset.ingredients)
    const instr = normalizeInstructionGroups(dataset.instructions)
    return mapIngredientsToSteps(ing, instr)
  }, [dataset])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    setMessage(null)
    fetch(`/api/highlights?id=${encodeURIComponent(selectedId)}`)
      .then((res) => res.json())
      .then((data: Dataset) => {
        setDataset(data)
        const ing = normalizeIngredientGroups(data.ingredients)
        const instr = normalizeInstructionGroups(data.instructions)
        const fallback = mapIngredientsToSteps(ing, instr)
        setMatches(data.expectedMatches || fallback)
      })
      .catch((err) => setError(err.message || 'Failed to load dataset'))
      .finally(() => setLoading(false))
  }, [selectedId])

  const toggleMatch = (stepId: string, ingredientId: string) => {
    setMatches((prev) => {
      const current = prev[stepId] || []
      const next = current.includes(ingredientId)
        ? current.filter((id) => id !== ingredientId)
        : [...current, ingredientId]
      return { ...prev, [stepId]: next }
    })
  }

  const applySuggestions = (stepId: string) => {
    if (!suggestions[stepId]) return
    setMatches((prev) => ({ ...prev, [stepId]: suggestions[stepId] }))
  }

  const save = async () => {
    if (!dataset) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dataset.id, expectedMatches: matches }),
      })
      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Failed to save')
      }
      setMessage('Saved!')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">Dataset</label>
          <select
            className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title || d.id}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            if (!dataset) return
            setMatches(suggestions)
          }}
          className="mt-6 rounded bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          disabled={!dataset}
        >
          Reset to suggestions
        </button>
        <button
          onClick={save}
          className="mt-6 rounded bg-[#D34E4E] px-3 py-2 text-sm font-semibold text-white hover:bg-[#c04040] disabled:opacity-50"
          disabled={!dataset || saving}
        >
          {saving ? 'Saving…' : 'Save labels'}
        </button>
        {message && <span className="text-sm text-green-600">{message}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {loading && <p className="text-slate-500">Loading dataset…</p>}

      {dataset && !loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px,1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[80vh] lg:overflow-auto">
            <h3 className="text-sm font-semibold text-slate-700">Ingredients</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {ingredients.map((ing) => (
                <li key={ing.id} className="leading-relaxed">
                  <span className="font-mono text-xs text-slate-500">{ing.id}</span>{' '}
                  <span>{ing.text}</span>
                  {ing.section && (
                    <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                      {ing.section}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-4">
            {steps.map((step) => {
              const selected = matches[step.id] || []
              const suggested = suggestions[step.id] || []
              return (
                <div key={step.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
                        {step.id.replace('step-', '')}
                      </span>
                      {step.section && (
                        <span className="rounded bg-slate-100 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-500">
                          {step.section}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => applySuggestions(step.id)}
                      className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Use suggestions
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-800 leading-relaxed">{step.text}</p>

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-slate-600">Suggested</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {suggested.length === 0 && <span className="text-xs text-slate-400">None</span>}
                      {suggested.map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-slate-600">Selected</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {ingredients.map((ing) => {
                        const active = selected.includes(ing.id)
                        return (
                          <button
                            key={ing.id}
                            onClick={() => toggleMatch(step.id, ing.id)}
                            className={`rounded-full border px-2 py-1 text-[11px] font-mono transition ${
                              active
                                ? 'border-[#D34E4E] bg-[#D34E4E]/10 text-[#D34E4E]'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {ing.id}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
