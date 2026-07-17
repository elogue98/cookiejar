'use client'

import { MacroTarget, MealResult, MealSelection, MealSlot, PROTEINS, CARBS, VEGS } from '@/lib/mealData'

const CARB_IDS = new Set(CARBS.map((c) => c.id))

interface MealBuilderProps {
  slot: MealSlot
  target: MacroTarget
  selection: MealSelection
  onSelectionChange: (selection: MealSelection) => void
  result: MealResult | null
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border"
      style={{
        backgroundColor: active ? 'var(--primary)' : 'var(--bg-main)',
        color: active ? '#fff' : 'var(--text-main)',
        borderColor: active ? 'var(--primary)' : 'var(--border-color)',
      }}
    >
      {label}
    </button>
  )
}

export default function MealBuilder({ slot, target, selection, onSelectionChange, result }: MealBuilderProps) {
  const title = slot === 'lunch' ? 'Lunch' : 'Dinner'

  const toggleProtein = (id: string) => {
    onSelectionChange({ ...selection, protein: selection.protein === id ? null : id })
  }

  const toggleCarb = (id: string) => {
    const carbs = selection.carbs.includes(id)
      ? selection.carbs.filter((c) => c !== id)
      : [...selection.carbs, id]
    onSelectionChange({ ...selection, carbs })
  }

  const toggleVeg = (id: string) => {
    const vegs = selection.vegs.includes(id)
      ? selection.vegs.filter((v) => v !== id)
      : [...selection.vegs, id]
    onSelectionChange({ ...selection, vegs })
  }

  const hasResults = selection.protein !== null && selection.carbs.length > 0

  return (
    <div
      className="rounded-2xl shadow-sm overflow-hidden"
      style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <h3 className="font-bold text-base" style={{ color: 'var(--text-main)' }}>{title}</h3>
        <div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{target.protein}g protein</span>
          <span>·</span>
          <span>{target.carbs}g carbs</span>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Protein */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Protein</p>
          <div className="flex flex-wrap gap-2">
            {PROTEINS.map((p) => (
              <Pill key={p.id} label={p.name} active={selection.protein === p.id} onClick={() => toggleProtein(p.id)} />
            ))}
          </div>
        </div>

        {/* Carb */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Carb</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Grams shown as raw/dry for measuring</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CARBS.map((c) => (
              <Pill key={c.id} label={c.name} active={selection.carbs.includes(c.id)} onClick={() => toggleCarb(c.id)} />
            ))}
          </div>
        </div>

        {/* Veg */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Veg (120g each)</p>
          <div className="flex flex-wrap gap-2">
            {VEGS.map((v) => (
              <Pill key={v.id} label={v.name} active={selection.vegs.includes(v.id)} onClick={() => toggleVeg(v.id)} />
            ))}
          </div>
        </div>

        {/* Results */}
        {!hasResults ? (
          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
            Pick a protein and at least one carb to see portions.
          </p>
        ) : result && result.portions.length > 0 ? (
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-color)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)' }}>
                  {['Food', 'Grams', 'Cal', 'Protein', 'Carbs', 'Fat'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.portions.map((portion, i) => {
                  const isCarb = CARB_IDS.has(portion.food.id)
                  const ratio = (portion.food as { cookedToDryRatio?: number }).cookedToDryRatio ?? 1
                  const isDry = ratio > 1.5  // rice/pasta → "dry"; potato/sweet potato → "raw"
                  const rawGrams = Math.round(portion.grams / ratio)
                  const cookedGrams = Math.round(portion.grams)

                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{portion.food.name}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--primary)' }}>
                        {isCarb ? (
                          <>
                            {rawGrams}g
                            <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                              ({isDry ? 'dry' : 'raw'})
                            </span>
                            {ratio > 1.1 && (
                              <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                                ≈ {cookedGrams}g cooked
                              </span>
                            )}
                          </>
                        ) : (
                          <>{cookedGrams}g</>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>{Math.round(portion.calories)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>{portion.protein.toFixed(1)}g</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>{portion.carbs.toFixed(1)}g</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>{portion.fat.toFixed(1)}g</td>
                    </tr>
                  )
                })}
                <tr style={{ borderTop: `2px solid var(--primary)`, backgroundColor: 'var(--bg-main)' }}>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-main)' }}>Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-main)' }}>{Math.round(result.totalCalories)}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-main)' }}>{result.totalProtein.toFixed(1)}g</td>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-main)' }}>{result.totalCarbs.toFixed(1)}g</td>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-main)' }}>{result.totalFat.toFixed(1)}g</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
