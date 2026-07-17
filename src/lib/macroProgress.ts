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
