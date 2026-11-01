'use client'

import React from 'react'
import { Streamdown } from 'streamdown'
import 'streamdown/styles.css'

// Keep model output to recipe prose. In particular, never fetch model-supplied images.
const allowedElements = [
  'p', 'br', 'span', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li',
  'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
]
const animation = { animation: 'fadeIn', duration: 160, easing: 'ease-out', sep: 'word' } as const
const components = { strong: 'strong', em: 'em' } as const

export default function CookieBotText({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <Streamdown
      allowedElements={allowedElements}
      skipHtml
      controls={false}
      components={components}
      unwrapDisallowed
      animated={animation}
      isAnimating={streaming}
    >
      {text}
    </Streamdown>
  )
}
