// Kursverlauf (Yahoo chart): Zeiträume, Umwandlung der Rohdaten in Kerzen, Kennzahlen zum Zeitraum.
// Reine Funktionen ohne Netz — laufen im Worker (Umwandlung) und im Browser (Anzeige).
import type { Kerze } from '../types'

export type ChartBereich = '1M' | '6M' | '1J' | '5J' | 'MAX'

export interface BereichDef {
  bereich: ChartBereich
  titel: string
  /** Yahoo-Intervall */
  intervall: '1d' | '1wk' | '1mo'
  /** Länge des Zeitraums in Tagen; null = so weit die Daten reichen */
  tage: number | null
  /** Wie lange der Worker die Antwort im Cache hält */
  ttlSek: number
}

const STUNDE = 3600
export const BEREICHE: BereichDef[] = [
  { bereich: '1M', titel: '1M', intervall: '1d', tage: 31, ttlSek: STUNDE },
  { bereich: '6M', titel: '6M', intervall: '1d', tage: 183, ttlSek: STUNDE },
  { bereich: '1J', titel: '1J', intervall: '1d', tage: 366, ttlSek: STUNDE },
  { bereich: '5J', titel: '5J', intervall: '1wk', tage: 5 * 366, ttlSek: 6 * STUNDE },
  { bereich: 'MAX', titel: 'Max', intervall: '1mo', tage: null, ttlSek: 24 * STUNDE },
]

export function bereichDef(bereich: string): BereichDef | null {
  return BEREICHE.find((b) => b.bereich === bereich.toUpperCase()) ?? null
}

/** Startdatum (ISO, UTC) für die Yahoo-Anfrage. */
export function periodeAb(def: BereichDef, jetztMs: number): string {
  if (def.tage === null) return '1970-01-01'
  const d = new Date(jetztMs - def.tage * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/** Rohform der Yahoo-Antwort (yahoo-finance2 `chart`, ohne Schema-Prüfung). */
export interface ChartRoh {
  meta?: { currency?: string; symbol?: string }
  quotes?: {
    date: string | Date
    open?: number | null
    high?: number | null
    low?: number | null
    close?: number | null
    volume?: number | null
  }[]
}

const TAG_SEK = 86_400

/**
 * Kerzen aus der Rohantwort: Zeilen ohne vollständige OHLC-Werte fallen weg, der Zeitstempel
 * wird auf den Tagesanfang (UTC) gesetzt (Yahoo liefert die Handelseröffnung in Börsenzeit),
 * doppelte Tage behalten die letzte Zeile, Ergebnis aufsteigend sortiert.
 */
export function kerzenAusChart(roh: ChartRoh): Kerze[] {
  const nachZeit = new Map<number, Kerze>()
  for (const q of roh.quotes ?? []) {
    const ms = typeof q.date === 'string' ? Date.parse(q.date) : q.date.getTime()
    if (!Number.isFinite(ms)) continue
    const { open, high, low, close } = q
    if (!istZahl(open) || !istZahl(high) || !istZahl(low) || !istZahl(close)) continue
    const time = Math.floor(ms / 1000 / TAG_SEK) * TAG_SEK
    nachZeit.set(time, { time, open, high, low, close, volume: istZahl(q.volume) ? q.volume : 0 })
  }
  return [...nachZeit.values()].sort((a, b) => a.time - b.time)
}

function istZahl(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export interface ChartVeraenderung {
  /** Schlusskurs der ersten Kerze */
  start: number
  /** Schlusskurs der letzten Kerze */
  ende: number
  absolut: number
  /** Anteil, z.B. 0.12 = +12 % */
  prozent: number
  hoch: number
  tief: number
}

export function chartVeraenderung(kerzen: Kerze[]): ChartVeraenderung | null {
  if (kerzen.length === 0) return null
  const start = kerzen[0].close
  const ende = kerzen[kerzen.length - 1].close
  let hoch = -Infinity
  let tief = Infinity
  for (const k of kerzen) {
    if (k.high > hoch) hoch = k.high
    if (k.low < tief) tief = k.low
  }
  return { start, ende, absolut: ende - start, prozent: start > 0 ? ende / start - 1 : 0, hoch, tief }
}
