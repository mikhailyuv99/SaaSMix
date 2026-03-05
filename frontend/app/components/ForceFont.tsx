'use client'

import { useEffect } from 'react'

const BODY_FONT = 'var(--font-questrial), Questrial, ui-sans-serif, system-ui, sans-serif'
const HEADING_FONT = 'var(--font-space-grotesk), "Space Grotesk", ui-sans-serif, system-ui, sans-serif'

export function ForceFont() {
  useEffect(() => {
    document.documentElement.style.fontFamily = BODY_FONT
    document.body.style.fontFamily = BODY_FONT
    const style = document.createElement('style')
    style.id = 'force-font'
    style.textContent = [
      `*{font-family:${BODY_FONT}!important}`,
      `h1,h2,h3,h4,h5,h6,.font-heading{font-family:${HEADING_FONT}!important}`,
    ].join('')
    document.head.appendChild(style)
    return () => {
      const s = document.getElementById('force-font')
      if (s) s.remove()
    }
  }, [])
  return null
}
