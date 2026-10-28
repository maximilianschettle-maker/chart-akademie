// Entscheidungstermine als Chart-Markierungen: auf die Kerze einrasten, in deren Zeitraum
// die Veröffentlichung fällt. Reine Funktionen, von Simulator (HandelsChart) und
// Aktien-Kurschart (ChartPanel) genutzt.

import type { Bank, MakroDaten } from './types'

export const MARKER_FARBE: Record<Bank, string> = { fed: '#3B82F6', ezb: '#A855F7' }

export interface TerminMarker {
  bank: Bank
  /** Kerzenzeit (Unix-Sekunden), auf die der Termin einrastet */
  zeit: number
  /** Veröffentlichung (Unix-Sekunden) */
  entscheidung: number
  text: string
  sep?: boolean
}

/** Kerze, in deren Intervall `zeitSek` liegt (letzte Kerze: alles ab ihrem Beginn bis +intervall) */
export function rasteAufKerzen(zeitSek: number, kerzenZeiten: number[], intervallSek: number): number | null {
  const n = kerzenZeiten.length
  if (n === 0) return null
  if (zeitSek < kerzenZeiten[0] || zeitSek >= kerzenZeiten[n - 1] + intervallSek) return null
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mitte = (lo + hi + 1) >> 1
    if (kerzenZeiten[mitte] <= zeitSek) lo = mitte
    else hi = mitte - 1
  }
  return kerzenZeiten[lo]
}

export function terminMarker(daten: MakroDaten | null, kerzenZeiten: number[], intervallSek: number): TerminMarker[] {
  if (!daten || kerzenZeiten.length === 0) return []
  const liste: TerminMarker[] = []
  const banken: Bank[] = ['fed', 'ezb']
  for (const bank of banken) {
    for (const t of daten[bank].termine) {
      const entscheidung = Math.floor(Date.parse(t.entscheidungUtc) / 1000)
      if (!Number.isFinite(entscheidung)) continue
      const zeit = rasteAufKerzen(entscheidung, kerzenZeiten, intervallSek)
      if (zeit === null) continue
      liste.push({ bank, zeit, entscheidung, text: bank === 'fed' ? 'Fed' : 'EZB', sep: t.sep })
    }
  }
  return liste.sort((a, b) => a.zeit - b.zeit)
}

/** Intervall aus den Kerzenzeiten schätzen (Median der Abstände) */
export function intervallAusKerzen(kerzenZeiten: number[]): number {
  if (kerzenZeiten.length < 2) return 86400
  const d: number[] = []
  for (let i = 1; i < Math.min(kerzenZeiten.length, 200); i++) d.push(kerzenZeiten[i] - kerzenZeiten[i - 1])
  d.sort((a, b) => a - b)
  return d[Math.floor(d.length / 2)] || 86400
}
