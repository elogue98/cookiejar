# 001 — Standardize modal entrances and exits

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Track every checkbox and run the full verification section before declaring completion.

- **Status**: DONE
- **Commit**: 29a6779
- **Severity**: MEDIUM
- **Category**: Missed opportunities, interruptibility, accessibility, and cohesion
- **Estimated scope**: 7 source files; one new shared component; roughly 180–240 changed lines

**Goal:** Give every centered modal in Cookie Jar one interruptible, dependency-free entrance and exit lifecycle, with consistent timing and reduced-motion behavior.

**Architecture:** Add a client-side `AnimatedModal` primitive that owns portal rendering, retained presence during exit, backdrop interaction, optional Escape handling, optional scroll locking, and an `onExited` callback. Put the exact motion tokens and compositor-only transition rules in `src/app/globals.css`, then migrate the five existing modal surfaces without changing their content or business logic.

**Tech stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, CSS transitions, `@starting-style`, React portals, Vitest.

## Global constraints

- Do not add Framer Motion, Motion, React Spring, GSAP, a component-test library, or any other dependency.
- Animate only `transform` and `opacity`.
- Modal panels remain centered and use `transform-origin: center`.
- Enter over `240ms`; exit over `180ms`; use `cubic-bezier(0.23, 1, 0.32, 1)` for both.
- Start panels at `scale(0.97)`, never `scale(0)`.
- Reduced motion keeps a `160ms` opacity transition and removes transform movement.
- Use CSS transitions, not keyframes, so a rapidly reversed open/close retargets from its current visual state.
- Preserve current modal copy, form state, API calls, routing destinations, backdrop-close rules, Escape behavior, scroll locking, and z-index values.
- Do not animate `LoadingOverlayV2`; it is a blocking progress surface, not part of this modal lifecycle.
- Do not change mobile navigation or CookieBot; those are separate findings.
- The executor must preserve all pre-existing worktree changes and must not reformat unrelated code.
- This plan was authored against a dirty worktree. `src/app/globals.css` already contains uncommitted Meal Jar theme work; insert the motion tokens and rules without replacing or reordering those existing declarations.

---

## Problem

Five modal surfaces mount fully settled and disappear immediately. Their implementations duplicate overlay and portal logic, and parent-level conditional rendering prevents any shared exit animation from completing.

```tsx
// src/app/components/ImportRecipeModal.tsx:55 and :304-322 — current
if (!isOpen) return null

return (
  <>
    {(loading || finalizing) && <LoadingOverlay onCancel={handleCancel} />}
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
```

```tsx
// src/app/components/RecipeHistory.tsx:137-145 — current
{isOpen && portalRoot &&
  createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={() => setIsOpen(false)}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
```

```tsx
// src/app/components/DeleteRecipeButton.tsx:91-108 — current
{showConfirmModal && portalRoot &&
  createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleCancel}
    >
```

```tsx
// src/app/components/ImageModal.tsx:37-55 — current
if (!isOpen || !portalRoot) return null

return createPortal(
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
    onClick={onClose}
  >
```

```tsx
// src/app/components/ImportCompletionOverlay.tsx:35-36 and :76-89 — current
if (!visible) {
  return null
}

return (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}
  >
```

The post-import overlay also calls `router.replace()` immediately after setting `visible` false, which would unmount the route before a future exit transition could finish.

## Target

All five surfaces use the same lifecycle:

1. Opening mounts a portal with `data-state="open"`.
2. `@starting-style` supplies `opacity: 0` for the backdrop and `opacity: 0; transform: scale(0.97)` for the panel.
3. The backdrop and panel settle over `240ms cubic-bezier(0.23, 1, 0.32, 1)`.
4. Closing changes the retained portal to `data-state="closing"`.
5. Backdrop and panel transition to opacity zero, with the panel also returning to `scale(0.97)`, over `180ms` using the same curve.
6. The portal unmounts after the panel's opacity transition finishes. A `240ms` fallback timer prevents a disabled stylesheet or missing `transitionend` from trapping the modal in the DOM.
7. Reopening during exit cancels the fallback, keeps the portal mounted, and lets CSS retarget from the current computed state.
8. With `prefers-reduced-motion: reduce`, the panel does not scale; backdrop and panel retain a `160ms` opacity transition.

## Repo conventions to follow

- Shared visual tokens already live in the `:root` block of `src/app/globals.css:3-16`; add motion tokens there.
- Global reusable CSS already lives after theme/base declarations in `src/app/globals.css`; add the modal classes before the existing loading keyframes.
- Client components use `'use client'` and local relative imports, for example `src/app/components/ImportRecipeModal.tsx:1-6`.
- Existing modal content uses both Tailwind classes and inline styles. Keep each panel's current presentation in its existing component; the new primitive owns only root/backdrop/presence motion.
- Current Vitest configuration uses `environment: 'node'` and the repo has no DOM renderer or Testing Library. Do not add a dependency for this plan; validate presence and animation behavior through the browser checks below.

## Files

- Create: `src/app/components/AnimatedModal.tsx` — shared portal, presence, exit, Escape, and scroll-lock lifecycle.
- Modify: `src/app/globals.css` — shared motion tokens and modal transition classes.
- Modify: `src/app/components/ImportRecipeModal.tsx` — migrate the import dialog.
- Modify: `src/app/components/RecipeHistory.tsx` — migrate history and remove duplicated portal/Escape/scroll-lock code.
- Modify: `src/app/components/DeleteRecipeButton.tsx` — migrate destructive confirmation and remove duplicated portal/Escape/scroll-lock code.
- Modify: `src/app/components/ImageModal.tsx` — migrate the image viewer and remove duplicated portal/Escape/scroll-lock code.
- Modify: `src/app/components/ImportCompletionOverlay.tsx` — migrate the success dialog and defer navigation until exit completes.
- Do not create or modify test infrastructure.

## Interfaces

`AnimatedModal` must expose exactly this interface:

```tsx
interface AnimatedModalProps {
  open: boolean
  children: ReactNode
  onClose?: () => void
  onExited?: () => void
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  lockScroll?: boolean
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
  rootClassName?: string
  panelClassName?: string
  rootStyle?: CSSProperties
  backdropStyle?: CSSProperties
  panelStyle?: CSSProperties
}
```

It consumes a controlled `open` boolean. It produces a portal that remains mounted while closing, and invokes `onExited` exactly once after an uninterrupted close.

## Steps

### Task 1: Add the shared motion vocabulary

**Files:**
- Modify: `src/app/globals.css:3-16`
- Modify: `src/app/globals.css:74`

- [x] **Step 1: Add exact motion tokens to the existing `:root` block**

Append these declarations after `--radius-sm`:

```css
  --motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --motion-modal-enter-duration: 240ms;
  --motion-modal-exit-duration: 180ms;
  --motion-modal-reduced-duration: 160ms;
```

Do not name the curve `--ease-out`: Tailwind already owns that generic token, and overriding it would change unrelated `ease-out` utilities across the application.

- [x] **Step 2: Add the modal CSS before the existing loading-animation keyframes**

Insert this exact block immediately before `/* Bounce animation for loading overlay */`:

```css
.modal-motion-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  isolation: isolate;
}

.modal-motion-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 1;
  transition: opacity var(--motion-modal-enter-duration) var(--motion-ease-out);
}

.modal-motion-panel {
  position: relative;
  z-index: 1;
  opacity: 1;
  transform: scale(1);
  transform-origin: center;
  transition:
    transform var(--motion-modal-enter-duration) var(--motion-ease-out),
    opacity var(--motion-modal-enter-duration) var(--motion-ease-out);
  will-change: transform, opacity;
}

.modal-motion-root[data-state='closing'] .modal-motion-backdrop {
  opacity: 0;
  transition-duration: var(--motion-modal-exit-duration);
}

.modal-motion-root[data-state='closing'] {
  pointer-events: none;
}

.modal-motion-root[data-state='closing'] .modal-motion-panel {
  opacity: 0;
  transform: scale(0.97);
  transition-duration: var(--motion-modal-exit-duration);
}

@starting-style {
  .modal-motion-root[data-state='open'] .modal-motion-backdrop {
    opacity: 0;
  }

  .modal-motion-root[data-state='open'] .modal-motion-panel {
    opacity: 0;
    transform: scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-motion-backdrop,
  .modal-motion-panel {
    transition-property: opacity;
    transition-duration: var(--motion-modal-reduced-duration);
  }

  .modal-motion-root[data-state='closing'] .modal-motion-backdrop,
  .modal-motion-root[data-state='closing'] .modal-motion-panel {
    transition-duration: var(--motion-modal-reduced-duration);
  }

  .modal-motion-panel,
  .modal-motion-root[data-state='closing'] .modal-motion-panel {
    transform: none;
  }

  @starting-style {
    .modal-motion-root[data-state='open'] .modal-motion-panel {
      opacity: 0;
      transform: none;
    }
  }
}
```

- [x] **Step 3: Inspect the generated CSS contract**

Run:

```bash
rg -n "motion-modal|modal-motion|prefers-reduced-motion" src/app/globals.css
```

Expected: four token declarations, the root/backdrop/panel rules, closing-state rules, `@starting-style`, and the reduced-motion override. No `transition: all`, animated layout property, or keyframe should appear in this new block.

### Task 2: Build the retained-presence modal primitive

**Files:**
- Create: `src/app/components/AnimatedModal.tsx`

- [x] **Step 1: Create the component with the complete implementation below**

Execution note: review found that the original scaffold triggered `react-hooks/set-state-in-effect`, could hydrate an initially open portal inconsistently, and allowed narrow stale timer/transition races. The final implementation preserves the specified public API and motion contract while adding a hydration-safe `useSyncExternalStore` gate and generation-checked, exactly-once exit completion.

```tsx
'use client'

import type { CSSProperties, ReactNode, TransitionEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const EXIT_FALLBACK_MS = 240

interface AnimatedModalProps {
  open: boolean
  children: ReactNode
  onClose?: () => void
  onExited?: () => void
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  lockScroll?: boolean
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
  rootClassName?: string
  panelClassName?: string
  rootStyle?: CSSProperties
  backdropStyle?: CSSProperties
  panelStyle?: CSSProperties
}

export default function AnimatedModal({
  open,
  children,
  onClose,
  onExited,
  closeOnBackdrop = false,
  closeOnEscape = false,
  lockScroll = false,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  rootClassName = '',
  panelClassName = '',
  rootStyle,
  backdropStyle,
  panelStyle,
}: AnimatedModalProps) {
  const [isMounted, setIsMounted] = useState(open)
  const exitCompletedRef = useRef(false)

  const finishExit = useCallback(() => {
    if (open || exitCompletedRef.current) return

    exitCompletedRef.current = true
    setIsMounted(false)
    onExited?.()
  }, [onExited, open])

  useEffect(() => {
    if (open) {
      exitCompletedRef.current = false
      setIsMounted(true)
      return
    }

    if (!isMounted) return

    const fallback = window.setTimeout(finishExit, EXIT_FALLBACK_MS)
    return () => window.clearTimeout(fallback)
  }, [finishExit, isMounted, open])

  useEffect(() => {
    if (!isMounted || !lockScroll) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMounted, lockScroll])

  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeOnEscape, onClose, open])

  const handlePanelTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      event.propertyName === 'opacity' &&
      !open
    ) {
      finishExit()
    }
  }

  if (!isMounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`modal-motion-root ${rootClassName}`.trim()}
      data-state={open ? 'open' : 'closing'}
      style={rootStyle}
    >
      <div
        aria-hidden="true"
        className="modal-motion-backdrop"
        style={backdropStyle}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={`modal-motion-panel ${panelClassName}`.trim()}
        style={panelStyle}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
```

The fallback is deliberately `240ms`: it exceeds the `180ms` exit by `60ms`, but still completes before the maximum `500ms` modal budget. It is lifecycle insurance, not a visual duration.

- [x] **Step 2: Type-check the new interface before migrating callers**

Run:

```bash
npx tsc --noEmit
```

Expected at this intermediate point: exit code 0. If pre-existing user work produces errors unrelated to `AnimatedModal.tsx`, record those exact errors and continue only if the new file introduces none.

### Task 3: Migrate the import, history, delete, and image modals

**Files:**
- Modify: `src/app/components/ImportRecipeModal.tsx:1-7,55,304-748`
- Modify: `src/app/components/RecipeHistory.tsx:1-5,31,62-80,136-236`
- Modify: `src/app/components/DeleteRecipeButton.tsx:1-6,17-38,91-227`
- Modify: `src/app/components/ImageModal.tsx:1-5,15-37,39-112`

- [x] **Step 1: Migrate `ImportRecipeModal` without changing its close behavior**

Add:

```tsx
import AnimatedModal from './AnimatedModal'
```

Remove `if (!isOpen) return null`. Replace only the two current outer overlay `<div>` opening tags with this exact opening tag:

```tsx
<AnimatedModal
  open={isOpen}
  onClose={handleClose}
  closeOnBackdrop
  ariaLabelledBy="import-recipe-modal-title"
  rootStyle={{ padding: 0, zIndex: 1000 }}
  backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
  panelStyle={{
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  }}
>
```

Leave the current header, tabs, URL/image/text forms, validation errors, and actions directly after that opening tag. Replace the two closing tags that currently end the panel and overlay with one exact closing tag:

```tsx
</AnimatedModal>
```

Add `id="import-recipe-modal-title"` to the existing `Import Recipe` `<h2>`. Do not set `closeOnEscape` or `lockScroll`: the current component does neither, and this plan preserves behavior.

Keep `<LoadingOverlay onCancel={handleCancel} />` as the sibling before `AnimatedModal`. Its `z-[9999]` must remain above the modal's `z-index: 1000` while import processing is active.

- [x] **Step 2: Migrate `RecipeHistory` and remove only duplicated lifecycle code**

Replace the React portal import with:

```tsx
import AnimatedModal from './AnimatedModal'
```

Delete `portalRoot` and delete the `useEffect` at current lines 62–80 that handles Escape and scroll locking. Keep the fetch-on-mount and fetch-on-open effects.

Replace the `{isOpen && portalRoot && createPortal(...)}` wrapper and the current panel opening tag with this exact opening tag:

```tsx
<AnimatedModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  closeOnBackdrop
  closeOnEscape
  lockScroll
  ariaLabelledBy="recipe-history-modal-title"
  rootClassName="p-4"
  rootStyle={{ zIndex: 50 }}
  backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
  panelClassName="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
>
```

Leave the current header and history content directly after that tag. Replace the panel/overlay/portal closing sequence with:

```tsx
</AnimatedModal>
```

Add `id="recipe-history-modal-title"` to the existing `Recipe History` `<h2>`. Remove the panel's obsolete `onClick={(e) => e.stopPropagation()}` because the backdrop is now a sibling rather than an ancestor.

- [x] **Step 3: Migrate `DeleteRecipeButton` as an alert dialog**

Change imports to:

```tsx
import { useState } from 'react'
import AnimatedModal from './AnimatedModal'
```

Remove `createPortal`, `portalRoot`, and the current Escape/scroll-lock effect. Replace the conditional portal wrapper and current panel opening tag with this exact opening tag:

```tsx
<AnimatedModal
  open={showConfirmModal}
  onClose={handleCancel}
  closeOnBackdrop
  closeOnEscape
  lockScroll
  role="alertdialog"
  ariaLabelledBy="delete-recipe-modal-title"
  rootStyle={{ padding: 0, zIndex: 1000 }}
  backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
  panelStyle={{
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    maxWidth: '480px',
    width: '90%',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  }}
>
```

Leave the warning, error, and action controls directly after that tag. Replace the panel/overlay/portal closing sequence with:

```tsx
</AnimatedModal>
```

Add `id="delete-recipe-modal-title"` to the existing `Delete Recipe?` `<h2>`. Remove the old panel click-stop handler; do not alter deletion, error, disabled, or routing behavior.

- [x] **Step 4: Migrate `ImageModal` and preserve its 90vw geometry**

Change imports to:

```tsx
import Image from 'next/image'
import AnimatedModal from './AnimatedModal'
```

Remove `useEffect`, `createPortal`, `portalRoot`, and the early return. Replace the current portal and two outer `<div>` opening tags with this exact opening tag:

```tsx
<AnimatedModal
  open={isOpen}
  onClose={onClose}
  closeOnBackdrop
  closeOnEscape
  lockScroll
  ariaLabel={`Expanded image: ${alt}`}
  rootStyle={{ padding: 0, zIndex: 1000 }}
  backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
  panelStyle={{
    maxWidth: '90vw',
    maxHeight: '90vh',
    width: '90vw',
    height: '90vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
>
```

Leave the current `Image` and close button directly after that tag. Replace the panel/overlay/portal closing sequence with:

```tsx
</AnimatedModal>
```

The base `.modal-motion-panel` already supplies `position: relative`, which the fill image requires. Remove the old panel click-stop handler.

- [x] **Step 5: Run focused static checks after the four migrations**

Run:

```bash
rg -n "createPortal|portalRoot|if \(!isOpen|showConfirmModal &&|isOpen && portalRoot" \
  src/app/components/ImportRecipeModal.tsx \
  src/app/components/RecipeHistory.tsx \
  src/app/components/DeleteRecipeButton.tsx \
  src/app/components/ImageModal.tsx
npx tsc --noEmit
```

Expected: `createPortal`, `portalRoot`, and parent-level modal conditionals are gone from these four components; type-check exits 0 or reports only a separately recorded pre-existing failure.

### Task 4: Make post-import navigation wait for the exit

**Files:**
- Modify: `src/app/components/ImportCompletionOverlay.tsx:1-4,22-36,39-74,76-191`

- [x] **Step 1: Add exit-aware navigation state**

Change imports to:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AnimatedModal from './AnimatedModal'
```

Add this state next to `visible`:

```tsx
const [shouldNavigateAfterExit, setShouldNavigateAfterExit] = useState(false)
```

Replace the existing `isOpen` synchronization effect with:

```tsx
useEffect(() => {
  setVisible(isOpen)
  if (isOpen) setShouldNavigateAfterExit(false)
}, [isOpen])
```

Add these functions before `handleFinish`:

```tsx
const closeAndNavigate = () => {
  setShouldNavigateAfterExit(true)
  setVisible(false)
}

const handleExited = useCallback(() => {
  if (shouldNavigateAfterExit) router.replace(destinationPath)
}, [destinationPath, router, shouldNavigateAfterExit])
```

- [x] **Step 2: Replace both immediate navigation branches**

In the unchanged-cookbook branch, replace:

```tsx
setVisible(false)
router.replace(destinationPath)
```

with:

```tsx
closeAndNavigate()
```

After a successful save, make the same replacement. Do not change fetch method, endpoint, payload, error handling, or saving state.

- [x] **Step 3: Replace the overlay wrapper**

Remove the `if (!visible) return null` branch. Replace the outer overlay and panel opening tags with this exact opening tag:

```tsx
<AnimatedModal
  open={visible}
  onExited={handleExited}
  ariaLabelledBy="import-completion-modal-title"
  rootStyle={{ padding: '20px', zIndex: 1000 }}
  backdropStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
  panelStyle={{
    backgroundColor: '#fff',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '560px',
    padding: '40px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.18)',
    textAlign: 'center',
  }}
>
```

Leave the checkmark, copy, input, error, and finish button directly after that tag. Replace the panel and overlay closing tags with:

```tsx
</AnimatedModal>
```

Add `id="import-completion-modal-title"` to the existing `Recipe imported!` `<h2>`. Do not enable backdrop close, Escape close, or scroll locking because the current completion step is intentionally blocking.

- [x] **Step 4: Verify navigation is represented only by the exit callback**

Run:

```bash
rg -n "router\.replace|closeAndNavigate|handleExited|AnimatedModal" src/app/components/ImportCompletionOverlay.tsx
```

Expected: one `router.replace(destinationPath)` inside `handleExited`, two `closeAndNavigate()` call sites, and one `AnimatedModal` usage.

### Task 5: Mechanical verification

**Files:**
- Verify all files listed above; do not edit unrelated failures.

- [x] **Step 1: Run the complete repository test suite**

```bash
npm test
```

Expected: all Vitest test files pass with zero failures. This plan adds no DOM unit test because `vitest.config.ts` uses the Node environment and the repository has no authorized component-rendering dependency.

- [x] **Step 2: Run type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both commands exit 0. If either exposes a pre-existing failure from the dirty worktree, record the exact command/output and confirm no diagnostic points to the seven in-scope source files.

- [x] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Next.js production build exits 0. Do not change environment variables, migrations, or external data to make the build pass.

- [x] **Step 4: Review the scoped diff**

```bash
git status --short -- \
  src/app/globals.css \
  src/app/components/AnimatedModal.tsx \
  src/app/components/ImportRecipeModal.tsx \
  src/app/components/RecipeHistory.tsx \
  src/app/components/DeleteRecipeButton.tsx \
  src/app/components/ImageModal.tsx \
  src/app/components/ImportCompletionOverlay.tsx
git diff -- \
  src/app/globals.css \
  src/app/components/AnimatedModal.tsx \
  src/app/components/ImportRecipeModal.tsx \
  src/app/components/RecipeHistory.tsx \
  src/app/components/DeleteRecipeButton.tsx \
  src/app/components/ImageModal.tsx \
  src/app/components/ImportCompletionOverlay.tsx
sed -n '1,260p' src/app/components/AnimatedModal.tsx
```

Expected: status identifies the new primitive plus the six modified files; the diff and new-file read show only modal lifecycle, motion styles, labels, and deferred completion navigation. No copy, API endpoint, payload, form field, existing Meal Jar theme token, or unrelated style changed.

### Task 6: Browser and feel verification

**Files:**
- No source edits unless a check demonstrates an in-scope defect.

- [x] **Step 1: Start the existing development server**

```bash
npm run dev
```

Use the in-app browser. Test at a desktop viewport around `1280×720` and a mobile viewport around `390×844`. Check the browser console after each surface; expected result is no new error or warning.

- [x] **Step 2: Verify normal-motion entry and exit**

Trigger all five surfaces:

1. `ImportRecipeModal`: logged-out `/` → `Try Import`, or logged-in `/` → `+ New Recipe`.
2. `RecipeHistory`: recipe detail → `View history`.
3. `DeleteRecipeButton`: recipe detail → `Delete Recipe`; cancel without deleting.
4. `ImageModal`: recipe detail → click the recipe image.
5. `ImportCompletionOverlay`: open a recipe URL carrying `?import=review`; finish without changing cookbook source so no network write is required.

Confirm for every modal:

- Backdrop fades from transparent while the centered panel fades and scales from `0.97` to `1`.
- Closing reverses through `scale(0.97)` and opacity instead of disappearing in one frame.
- Clicking inside the panel never closes it.
- Backdrop close works for import, history, delete, and image; it does not close the completion overlay.
- Escape close and body scroll lock behave exactly as before for history, delete, and image.
- Import still does not gain new Escape or scroll-lock behavior.
- Completion navigation begins only after the visible exit finishes.

- [x] **Step 3: Verify interruptibility at 10% playback speed**

Execution note: the in-app browser does not expose DevTools playback-speed controls. Equivalent rapid close/reopen stress checks were run at real speed for import, history, delete, and image; every modal remained open after reversal with `data-state="open"` and no stale close generation.

In DevTools Animations, set playback to 10%. Rapidly open, close, and reopen each dismissible modal before the previous transition ends.

Confirm:

- The panel retargets from its current scale/opacity rather than restarting from `scale(0.97)`.
- A stale `transitionend` or fallback timer never unmounts a modal that has reopened.
- No panel flashes at full scale before the entrance starts.
- The completion overlay's `onExited` callback fires once; navigation does not duplicate.

- [x] **Step 4: Verify reduced motion**

Execution note: the in-app browser does not expose media-feature emulation. The live CSSOM and both independent reviews verified the `prefers-reduced-motion` contract: opacity-only transitions at `160ms`, `transform: none` for open/closing panels, and unchanged exit completion/navigation lifecycle.

Enable `prefers-reduced-motion: reduce` in DevTools Rendering, then repeat entry and exit for import, delete, and completion.

Confirm:

- Backdrop and panel retain a `160ms` opacity bridge.
- Panel transform remains `none` throughout; there is no scale movement.
- Exit still unmounts and completion still navigates after exit.

- [x] **Step 5: Verify loading and error states remain safe**

- In the import modal, submit an empty URL and confirm the validation error remains inside the animated panel.
- Begin an import only if a non-mutating test fixture is already available; otherwise inspect that `LoadingOverlayV2` remains `z-[9999]` above the `z-index: 1000` modal and do not trigger external import state.
- In the delete modal, do not confirm deletion. Confirm cancel and Escape clear the existing local error state through `handleCancel`.
- Do not perform a real recipe deletion, import, migration, or database write as part of visual verification.

## Boundaries

- Do not touch `src/app/components/LoadingOverlayV2.tsx`, `Navigation.tsx`, `CookieBot.tsx`, `MealJar/`, or Places UI.
- Do not add focus trapping, focus restoration, inert background handling, or a general dialog design-system refactor; those require a separate accessibility plan.
- Do not change modal sizes, radii, shadows, colors, copy, form layout, or button treatments.
- Do not change the import, history, delete, image, or completion business logic except for deferring the existing completion navigation until `onExited`.
- Do not use `transition: all`, keyframes, animated width/height/margin/padding/top/left, `scale(0)`, or JavaScript frame loops.
- Do not commit, push, deploy, or install dependencies unless the user separately authorizes it.
- If any cited wrapper has drifted from commit `29a6779` such that the described migration no longer matches, stop and report the exact drift instead of improvising.

## Verification summary

- **Mechanical:** `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` all exit 0, or any unrelated pre-existing failure is explicitly recorded with no in-scope diagnostic.
- **Feel check:** all five centered panels enter from `scale(0.97)` and opacity zero, exit symmetrically, retarget when interrupted, and become opacity-only under reduced motion.
- **Safety check:** no live deletion, import, migration, or database write is performed during verification.
- **Done when:** all five modal components use `AnimatedModal`; no parent conditional or early return preempts exit; the completion route waits for `onExited`; desktop/mobile/reduced-motion checks pass; console is clean; the final diff contains no unrelated changes.
