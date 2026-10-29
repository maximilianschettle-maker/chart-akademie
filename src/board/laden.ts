import { useEffect, useState } from 'react'
import type { KalenderDaten, NewsDaten } from './types'

// Lädt kalender.json und news.json (von der Action board.yml erzeugt) – gleiches Muster wie useMakro/useTracker:
// ein Ladevorgang je Datei und Seitenaufruf, letzter guter Stand im localStorage, nie ein Absturz ohne Netz.

export interface BoardErgebnis<T> {
  daten: T | null
  status: 'laedt' | 'ok' | 'fehler'
  fehler: string | null
  ausCache: boolean
}

interface Quelle<T> {
  datei: string
  schluessel: string
  pruefen: (x: unknown) => x is T
}

export const KALENDER: Quelle<KalenderDaten> = {
  datei: 'kalender.json',
  schluessel: 'chartakademie-kalender',
  pruefen: (x): x is KalenderDaten => {
    const d = x as Partial<KalenderDaten> | null
    return !!d && d.version === 1 && typeof d.lastUpdated === 'string' && Array.isArray(d.termine) && Array.isArray(d.werte)
  },
}

export const NEWS: Quelle<NewsDaten> = {
  datei: 'news.json',
  schluessel: 'chartakademie-news',
  pruefen: (x): x is NewsDaten => {
    const d = x as Partial<NewsDaten> | null
    return !!d && d.version === 1 && typeof d.lastUpdated === 'string' && Array.isArray(d.eintraege)
  },
}

const FRISCH_MS = 5 * 60_000
const zustand = new Map<string, { laufend: Promise<BoardErgebnis<unknown>> | null; letztes: BoardErgebnis<unknown> | null; geladenAm: number }>()

async function laden<T>(q: Quelle<T>): Promise<BoardErgebnis<T>> {
  let alt: T | null = null
  try {
    const roh = localStorage.getItem(q.schluessel)
    const d: unknown = roh ? JSON.parse(roh) : null
    alt = q.pruefen(d) ? d : null
  } catch {
    alt = null
  }
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${q.datei}`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const d: unknown = await res.json()
    if (!q.pruefen(d)) throw new Error(`${q.datei} hat ein unerwartetes Format`)
    try {
      localStorage.setItem(q.schluessel, JSON.stringify(d))
    } catch {
      // nur Komfort
    }
    return { daten: d, status: 'ok', fehler: null, ausCache: false }
  } catch (e) {
    const fehler = e instanceof Error ? e.message : String(e)
    return { daten: alt, status: alt ? 'ok' : 'fehler', fehler, ausCache: alt !== null }
  }
}

function hole<T>(q: Quelle<T>, erzwingen = false): Promise<BoardErgebnis<T>> {
  let z = zustand.get(q.datei)
  if (!z) {
    z = { laufend: null, letztes: null, geladenAm: 0 }
    zustand.set(q.datei, z)
  }
  const st = z
  if (!erzwingen && st.letztes && Date.now() - st.geladenAm < FRISCH_MS) return Promise.resolve(st.letztes as BoardErgebnis<T>)
  if (!st.laufend) {
    st.laufend = laden(q)
      .then((r) => {
        st.letztes = r
        st.geladenAm = Date.now()
        return r
      })
      .finally(() => {
        st.laufend = null
      })
  }
  return st.laufend as Promise<BoardErgebnis<T>>
}

export function useBoard<T>(q: Quelle<T>) {
  const [ergebnis, setErgebnis] = useState<BoardErgebnis<T>>(() => (zustand.get(q.datei)?.letztes as BoardErgebnis<T> | undefined) ?? { daten: null, status: 'laedt', fehler: null, ausCache: false })
  useEffect(() => {
    let aktiv = true
    hole(q).then((r) => {
      if (aktiv) setErgebnis(r)
    })
    const sichtbar = () => {
      if (document.visibilityState === 'visible') hole(q, true).then((r) => aktiv && setErgebnis(r))
    }
    document.addEventListener('visibilitychange', sichtbar)
    return () => {
      aktiv = false
      document.removeEventListener('visibilitychange', sichtbar)
    }
  }, [q])
  const neuLaden = () => hole(q, true).then(setErgebnis)
  return { ...ergebnis, neuLaden }
}
