import { useEffect, useState } from 'react'

const SCHWELLE = 640 // Tailwind „sm“

/** true auf schmalen Screens (Handy hochkant) — für Chart-Höhen und Layout-Entscheidungen. */
export function useSchmal(): boolean {
  const [schmal, setSchmal] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < SCHWELLE : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${SCHWELLE - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setSchmal(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return schmal
}

/** Chart-Höhe: am Handy flacher, damit Chart + Order-Ticket ohne Endlos-Scrollen passen. */
export function chartHoehe(schmal: boolean, desktop = 460, handy = 320): number {
  return schmal ? handy : desktop
}
