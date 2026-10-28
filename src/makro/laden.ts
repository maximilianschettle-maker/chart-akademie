// Lädt public/data/macro.json (vom Datenskript erzeugt). Keine API-Aufrufe, keine Schlüssel.
// Letzter guter Stand liegt zusätzlich im localStorage, damit das Widget auch offline
// oder bei einem kaputten Deploy etwas Sinnvolles zeigt statt abzustürzen.

import type { MakroDaten } from './types'

const SCHLUESSEL = 'chartakademie-makro'
/** Ab diesem Alter gilt der Stand als veraltet (Action läuft normal täglich) */
export const VERALTET_AB_MS = 36 * 3_600_000

export type MakroStatus = 'laedt' | 'ok' | 'fehler'

export interface MakroErgebnis {
  daten: MakroDaten | null
  status: MakroStatus
  /** Fehlertext, wenn das Netz nichts geliefert hat (auch bei vorhandenem alten Stand) */
  fehler: string | null
  /** true, wenn `daten` aus dem lokalen Speicher stammen */
  ausCache: boolean
}

export function makroUrl(): string {
  return `${import.meta.env.BASE_URL}data/macro.json`
}

export function icsUrl(): string {
  return `${import.meta.env.BASE_URL}data/zinsentscheidungen.ics`
}

export function istMakroDaten(x: unknown): x is MakroDaten {
  if (!x || typeof x !== 'object') return false
  const d = x as Partial<MakroDaten>
  return (
    d.version === 1 &&
    typeof d.lastUpdated === 'string' &&
    !!d.fed &&
    !!d.ezb &&
    Array.isArray(d.fed.termine) &&
    Array.isArray(d.ezb.termine) &&
    Array.isArray(d.fed.historie) &&
    Array.isArray(d.ezb.historie)
  )
}

function ausSpeicher(): MakroDaten | null {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (!roh) return null
    const d: unknown = JSON.parse(roh)
    return istMakroDaten(d) ? d : null
  } catch {
    return null
  }
}

function inSpeicher(d: MakroDaten) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(d))
  } catch {
    // Speicher voll oder gesperrt – egal, ist nur ein Komfort-Cache
  }
}

export function istVeraltet(d: MakroDaten, jetzt = Date.now()): boolean {
  const t = Date.parse(d.lastUpdated)
  return !Number.isFinite(t) || jetzt - t > VERALTET_AB_MS
}

export async function ladeMakro(): Promise<MakroErgebnis> {
  const alt = ausSpeicher()
  try {
    // no-cache: der Service Worker liefert data/ ohnehin netz-zuerst, der Browser-Cache soll nicht dazwischenfunken
    const res = await fetch(makroUrl(), { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const d: unknown = await res.json()
    if (!istMakroDaten(d)) throw new Error('macro.json hat ein unerwartetes Format')
    inSpeicher(d)
    return { daten: d, status: 'ok', fehler: null, ausCache: false }
  } catch (e) {
    const fehler = e instanceof Error ? e.message : String(e)
    return { daten: alt, status: alt ? 'ok' : 'fehler', fehler, ausCache: alt !== null }
  }
}
