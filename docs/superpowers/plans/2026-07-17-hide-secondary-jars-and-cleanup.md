# Hide Secondary Jars and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cookie Jar the only discoverable product while retaining direct Tip Jar and Meal Jar routes and completing the reviewed safety fixes.

**Architecture:** Keep the existing routes and theme variants, but remove cross-product switches from the shared navigation. Put deterministic, testable data rules in small library helpers, keep UI components responsible for rendering only, and remove the redundant Tip Jar database lookup before the existing conflict-safe upsert.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Supabase, in-app browser QA.

## Global Constraints

- Tip Jar (`/places`) and Meal Jar (`/meals`) remain directly accessible.
- No routes, feature source files, database records, or saved browser preferences are deleted.
- Existing `tipjar` and `mealjar` themes remain registered.
- The meal solver continues to use protein and carbohydrate amounts as its portioning inputs; calories and fat remain resulting values.
- No nutrition values, Google Places behavior, authentication, or database schema changes.
- Use the existing `NEXT_FORCE_WEBPACK=1` package scripts.
- Do not run live imports, deletions, migrations, or other state-changing scripts.
- Do not commit, push, deploy, or install dependencies without separate authorization.

---

### Task 1: Remove cross-product discovery and correct direct-route contrast

**Files:**
- Modify: `src/app/components/Navigation.tsx`

**Interfaces:**
- Consumes: `forceTheme?: string`, `useTheme()`, and the existing Cookie/Tip/Meal route-specific navigation arrays.
- Produces: navigation that never renders a cross-product switch while retaining local branding and links for direct routes.

- [ ] **Step 1: Remove mode-cycling state and behavior**

Delete `isCookieJar`, `cycleMode`, and `nextModeLabel`. Keep the current-theme flags and primary color:

```tsx
const currentTheme = forceTheme || theme || 'cookie'
const isTipJar = currentTheme === 'tipjar'
const isMealJar = currentTheme === 'mealjar'
const modePrimaryColor = isTipJar ? '#3B82F6' : isMealJar ? '#16A34A' : '#D34E4E'
```

- [ ] **Step 2: Remove both switch controls**

Delete the desktop button whose handler is `cycleMode` and the mobile button with copy `Switch to {nextModeLabel}`. Do not change the route-local link arrays:

```tsx
{(isMealJar
  ? [{ label: 'Meals', href: '/meals' }, { label: 'About', href: '/welcome' }]
  : isTipJar
    ? [{ label: 'Places', href: '/places' }, { label: 'About', href: '/welcome' }]
    : [{ label: 'Recipes', href: '/' }, { label: 'About', href: '/welcome' }]
).map((item) => (
  <Link
    key={item.label}
    href={item.href}
    className="relative text-sm font-semibold transition-colors group"
    style={{ color: isTipJar || isMealJar ? '#94A3B8' : '#334155' }}
  >
    {item.label}
    <span
      className="absolute inset-x-0 bottom-[-4px] h-0.5 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-left"
      style={{ backgroundColor: modePrimaryColor }}
    />
  </Link>
))}
```

- [ ] **Step 3: Give the Meal Jar account dropdown a matching dark surface**

Replace the dropdown background expression so its existing light text remains legible:

```tsx
style={{
  backgroundColor: isTipJar ? '#162032' : isMealJar ? '#14532D' : '#FFFFFF',
  border: `1px solid ${
    isTipJar
      ? 'rgba(59, 130, 246, 0.2)'
      : isMealJar
        ? 'rgba(22, 163, 74, 0.35)'
        : 'rgba(0,0,0,0.1)'
  }`,
}}
```

- [ ] **Step 4: Run static checks for the component**

Run:

```bash
npx eslint src/app/components/Navigation.tsx
npx tsc --noEmit
```

Expected: both commands exit `0`; `cycleMode`, `nextModeLabel`, and `isCookieJar` have no remaining references.

- [ ] **Step 5: Review the task diff without committing**

Run:

```bash
git diff --check
git diff -- src/app/components/Navigation.tsx
```

Expected: no whitespace errors, no route deletions, and no cross-product switch control.

---

### Task 2: Validate persisted Meal Jar targets and document the portioning contract

**Files:**
- Create: `src/lib/mealData.test.ts`
- Modify: `src/lib/mealData.ts`
- Modify: `src/app/components/MealJar/MealJarContent.tsx`
- Modify: `src/app/components/MealJar/MealBuilder.tsx`

**Interfaces:**
- Produces: `parseStoredMacroTarget(value: string | null): MacroTarget`.
- Preserves: `calculateMealPortions(...)` continues to size the protein source from remaining protein and carb sources from remaining carbohydrates.

- [ ] **Step 1: Write failing validation and contract tests**

Create `src/lib/mealData.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CARBS,
  DEFAULT_TARGET,
  PROTEINS,
  VEGS,
  calculateMealPortions,
  parseStoredMacroTarget,
} from './mealData'

describe('parseStoredMacroTarget', () => {
  it('returns a complete finite non-negative saved target', () => {
    const stored = JSON.stringify({ calories: 2200, protein: 160, carbs: 230, fat: 70 })

    expect(parseStoredMacroTarget(stored)).toEqual({
      calories: 2200,
      protein: 160,
      carbs: 230,
      fat: 70,
    })
  })

  it.each([
    null,
    'not-json',
    JSON.stringify({ calories: 2200, protein: 160, carbs: 230 }),
    JSON.stringify({ calories: -1, protein: 160, carbs: 230, fat: 70 }),
    JSON.stringify({ calories: 2650, protein: 175, carbs: 260, fat: 68 }),
  ])('falls back to the default for invalid or stale input: %s', (stored) => {
    expect(parseStoredMacroTarget(stored)).toEqual(DEFAULT_TARGET)
  })
})

describe('calculateMealPortions', () => {
  it('uses protein and carbohydrate targets while reporting calories and fat as results', () => {
    const result = calculateMealPortions(
      { calories: 723, protein: 71, carbs: 78, fat: 20 },
      { protein: 'salmon', carbs: ['rice'], vegs: [] },
      PROTEINS,
      CARBS,
      VEGS
    )

    expect(result.portions.map(({ food }) => food.id)).toEqual(['salmon', 'rice'])
    expect(result.portions[0].protein).toBeCloseTo(71)
    expect(result.portions[1].carbs).toBeCloseTo(78)
    expect(result.totalCalories).toBeGreaterThan(723)
    expect(result.totalFat).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 2: Verify the new helper test fails for the expected reason**

Run:

```bash
npm test -- src/lib/mealData.test.ts
```

Expected: FAIL because `parseStoredMacroTarget` is not exported. The portioning-contract test may already pass and records intentionally preserved behavior.

- [ ] **Step 3: Implement saved-target parsing at the data boundary**

Add to `src/lib/mealData.ts` after `DEFAULT_TARGET`:

```ts
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
```

- [ ] **Step 4: Use the parser and remove the misleading meal calorie target**

In `MealJarContent.tsx`, import `parseStoredMacroTarget` and replace the local parsing block with:

```tsx
const stored = localStorage.getItem('mealjar:targets')
setTargets(parseStoredMacroTarget(stored))
```

In `MealBuilder.tsx`, render only the enforced targets in the header:

```tsx
<div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
  <span>{target.protein}g protein</span>
  <span>·</span>
  <span>{target.carbs}g carbs</span>
</div>
```

- [ ] **Step 5: Verify the focused tests pass**

Run:

```bash
npm test -- src/lib/mealData.test.ts
```

Expected: PASS with all validation and portioning-contract cases green.

- [ ] **Step 6: Review the task diff without committing**

Run:

```bash
git diff --check
git diff -- src/lib/mealData.ts src/lib/mealData.test.ts src/app/components/MealJar/MealJarContent.tsx src/app/components/MealJar/MealBuilder.tsx
```

Expected: parsing is centralized, the 2650-calorie stale default resets safely, and no nutrition constants or solver formulas changed.

---

### Task 3: Make macro progress state correct and testable

**Files:**
- Create: `src/lib/macroProgress.ts`
- Create: `src/lib/macroProgress.test.ts`
- Modify: `src/app/components/MealJar/MacroProgressBars.tsx`

**Interfaces:**
- Produces: `getMacroProgress(actual: number, target: number): MacroProgress`.
- `MacroProgress` contains `widthPercentage`, `color`, and `statusText(unit)` data without React dependencies.

- [ ] **Step 1: Write failing progress-state tests**

Create `src/lib/macroProgress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getMacroProgress } from './macroProgress'

describe('getMacroProgress', () => {
  it('caps rendered width while marking values over target red', () => {
    expect(getMacroProgress(120, 100)).toEqual({
      widthPercentage: 100,
      color: '#EF4444',
      difference: 20,
      isOver: true,
    })
  })

  it('reports the remaining amount below target', () => {
    expect(getMacroProgress(70, 100)).toEqual({
      widthPercentage: 70,
      color: 'var(--primary)',
      difference: 30,
      isOver: false,
    })
  })

  it('uses the warning color from ninety through one hundred percent', () => {
    expect(getMacroProgress(90, 100).color).toBe('#F59E0B')
    expect(getMacroProgress(100, 100).color).toBe('#F59E0B')
  })

  it('renders a full red bar when a zero target is exceeded', () => {
    expect(getMacroProgress(1, 0)).toEqual({
      widthPercentage: 100,
      color: '#EF4444',
      difference: 1,
      isOver: true,
    })
  })
})
```

- [ ] **Step 2: Verify the tests fail because the helper does not exist**

Run:

```bash
npm test -- src/lib/macroProgress.test.ts
```

Expected: FAIL resolving `./macroProgress`.

- [ ] **Step 3: Implement the pure progress helper**

Create `src/lib/macroProgress.ts`:

```ts
export type MacroProgress = {
  widthPercentage: number
  color: string
  difference: number
  isOver: boolean
}

export function getMacroProgress(actual: number, target: number): MacroProgress {
  const isOver = actual > target
  const percentage = target > 0 ? (actual / target) * 100 : isOver ? 100 : 0

  return {
    widthPercentage: Math.max(0, Math.min(100, percentage)),
    color: isOver ? '#EF4444' : percentage >= 90 ? '#F59E0B' : 'var(--primary)',
    difference: Math.abs(Math.round(target - actual)),
    isOver,
  }
}
```

- [ ] **Step 4: Render the helper state with a GPU-friendly bar transition**

In `MacroProgressBars.tsx`, import `getMacroProgress` and replace the local percentage calculations with:

```tsx
const progress = getMacroProgress(actual, target)
const status = progress.isOver
  ? `${progress.difference}${unit} over`
  : `${progress.difference}${unit} left`
```

Replace the status and bar markup with:

```tsx
<span className="text-xs" style={{ color: 'var(--text-muted)' }}>{status}</span>

<div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
  <div
    className="h-full w-full rounded-full origin-left transition-transform duration-200"
    style={{
      transform: `scaleX(${progress.widthPercentage / 100})`,
      backgroundColor: progress.color,
    }}
  />
</div>
```

- [ ] **Step 5: Verify the focused tests pass**

Run:

```bash
npm test -- src/lib/macroProgress.test.ts
```

Expected: PASS with three tests.

- [ ] **Step 6: Review the task diff without committing**

Run:

```bash
git diff --check
git diff -- src/lib/macroProgress.ts src/lib/macroProgress.test.ts src/app/components/MealJar/MacroProgressBars.tsx
```

Expected: over-target state is red, rendered width never exceeds 100%, and the bar animates only `transform` for 200ms.

---

### Task 4: Replace biased loading-message sorting with deterministic Fisher–Yates

**Files:**
- Create: `src/lib/shuffle.ts`
- Create: `src/lib/shuffle.test.ts`
- Modify: `src/app/components/LoadingOverlayV2.tsx`

**Interfaces:**
- Produces: `shuffle<T>(items: readonly T[], random?: () => number): T[]`.
- Consumes: read-only `LOADING_MESSAGES`; returns a new array once per overlay mount.

- [ ] **Step 1: Write failing shuffle tests**

Create `src/lib/shuffle.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('returns every item once without mutating the source', () => {
    const source = ['one', 'two', 'three'] as const

    const result = shuffle(source, () => 0)

    expect(result).toEqual(['two', 'three', 'one'])
    expect(source).toEqual(['one', 'two', 'three'])
  })

  it('handles empty and single-item arrays', () => {
    expect(shuffle([], () => 0)).toEqual([])
    expect(shuffle(['only'], () => 0)).toEqual(['only'])
  })
})
```

- [ ] **Step 2: Verify the tests fail because the helper does not exist**

Run:

```bash
npm test -- src/lib/shuffle.test.ts
```

Expected: FAIL resolving `./shuffle`.

- [ ] **Step 3: Implement the non-mutating Fisher–Yates helper**

Create `src/lib/shuffle.ts`:

```ts
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}
```

- [ ] **Step 4: Shuffle once per loading-overlay mount**

In `LoadingOverlayV2.tsx`, import the helper and replace the comparator sort:

```tsx
import { shuffle } from '@/lib/shuffle'

const [messages] = useState(() => shuffle(LOADING_MESSAGES))
```

Keep the three-second interval and existing cancellation behavior unchanged.

- [ ] **Step 5: Verify the focused tests pass**

Run:

```bash
npm test -- src/lib/shuffle.test.ts
```

Expected: PASS with both tests and no source-array mutation.

- [ ] **Step 6: Review the task diff without committing**

Run:

```bash
git diff --check
git diff -- src/lib/shuffle.ts src/lib/shuffle.test.ts src/app/components/LoadingOverlayV2.tsx
```

Expected: no random comparator sorting remains and overlay timing/cancellation code is untouched.

---

### Task 5: Remove the redundant Tip Jar lookup before upsert

**Files:**
- Modify: `src/app/api/places/import/route.test.ts`
- Modify: `src/app/api/places/import/route.ts`

**Interfaces:**
- Preserves: `POST(req: Request)` response and the existing `upsert(..., { onConflict: 'google_place_id' })` persistence contract.
- Removes: a top-level `places.select(...).eq(...).maybeSingle()` round trip whose result is unused.

- [ ] **Step 1: Make the route test fail if an existing-place lookup occurs**

Add `placeLookups` to the Supabase test-double state and expose it:

```ts
const state = {
  placeLookups: 0,
  upsertedPlaces: [] as SavedPlace[],
}

get placeLookups() {
  return state.placeLookups
},
get upsertedPlaces() {
  return state.upsertedPlaces
},
reset() {
  state.placeLookups = 0
  state.upsertedPlaces = []
},
```

Increment it in the top-level `select` branch:

```ts
select: () => {
  state.placeLookups += 1
  return {
    eq: () => ({
      maybeSingle: async () => ({ data: null, error: null }),
    }),
  }
},
```

Add this assertion to both successful import tests:

```ts
expect(supabaseMock.placeLookups).toBe(0)
```

- [ ] **Step 2: Verify the route tests fail on the redundant lookup**

Run:

```bash
npm test -- src/app/api/places/import/route.test.ts
```

Expected: FAIL because `placeLookups` is `1`.

- [ ] **Step 3: Remove the unused lookup and error branch**

Delete this entire block from `route.ts`:

```ts
const { error: existingPlaceError } = await supabase
  .from('places')
  .select('*')
  .eq('google_place_id', resolvedPlaceId)
  .maybeSingle()

if (existingPlaceError) {
  console.error('Failed to look up existing place', existingPlaceError)
  return NextResponse.json(
    { success: false, error: 'Could not check for existing place' },
    { status: 500 }
  )
}
```

Leave the conflict-safe upsert unchanged.

- [ ] **Step 4: Verify the focused route tests pass**

Run:

```bash
npm test -- src/app/api/places/import/route.test.ts
```

Expected: PASS with both imports making zero preliminary place lookups.

- [ ] **Step 5: Review the task diff without committing**

Run:

```bash
git diff --check
git diff -- src/app/api/places/import/route.ts src/app/api/places/import/route.test.ts
```

Expected: only the unused lookup is removed; upsert and response behavior remain intact.

---

### Task 6: Full verification and browser QA

**Files:**
- Review only: all files in the final working-tree diff.

**Interfaces:**
- Verifies: the complete approved design and all repository definition-of-done requirements.

- [ ] **Step 1: Run the full mechanical suite**

Run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Expected: 0 test failures, TypeScript exit `0`, ESLint exit `0`, build exit `0`, and no whitespace errors. The existing `baseline-browser-mapping` age notice may remain informational.

- [ ] **Step 2: Start the existing development server**

Run:

```bash
npm run dev
```

Expected: Next.js reports a ready local URL without modifying package scripts.

- [ ] **Step 3: Verify Cookie Jar discovery at desktop and mobile widths**

Using the in-app browser, check `/` at `1440x900` and `390x844`:

- The header contains Cookie Jar, Recipes, and About.
- No Tip Jar, Meal Jar, jar switch, Places link, or Meals link is visible.
- The account dropdown and mobile menu still open and close.

- [ ] **Step 4: Verify direct Tip Jar and Meal Jar access**

Using the same browser session:

- Open `/places`; confirm Tip Jar branding and local Places/About links render, with no jar switch.
- Open `/meals`; confirm Meal Jar branding and local Meals/About links render, with no jar switch.
- Open the Meal Jar account dropdown and confirm View Profile is legible on the dark-green surface.
- Exercise Daily Macro Targets and one meal selection without submitting external requests.
- Confirm the browser console contains no errors caused by the changes.

- [ ] **Step 5: Review the final diff and repository state**

Run:

```bash
git status --short --branch
git diff --stat
git diff --check
git diff
```

Expected: no generated artifacts, secrets, route deletions, unrelated refactors, or unexpected database changes. Do not stage, commit, or push.
