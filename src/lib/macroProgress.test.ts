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
