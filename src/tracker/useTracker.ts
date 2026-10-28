import { useEffect, useState } from 'react'
import type { TrackerDaten } from './types'

// Lädt public/data/tracker.json (von der Action erzeugt); letzter guter Stand im localStorage.
// Gleiches Muster wie src/makro/useMakro.

const SCHLUESSEL = 'chartakademie-tracker-daten'
const FRISCH_MS = 5 * 60_000
export const TRACKER_VERALTET_AB_MS = 26 * 3_600_000

export interface TrackerErgebnis {
  daten: TrackerDaten | null
  status: 'laedt' | 'ok' | 'fehler'
  fehler: string | null
  ausCache: boolean
}

export function trackerUrl(): string {
  return `${import.meta.env.BASE_URL}data/tracker.json`
}

function istTrackerDaten(x: unknown): x is TrackerDaten {
  const d = x as Partial<TrackerDaten> | null
  return !!d && d.version === 1 && typeof d.lastUpdated === 'string' && Array.isArray(d.instrumente) && !!d.config
}

function ausSpeicher(): TrackerDaten | null {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (!roh) return null
    const d: unknown = JSON.parse(roh)
    return istTrackerDaten(d) ? d : null
  } catch {
    return null
  }
}

async function laden(): Promise<TrackerErgebnis> {
  const alt = ausSpeicher()
  try {
    const res = await fetch(trackerUrl(), { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const d: unknown = await res.json()
    if (!istTrackerDaten(d)) throw new Error('tracker.json hat ein unerwartetes Format')
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(d))
    } catch {
      // nur Komfort
    }
    return { daten: d, status: 'ok', fehler: null, ausCache: false }
  } catch (e) {
    const fehler = e instanceof Error ? e.message : String(e)
    return { daten: alt, status: alt ? 'ok' : 'fehler', fehler, ausCache: alt !== null }
  }
}

let laufend: Promise<TrackerErgebnis> | null = null
let letztes: TrackerErgebnis | null = null
let geladenAm = 0

function hole(erzwingen = false): Promise<TrackerErgebnis> {
  if (!erzwingen && letztes && Date.now() - geladenAm < FRISCH_MS) return Promise.resolve(letztes)
  if (!laufend) {
    laufend = laden()
      .then((r) => {
        letztes = r
        geladenAm = Date.now()
        return r
      })
      .finally(() => {
        laufend = null
      })
  }
  return laufend
}

const LADEND: TrackerErgebnis = { daten: null, status: 'laedt', fehler: null, ausCache: false }

export function useTracker() {
  const [ergebnis, setErgebnis] = useState<TrackerErgebnis>(letztes ?? LADEND)
  const [jetzt, setJetzt] = useState(() => Date.now())

  useEffect(() => {
    let aktiv = true
    hole().then((r) => {
      if (aktiv) setErgebnis(r)
    })
    const sichtbar = () => {
      if (document.visibilityState === 'visible') {
        setJetzt(Date.now())
        hole(true).then((r) => {
          if (aktiv) setErgebnis(r)
        })
      }
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      aktiv = false
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [])

  const neuLaden = () => {
    setJetzt(Date.now())
    hole(true).then(setErgebnis)
  }

  return { ...ergebnis, jetzt, neuLaden }
}
