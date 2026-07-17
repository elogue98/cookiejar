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
