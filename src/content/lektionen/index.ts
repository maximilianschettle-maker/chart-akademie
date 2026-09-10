import type { Lesson } from '../../types'
import { LEKTION_META } from './meta'

// Lektionen werden LAZY geladen: Das Start-Bundle enthält nur die Meta-Tabelle
// (Titel, Dauer, Level); der Lektionstext kommt erst beim Öffnen. Reihenfolge
// und Freischaltung stehen in curriculum.ts.

export { LEKTION_META }

const LADER: Record<string, () => Promise<Lesson>> = {
  'l1-01': () => import('./l1-01-was-ist-trading').then((m) => m.l1_01),
  'l1-02': () => import('./l1-02-candlesticks').then((m) => m.l1_02),
  'l1-03': () => import('./l1-03-timeframes').then((m) => m.l1_03),
  'l1-04': () => import('./l1-04-orderbuch').then((m) => m.l1_04),
  'l1-05': () => import('./l1-05-leverage').then((m) => m.l1_05),
  'l2-01': () => import('./l2-01-risiko-zuerst').then((m) => m.l2_01),
  'l2-02': () => import('./l2-02-position-sizing').then((m) => m.l2_02),
  'l2-03': () => import('./l2-03-stoploss-rmultiple').then((m) => m.l2_03),
  'l2-04': () => import('./l2-04-psychologie').then((m) => m.l2_04),
  'l3-01': () => import('./l3-01-volumen').then((m) => m.l3_01),
  'l3-02': () => import('./l3-02-volume-profile').then((m) => m.l3_02),
  'l3-03': () => import('./l3-03-oi-funding').then((m) => m.l3_03),
  'l3-04': () => import('./l3-04-liquidation-liqmap').then((m) => m.l3_04),
  'l3-05': () => import('./l3-05-heatmap').then((m) => m.l3_05),
  'l3-06': () => import('./l3-06-ema-rsi').then((m) => m.l3_06),
  'l4-01': () => import('./l4-01-trendfolge').then((m) => m.l4_01),
  'l4-02': () => import('./l4-02-sr-bounce').then((m) => m.l4_02),
  'l4-03': () => import('./l4-03-breakout-retest').then((m) => m.l4_03),
  'l4-04': () => import('./l4-04-range-trading').then((m) => m.l4_04),
  'l4-05': () => import('./l4-05-liquidity-sweep').then((m) => m.l4_05),
  'l5-01': () => import('./l5-01-meisterpruefung').then((m) => m.l5_01),
  'l5-02': () => import('./l5-02-freier-replay').then((m) => m.l5_02),
  'l5-03': () => import('./l5-03-journal').then((m) => m.l5_03),
  'l5-04': () => import('./l5-04-meisterpruefung-2').then((m) => m.l5_04),
}

const cache = new Map<string, Promise<Lesson>>()

/** Lektion nachladen (einmal pro Sitzung, danach aus dem Cache). */
export function ladeLektion(id: string): Promise<Lesson> {
  const lader = LADER[id]
  if (!lader) return Promise.reject(new Error(`Unbekannte Lektion: ${id}`))
  let p = cache.get(id)
  if (!p) {
    p = lader()
    cache.set(id, p)
  }
  return p
}

/** Alle Lektionen laden — für Tests und Generatoren, nicht für die App. */
export function alleLektionenLaden(): Promise<Lesson[]> {
  return Promise.all(Object.keys(LADER).map((id) => ladeLektion(id)))
}
