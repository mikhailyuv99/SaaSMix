'use client'

import { useEffect } from 'react'

const BODY = 'Questrial, ui-sans-serif, system-ui, sans-serif'
const HEADING = '"Space Grotesk", ui-sans-serif, system-ui, sans-serif'

export function ForceFont() {
  useEffect(() => {
    document.documentElement.style.fontFamily = BODY
    document.body.style.fontFamily = BODY
    const style = document.createElement('style')
    style.id = 'force-font'
    style.textContent = [
      `*{font-family:${BODY}!important}`,
      `h1,h2,h3,h4,h5,h6,.font-heading{font-family:${HEADING}!important}`,
    ].join('')
    document.head.appendChild(style)
    return () => {
      const s = document.getElementById('force-font')
      if (s) s.remove()
    }
  }, [])
  return null
}
