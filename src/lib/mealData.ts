export type MacroTarget = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type MealSlot = 'lunch' | 'dinner'

export type FoodItem = {
  id: string
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  cookedToDryRatio?: number  // display-only: divide cooked grams by this to get dry/raw grams
}

export type VegItem = FoodItem & { fixedPortionG: number }

export type MealSelection = {
  protein: string | null
  carbs: string[]
  vegs: string[]
}

export type PortionResult = {
  food: FoodItem | VegItem
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type MealResult = {
  portions: PortionResult[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
}

export const PROTEINS: FoodItem[] = [
  { id: 'chicken', name: 'Chicken Breast', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { id: 'mince', name: '5% Beef Mince', caloriesPer100g: 137, proteinPer100g: 24, carbsPer100g: 0, fatPer100g: 4.6 },
  { id: 'salmon', name: 'Salmon', caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13 },
  { id: 'cod', name: 'Cod / Haddock', caloriesPer100g: 82, proteinPer100g: 18, carbsPer100g: 0, fatPer100g: 0.9 },
]

export const CARBS: FoodItem[] = [
  { id: 'rice', name: 'White Rice', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, cookedToDryRatio: 3.0 },
  { id: 'potato', name: 'Potatoes', caloriesPer100g: 77, proteinPer100g: 2, carbsPer100g: 17, fatPer100g: 0.1, cookedToDryRatio: 1.05 },
  { id: 'sweet_potato', name: 'Sweet Potato', caloriesPer100g: 90, proteinPer100g: 2, carbsPer100g: 21, fatPer100g: 0.1, cookedToDryRatio: 1.08 },
  { id: 'pasta', name: 'Pasta', caloriesPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1, cookedToDryRatio: 2.4 },
]

export const VEGS: VegItem[] = [
  { id: 'broccoli', name: 'Broccoli', caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 7, fatPer100g: 0.4, fixedPortionG: 120 },
  { id: 'carrots', name: 'Carrots', caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 10, fatPer100g: 0.2, fixedPortionG: 120 },
  { id: 'asparagus', name: 'Asparagus', caloriesPer100g: 20, proteinPer100g: 2.2, carbsPer100g: 3.7, fatPer100g: 0.1, fixedPortionG: 120 },
]

export const BREAKFAST_MACROS: MacroTarget = { calories: 625, protein: 35, carbs: 40, fat: 35 }
export const GRANOLA_SNACK_MACROS: MacroTarget = { calories: 370, protein: 20, carbs: 38, fat: 14 }
export const PROTEIN_SHAKE_MACROS: MacroTarget = { calories: 200, protein: 30, carbs: 8, fat: 3 }
// 1 medium banana (~120g)
export const BANANA_MACROS: MacroTarget = { calories: 105, protein: 1, carbs: 27, fat: 0 }
// 1 medium apple (~182g)
export const APPLE_MACROS: MacroTarget = { calories: 95, protein: 1, carbs: 25, fat: 0 }

export type BadSnackType = 'dark_choc' | 'choc' | 'bun'

// Macro grams per 100 calories for each snack type
const BAD_SNACK_RATIOS: Record<BadSnackType, { protein: number; carbs: number; fat: number }> = {
  dark_choc: { protein: 1.3, carbs: 7.7, fat: 7.2 },
  choc:      { protein: 1.5, carbs: 11.0, fat: 5.6 },
  bun:       { protein: 2.2, carbs: 11.0, fat: 5.2 },
}

export function calculateBadSnackMacros(calories: number, type: BadSnackType): MacroTarget {
  const r = BAD_SNACK_RATIOS[type]
  const scale = calories / 100
  return {
    calories,
    protein: Math.round(r.protein * scale * 10) / 10,
    carbs:   Math.round(r.carbs   * scale * 10) / 10,
    fat:     Math.round(r.fat     * scale * 10) / 10,
  }
}

export const DEFAULT_TARGET: MacroTarget = { calories: 2400, protein: 175, carbs: 260, fat: 68 }

function isMacroTarget(value: unknown): value is MacroTarget {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<keyof MacroTarget, unknown>
  return (['calories', 'protein', 'carbs', 'fat'] as const).every((key) => {
    const amount = candidate[key]
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
  })
}

export function parseStoredMacroTarget(value: string | null): MacroTarget {
  if (!value) return DEFAULT_TARGET

  try {
    const parsed: unknown = JSON.parse(value)
    if (!isMacroTarget(parsed) || parsed.calories === 2650) return DEFAULT_TARGET
    return parsed
  } catch {
    return DEFAULT_TARGET
  }
}

export function addMacros(a: MacroTarget, b: MacroTarget): MacroTarget {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  }
}

export function subtractMacros(a: MacroTarget, b: MacroTarget): MacroTarget {
  return {
    calories: Math.max(0, a.calories - b.calories),
    protein: Math.max(0, a.protein - b.protein),
    carbs: Math.max(0, a.carbs - b.carbs),
    fat: Math.max(0, a.fat - b.fat),
  }
}

export function getRemainingTargets(
  dailyTarget: MacroTarget,
  includeShake: boolean,
  badSnack?: MacroTarget,
  includeBanana?: boolean,
  includeApple?: boolean
): MacroTarget {
  const fixed = addMacros(BREAKFAST_MACROS, GRANOLA_SNACK_MACROS)
  const withShake = includeShake ? addMacros(fixed, PROTEIN_SHAKE_MACROS) : fixed
  const withBanana = includeBanana ? addMacros(withShake, BANANA_MACROS) : withShake
  const withApple = includeApple ? addMacros(withBanana, APPLE_MACROS) : withBanana
  const withSnack = badSnack ? addMacros(withApple, badSnack) : withApple
  return subtractMacros(dailyTarget, withSnack)
}

// Fixed 60/40 lunch/dinner split — supported by chrononutrition research for
// front-loading calories relative to circadian rhythm and hunger management.
export function splitMealTargets(remaining: MacroTarget): { lunch: MacroTarget; dinner: MacroTarget } {
  const lunchRatio = 0.6
  const dinnerRatio = 0.4
  return {
    lunch: {
      calories: Math.round(remaining.calories * lunchRatio),
      protein: Math.round(remaining.protein * lunchRatio),
      carbs: Math.round(remaining.carbs * lunchRatio),
      fat: Math.round(remaining.fat * lunchRatio),
    },
    dinner: {
      calories: Math.round(remaining.calories * dinnerRatio),
      protein: Math.round(remaining.protein * dinnerRatio),
      carbs: Math.round(remaining.carbs * dinnerRatio),
      fat: Math.round(remaining.fat * dinnerRatio),
    },
  }
}

export function calculateMealPortions(
  target: MacroTarget,
  selection: MealSelection,
  proteins: FoodItem[],
  carbs: FoodItem[],
  vegs: VegItem[]
): MealResult {
  const portions: PortionResult[] = []

  let remainingProtein = target.protein
  let remainingCarbs = target.carbs

  // Veg: fixed portions
  for (const vegId of selection.vegs) {
    const veg = vegs.find((v) => v.id === vegId)
    if (!veg) continue
    const g = veg.fixedPortionG
    const portion: PortionResult = {
      food: veg,
      grams: g,
      calories: (veg.caloriesPer100g / 100) * g,
      protein: (veg.proteinPer100g / 100) * g,
      carbs: (veg.carbsPer100g / 100) * g,
      fat: (veg.fatPer100g / 100) * g,
    }
    portions.push(portion)
    remainingProtein = Math.max(0, remainingProtein - portion.protein)
    remainingCarbs = Math.max(0, remainingCarbs - portion.carbs)
  }

  // Protein source
  if (selection.protein) {
    const food = proteins.find((p) => p.id === selection.protein)
    if (food) {
      const g = food.proteinPer100g > 0 ? (remainingProtein / (food.proteinPer100g / 100)) : 0
      portions.push({
        food,
        grams: g,
        calories: (food.caloriesPer100g / 100) * g,
        protein: (food.proteinPer100g / 100) * g,
        carbs: (food.carbsPer100g / 100) * g,
        fat: (food.fatPer100g / 100) * g,
      })
    }
  }

  // Carb sources — split carb budget equally across all selected carbs
  if (selection.carbs.length > 0) {
    const carbBudgetPerFood = remainingCarbs / selection.carbs.length
    for (const carbId of selection.carbs) {
      const food = carbs.find((c) => c.id === carbId)
      if (!food) continue
      const g = food.carbsPer100g > 0 ? (carbBudgetPerFood / (food.carbsPer100g / 100)) : 0
      portions.push({
        food,
        grams: g,
        calories: (food.caloriesPer100g / 100) * g,
        protein: (food.proteinPer100g / 100) * g,
        carbs: (food.carbsPer100g / 100) * g,
        fat: (food.fatPer100g / 100) * g,
      })
    }
  }

  const totalCalories = portions.reduce((s, p) => s + p.calories, 0)
  const totalProtein = portions.reduce((s, p) => s + p.protein, 0)
  const totalCarbs = portions.reduce((s, p) => s + p.carbs, 0)
  const totalFat = portions.reduce((s, p) => s + p.fat, 0)

  return { portions, totalCalories, totalProtein, totalCarbs, totalFat }
}
