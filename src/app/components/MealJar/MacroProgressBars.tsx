'use client'

import { MacroTarget } from '@/lib/mealData'
import { getMacroProgress } from '@/lib/macroProgress'

interface MacroProgressBarsProps {
  target: MacroTarget
  actual: MacroTarget
}

function StatCell({ label, actual, target, unit }: { label: string; actual: number; target: number; unit: string }) {
  const progress = getMacroProgress(actual, target)
  const status = progress.isOver
    ? `${progress.difference}${unit} over`
    : `${progress.difference}${unit} left`

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{status}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold leading-none" style={{ color: 'var(--text-main)' }}>{Math.round(actual)}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {target}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
        <div
          className="h-full w-full rounded-full origin-left transition-transform duration-200"
          style={{
            transform: `scaleX(${progress.widthPercentage / 100})`,
            backgroundColor: progress.color,
          }}
        />
      </div>
    </div>
  )
}

export default function MacroProgressBars({ target, actual }: MacroProgressBarsProps) {
  return (
    <div
      className="rounded-2xl shadow-sm overflow-hidden"
      style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <div
        className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <StatCell label="Calories" actual={actual.calories} target={target.calories} unit="" />
        <StatCell label="Protein"  actual={actual.protein}  target={target.protein}  unit="g" />
        <StatCell label="Carbs"    actual={actual.carbs}    target={target.carbs}    unit="g" />
        <StatCell label="Fat"      actual={actual.fat}      target={target.fat}      unit="g" />
      </div>
    </div>
  )
}
