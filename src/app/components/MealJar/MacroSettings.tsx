'use client'

import { useState } from 'react'
import { MacroTarget } from '@/lib/mealData'

interface MacroSettingsProps {
  targets: MacroTarget
  onTargetsChange: (targets: MacroTarget) => void
}

export default function MacroSettings({ targets, onTargetsChange }: MacroSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleChange = (field: keyof MacroTarget, value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num)) return
    onTargetsChange({ ...targets, [field]: num })
  }

  const fields: { key: keyof MacroTarget; label: string; unit: string }[] = [
    { key: 'calories', label: 'Calories', unit: 'kcal' },
    { key: 'protein', label: 'Protein', unit: 'g' },
    { key: 'carbs', label: 'Carbs', unit: 'g' },
    { key: 'fat', label: 'Fat', unit: 'g' },
  ]

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:opacity-80"
        style={{ color: 'var(--text-main)' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold">Daily Macro Targets</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fields.map(({ key, label, unit }) => (
              <div key={key}>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  {label} ({unit})
                </label>
                <input
                  type="number"
                  value={targets[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
