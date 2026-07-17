'use client'

import type { CSSProperties, ReactNode, TransitionEvent } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

const EXIT_FALLBACK_MS = 240
const CLOSED_OPACITY_THRESHOLD = 0.01
const EPOCH_TIMESTAMP_THRESHOLD = 1_000_000_000_000

interface ActiveCloseCycle {
  generation: number
  performanceStartedAt: number
  epochStartedAt: number
}

interface ModalLifecycle {
  previousOpen: boolean
  isMounted: boolean
  closeGeneration: number | null
  nextCloseGeneration: number
}

const subscribeToClientHydration = () => () => {}
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

const createActiveCloseCycle = (generation: number): ActiveCloseCycle => ({
  generation,
  performanceStartedAt: typeof performance === 'undefined' ? 0 : performance.now(),
  epochStartedAt: Date.now(),
})

const eventBelongsToCloseCycle = (
  event: TransitionEvent<HTMLDivElement>,
  closeCycle: ActiveCloseCycle
) => {
  const eventTimestamp = event.timeStamp
  const closeStartedAt = eventTimestamp >= EPOCH_TIMESTAMP_THRESHOLD
    ? closeCycle.epochStartedAt
    : closeCycle.performanceStartedAt

  return Number.isFinite(eventTimestamp) && eventTimestamp >= closeStartedAt
}

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
  const isClientHydrated = useSyncExternalStore(
    subscribeToClientHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  )
  const [lifecycle, setLifecycle] = useState<ModalLifecycle>(() => ({
    previousOpen: open,
    isMounted: open,
    closeGeneration: null,
    nextCloseGeneration: 0,
  }))
  const activeCloseCycleRef = useRef<ActiveCloseCycle | null>(null)
  const lifecycleRef = useRef(lifecycle)
  const completedCloseGenerationRef = useRef<number | null>(null)
  const onExitedRef = useRef(onExited)

  useLayoutEffect(() => {
    lifecycleRef.current = lifecycle
    activeCloseCycleRef.current = lifecycle.closeGeneration === null
      ? null
      : createActiveCloseCycle(lifecycle.closeGeneration)
  }, [lifecycle])

  useLayoutEffect(() => {
    onExitedRef.current = onExited
  }, [onExited])

  if (open !== lifecycle.previousOpen) {
    if (open) {
      setLifecycle({
        ...lifecycle,
        previousOpen: true,
        isMounted: true,
        closeGeneration: null,
      })
    } else if (lifecycle.isMounted) {
      const closeGeneration = lifecycle.nextCloseGeneration + 1
      setLifecycle({
        ...lifecycle,
        previousOpen: false,
        closeGeneration,
        nextCloseGeneration: closeGeneration,
      })
    } else {
      setLifecycle({
        ...lifecycle,
        previousOpen: false,
      })
    }
  }

  const finishExit = useCallback((generation: number) => {
    const activeLifecycle = lifecycleRef.current

    if (
      open ||
      activeLifecycle.closeGeneration !== generation ||
      completedCloseGenerationRef.current === generation
    ) {
      return
    }

    completedCloseGenerationRef.current = generation
    setLifecycle((currentLifecycle) => {
      if (currentLifecycle.closeGeneration !== generation) return currentLifecycle

      return {
        ...currentLifecycle,
        isMounted: false,
        closeGeneration: null,
      }
    })
    onExitedRef.current?.()
  }, [open])

  useEffect(() => {
    const closeGeneration = lifecycle.closeGeneration

    if (
      !isClientHydrated ||
      open ||
      !lifecycle.isMounted ||
      closeGeneration === null
    ) {
      return
    }

    const fallback = window.setTimeout(
      () => finishExit(closeGeneration),
      EXIT_FALLBACK_MS
    )

    return () => window.clearTimeout(fallback)
  }, [finishExit, isClientHydrated, lifecycle.closeGeneration, lifecycle.isMounted, open])

  useEffect(() => {
    if (!isClientHydrated || !lifecycle.isMounted || !lockScroll) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isClientHydrated, lifecycle.isMounted, lockScroll])

  useEffect(() => {
    if (!isClientHydrated || !open || !closeOnEscape || !onClose) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeOnEscape, isClientHydrated, onClose, open])

  const handlePanelTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    const closeGeneration = lifecycle.closeGeneration
    const activeCloseCycle = activeCloseCycleRef.current

    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'opacity' ||
      closeGeneration === null ||
      !activeCloseCycle ||
      activeCloseCycle.generation !== closeGeneration ||
      event.currentTarget.dataset.closeGeneration !== String(closeGeneration) ||
      !eventBelongsToCloseCycle(event, activeCloseCycle)
    ) {
      return
    }

    const opacity = Number.parseFloat(window.getComputedStyle(event.currentTarget).opacity)
    if (!Number.isFinite(opacity) || opacity > CLOSED_OPACITY_THRESHOLD) return

    finishExit(closeGeneration)
  }

  if (!isClientHydrated || !lifecycle.isMounted || typeof document === 'undefined') return null

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
        data-close-generation={open ? undefined : lifecycle.closeGeneration ?? undefined}
        style={panelStyle}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
