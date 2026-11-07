import type { Candle } from '../types'
import { ema } from './indikatoren/ema'
import { swings } from './zonen'

// Richtung des übergeordneten Charts (Top-Down, Schritt 1): höhere Hochs und Tiefs = Aufwärtstrend,
// tiefere = Abwärtstrend, sonst seitwärts – mit der EMA-Lage als zweitem Blick. Liefert die Begründung
// in Worten, wie sie der Kurs vermittelt.

export type Richtung3 = 'auf' | 'ab' | 'seitwaerts'

export interface RichtungErgebnis {
  richtung: Richtung3
  begruendung: string
  /** die beiden letzten Swing-Hochs und -Tiefs (älter → neuer) */
  hochs: number[]
  tiefs: number[]
}

export const RICHTUNG_TEXT: Record<Richtung3, string> = { auf: 'Aufwärtstrend', ab: 'Abwärtstrend', seitwaerts: 'Seitwärts' }

export function richtungAus(kerzen: Candle[], fraktal = 3): RichtungErgebnis {
  const c = kerzen.slice(-120)
  const sw = swings(c, fraktal)
  const hochs = sw.filter((s) => s.art === 'hoch').slice(-2).map((s) => s.preis)
  const tiefs = sw.filter((s) => s.art === 'tief').slice(-2).map((s) => s.preis)
  const fmt = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: x >= 1000 ? 0 : 2 })

  const n = c.length
  const e20 = ema(c, 20)[n - 1]
  const e50 = ema(c, 50)[n - 1]
  const e50Vorher = ema(c, 50)[Math.max(0, n - 21)]
  const close = c[n - 1]?.close ?? 0
  const emaAuf = Number.isFinite(e20) && Number.isFinite(e50) && close > e20 && e20 > e50 && e50 > e50Vorher
  const emaAb = Number.isFinite(e20) && Number.isFinite(e50) && close < e20 && e20 < e50 && e50 < e50Vorher
  const emaText = emaAuf ? 'Kurs über EMA 20 über EMA 50, EMA 50 steigt.' : emaAb ? 'Kurs unter EMA 20 unter EMA 50, EMA 50 fällt.' : 'EMAs liefern kein klares Bild.'

  if (hochs.length === 2 && tiefs.length === 2) {
    const hh = hochs[1] > hochs[0]
    const hl = tiefs[1] > tiefs[0]
    const lh = hochs[1] < hochs[0]
    const ll = tiefs[1] < tiefs[0]
    if (hh && hl) return { richtung: 'auf', begruendung: `Höhere Hochs (${fmt(hochs[0])} → ${fmt(hochs[1])}) und höhere Tiefs (${fmt(tiefs[0])} → ${fmt(tiefs[1])}). ${emaText}`, hochs, tiefs }
    if (lh && ll) return { richtung: 'ab', begruendung: `Tiefere Hochs (${fmt(hochs[0])} → ${fmt(hochs[1])}) und tiefere Tiefs (${fmt(tiefs[0])} → ${fmt(tiefs[1])}). ${emaText}`, hochs, tiefs }
    // gemischt: EMAs entscheiden, sonst seitwärts
    if (emaAuf) return { richtung: 'auf', begruendung: `Swings gemischt (Hochs ${fmt(hochs[0])} → ${fmt(hochs[1])}, Tiefs ${fmt(tiefs[0])} → ${fmt(tiefs[1])}), aber ${emaText}`, hochs, tiefs }
    if (emaAb) return { richtung: 'ab', begruendung: `Swings gemischt (Hochs ${fmt(hochs[0])} → ${fmt(hochs[1])}, Tiefs ${fmt(tiefs[0])} → ${fmt(tiefs[1])}), aber ${emaText}`, hochs, tiefs }
    return { richtung: 'seitwaerts', begruendung: `Keine Folge höherer oder tieferer Hochs und Tiefs (Hochs ${fmt(hochs[0])} → ${fmt(hochs[1])}, Tiefs ${fmt(tiefs[0])} → ${fmt(tiefs[1])}). ${emaText}`, hochs, tiefs }
  }
  if (emaAuf) return { richtung: 'auf', begruendung: `Zu wenige Swings für die Struktur; ${emaText}`, hochs, tiefs }
  if (emaAb) return { richtung: 'ab', begruendung: `Zu wenige Swings für die Struktur; ${emaText}`, hochs, tiefs }
  return { richtung: 'seitwaerts', begruendung: `Zu wenige Swings für die Struktur; ${emaText}`, hochs, tiefs }
}
