import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CookieBotText from './CookieBotText'
describe('safe streamed answer formatting', () => {
  it('preserves the numbering of separated instruction steps', () => {
    expect(renderToStaticMarkup(<CookieBotText text={'7. Cool the loaf.'} />)).toMatch(/<ol[^>]*start="7"/)
  })
  it('renders readable emphasis and lists', () => {
    const html = renderToStaticMarkup(
      <CookieBotText text={'Use **275ml** yogurt.\n\n- Mix gently\n- Bake'} />,
    )
    expect(html).toContain('<strong>275ml</strong>')
    expect(html).toMatch(/<ul[^>]*>/)
    expect(html).toContain('Mix gently')
    expect(html).toContain('Bake')
  })
  it('never interprets model HTML and handles unfinished formatting', () => {
    const html = renderToStaticMarkup(
      <CookieBotText text={'<script>alert(1)</script>\n\n**Still arriving'} />,
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('Still arriving')
    expect(html).toContain('<strong>')
  })
  it('fades words only during streaming and removes wrappers when complete', () => {
    const streaming = renderToStaticMarkup(<CookieBotText text="Mix gently" streaming />)
    expect(streaming).toMatch(/<span[^>]*data-sd-animate[=\s>]/)
    const complete = renderToStaticMarkup(<CookieBotText text="Mix gently" />)
    expect(complete).not.toMatch(/data-sd-animate[=\s>]/)
  })
  it('blocks model-supplied images and unsafe links', () => {
    const html = renderToStaticMarkup(<CookieBotText text={'![tracking](https://example.com/pixel)\n\n<img src="https://example.com/raw" />\n\n[click](javascript:alert%281%29)'} />)
    expect(html).not.toMatch(/<img\b/)
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('src="https://example.com')
  })
})
