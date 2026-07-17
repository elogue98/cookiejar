'use client'

import { useState, useEffect } from 'react'
import Navigation from '@/app/components/Navigation'
import MacroSettings from '@/app/components/MealJar/MacroSettings'
import MacroProgressBars from '@/app/components/MealJar/MacroProgressBars'
import MealBuilder from '@/app/components/MealJar/MealBuilder'
import {
  MacroTarget,
  MealSelection,
  BadSnackType,
  DEFAULT_TARGET,
  BREAKFAST_MACROS,
  GRANOLA_SNACK_MACROS,
  PROTEIN_SHAKE_MACROS,
  BANANA_MACROS,
  APPLE_MACROS,
  PROTEINS,
  CARBS,
  VEGS,
  addMacros,
  getRemainingTargets,
  splitMealTargets,
  calculateMealPortions,
  calculateBadSnackMacros,
  parseStoredMacroTarget,
} from '@/lib/mealData'

const EMPTY_SELECTION: MealSelection = { protein: null, carbs: [], vegs: [] }

const BAD_SNACK_LABELS: Record<BadSnackType, string> = {
  dark_choc: 'Dark Choc',
  choc: 'Chocolate',
  bun: 'Bun / Pastry',
}

export default function MealJarContent() {
  const [mounted, setMounted] = useState(false)
  const [targets, setTargets] = useState<MacroTarget>(DEFAULT_TARGET)
  const [includeBanana, setIncludeBanana] = useState(true)
  const [includeApple, setIncludeApple] = useState(true)
  const [includeShake, setIncludeShake] = useState(false)
  const [includeBadSnack, setIncludeBadSnack] = useState(false)
  const [badSnackCalories, setBadSnackCalories] = useState(100)
  const [badSnackType, setBadSnackType] = useState<BadSnackType>('dark_choc')
  const [lunchSelection, setLunchSelection] = useState<MealSelection>(EMPTY_SELECTION)
  const [dinnerSelection, setDinnerSelection] = useState<MealSelection>(EMPTY_SELECTION)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem('mealjar:targets')
        setTargets(parseStoredMacroTarget(stored))
      } catch { /* ignore */ }
      setMounted(true)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem('mealjar:targets', JSON.stringify(targets)) }
    catch { /* ignore */ }
  }, [targets, mounted])

  const badSnackMacros = includeBadSnack ? calculateBadSnackMacros(badSnackCalories, badSnackType) : undefined
  const remaining = getRemainingTargets(targets, includeShake, badSnackMacros, includeBanana, includeApple)
  const { lunch: lunchTarget, dinner: dinnerTarget } = splitMealTargets(remaining)

  const lunchResult  = calculateMealPortions(lunchTarget,  lunchSelection,  PROTEINS, CARBS, VEGS)
  const dinnerResult = calculateMealPortions(dinnerTarget, dinnerSelection, PROTEINS, CARBS, VEGS)

  const fixedBase    = addMacros(BREAKFAST_MACROS, GRANOLA_SNACK_MACROS)
  const withBanana   = includeBanana   ? addMacros(fixedBase,   BANANA_MACROS)        : fixedBase
  const withApple    = includeApple    ? addMacros(withBanana,  APPLE_MACROS)         : withBanana
  const withShake    = includeShake    ? addMacros(withApple,   PROTEIN_SHAKE_MACROS) : withApple
  const withSnack    = badSnackMacros  ? addMacros(withShake,   badSnackMacros)       : withShake
  const lunchActual  = { calories: lunchResult.totalCalories,  protein: lunchResult.totalProtein,  carbs: lunchResult.totalCarbs,  fat: lunchResult.totalFat  }
  const dinnerActual = { calories: dinnerResult.totalCalories, protein: dinnerResult.totalProtein, carbs: dinnerResult.totalCarbs, fat: dinnerResult.totalFat }
  const dailyActual  = addMacros(withSnack, addMacros(lunchActual, dinnerActual))

  // Extras total — sum of active toggles only
  const extrasTotal = [
    includeBanana   ? BANANA_MACROS        : null,
    includeApple    ? APPLE_MACROS         : null,
    includeShake    ? PROTEIN_SHAKE_MACROS : null,
    badSnackMacros  ?? null,
  ].reduce<MacroTarget>(
    (acc, m) => m ? addMacros(acc, m) : acc,
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const hasAnyExtra = includeBanana || includeApple || includeShake || includeBadSnack

  if (!mounted) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <Navigation forceTheme="mealjar" />

      {/* Sticky macro banner */}
      <div className="sticky top-[73px] z-40 shadow-sm" style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="max-w-4xl mx-auto px-4">
          <MacroProgressBars target={targets} actual={dailyActual} />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Settings */}
        <MacroSettings targets={targets} onTargetsChange={setTargets} />

        {/* Fixed Meals */}
        <div
          className="rounded-2xl shadow-sm overflow-hidden"
          style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
        >
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>Fixed Meals</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--text-muted)' }}>
              {BREAKFAST_MACROS.calories + GRANOLA_SNACK_MACROS.calories} kcal baseline
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {/* Breakfast */}
            <div className="px-5 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>Breakfast</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  3 eggs · sourdough · ½ avocado · 1 tbsp EVOO · chilli oil
                </p>
              </div>
              <MacroChips macros={BREAKFAST_MACROS} />
            </div>

            {/* Granola snack */}
            <div className="px-5 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>Granola Snack</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  50g granola · 250g low-fat yoghurt · 120g mixed berries
                </p>
              </div>
              <MacroChips macros={GRANOLA_SNACK_MACROS} />
            </div>

            {/* Extras — all toggles on one row */}
            <div className="px-5 py-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <PillToggle label="Banana" active={includeBanana} onToggle={() => setIncludeBanana(!includeBanana)} />
                <PillToggle label="Apple" active={includeApple} onToggle={() => setIncludeApple(!includeApple)} />
                <PillToggle label="Protein Shake" active={includeShake} onToggle={() => setIncludeShake(!includeShake)} />
                <PillToggle label="Bad Snack" active={includeBadSnack} onToggle={() => setIncludeBadSnack(!includeBadSnack)} />
                {hasAnyExtra && (
                  <span className="ml-auto text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {Math.round(extrasTotal.calories)} kcal · P{Math.round(extrasTotal.protein)}g · C{Math.round(extrasTotal.carbs)}g · F{Math.round(extrasTotal.fat)}g
                  </span>
                )}
              </div>

              {/* Bad snack options — shown inline below when active */}
              {includeBadSnack && (
                <div className="flex items-center gap-2 flex-wrap pl-1">
                  <input
                    type="number"
                    value={badSnackCalories}
                    onChange={(e) => setBadSnackCalories(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-20 px-2 py-1 rounded-lg text-sm font-medium focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>kcal</span>
                  {(Object.keys(BAD_SNACK_LABELS) as BadSnackType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setBadSnackType(t)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: badSnackType === t ? 'var(--primary)' : 'var(--bg-main)',
                        color: badSnackType === t ? '#fff' : 'var(--text-muted)',
                        borderColor: badSnackType === t ? 'var(--primary)' : 'var(--border-color)',
                      }}
                    >
                      {BAD_SNACK_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lunch + Dinner stacked */}
        <div className="space-y-4">
          <MealBuilder
            slot="lunch"
            target={lunchTarget}
            selection={lunchSelection}
            onSelectionChange={setLunchSelection}
            result={lunchResult.portions.length > 0 ? lunchResult : null}
          />
          <MealBuilder
            slot="dinner"
            target={dinnerTarget}
            selection={dinnerSelection}
            onSelectionChange={setDinnerSelection}
            result={dinnerResult.portions.length > 0 ? dinnerResult : null}
          />
        </div>

      </main>
    </div>
  )
}

function MacroChips({ macros }: { macros: { calories: number; protein: number; carbs: number; fat: number } }) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0">
      {[`${macros.calories} kcal`, `P ${macros.protein}g`, `C ${macros.carbs}g`, `F ${macros.fat}g`].map((label) => (
        <span key={label} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--text-muted)' }}>
          {label}
        </span>
      ))}
    </div>
  )
}

function PillToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
      style={{
        backgroundColor: active ? 'var(--primary)' : 'var(--bg-main)',
        color: active ? '#fff' : 'var(--text-muted)',
        borderColor: active ? 'var(--primary)' : 'var(--border-color)',
      }}
    >
      {label}
    </button>
  )
}
