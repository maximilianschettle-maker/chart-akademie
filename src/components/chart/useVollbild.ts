import { useCallback, useEffect, useRef, useState } from 'react'

// Zustand des Chart-Vollbilds (Overlay + Fullscreen-API, wo vorhanden). Rahmen und Knopf: ./Vollbild.tsx

export function useVollbild() {
  const [an, setAn] = useState(false)
  const rahmenRef = useRef<HTMLDivElement>(null)

  const oeffnen = useCallback(() => {
    setAn(true)
    const el = rahmenRef.current
    if (el && typeof el.requestFullscreen === 'function') {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
        // kein natives Vollbild (z.B. iOS) → Overlay reicht
      })
    }
  }, [])

  const schliessen = useCallback(() => {
    setAn(false)
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // natives Vollbild verlassen (Zurück-Geste, Esc) → Overlay ebenfalls schließen
  useEffect(() => {
    if (!an) return
    const wechsel = () => {
      if (!document.fullscreenElement) setAn(false)
    }
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
    }
    document.addEventListener('fullscreenchange', wechsel)
    document.addEventListener('keydown', taste)
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('fullscreenchange', wechsel)
      document.removeEventListener('keydown', taste)
      document.body.style.overflow = vorher
    }
  }, [an, schliessen])

  return { an, oeffnen, schliessen, umschalten: an ? schliessen : oeffnen, rahmenRef }
}
