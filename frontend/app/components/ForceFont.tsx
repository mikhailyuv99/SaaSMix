'use client'

import { useEffect } from 'react'

const FONT = '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'

export function ForceFont() {
  useEffect(() => {
    document.documentElement.style.fontFamily = FONT
    document.body.style.fontFamily = FONT
    const style = document.createElement('style')
    style.id = 'force-plus-jakarta'
    style.textContent = `*{font-family:${FONT}!important}`
    document.head.appendChild(style)
    return () => {
      const s = document.getElementById('force-plus-jakarta')
      if (s) s.remove()
    }
  }, [])
  return null
}
