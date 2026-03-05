'use client'

import { useEffect } from 'react'

const FALLBACK = ', ui-sans-serif, system-ui, sans-serif'

export function ForceFont() {
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    const body = (cs.getPropertyValue('--font-questrial').trim() || 'Questrial') + FALLBACK
    const heading = (cs.getPropertyValue('--font-space-grotesk').trim() || '"Space Grotesk"') + FALLBACK

    document.documentElement.style.fontFamily = body
    document.body.style.fontFamily = body
    const style = document.createElement('style')
    style.id = 'force-font'
    style.textContent = [
      `*{font-family:${body}!important}`,
      `h1,h2,h3,h4,h5,h6,.font-heading{font-family:${heading}!important}`,
    ].join('')
    document.head.appendChild(style)
    return () => {
      const s = document.getElementById('force-font')
      if (s) s.remove()
    }
  }, [])
  return null
}
