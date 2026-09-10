import type { SzenarioBewertung, Trade } from '../types'
import type { WiederholungsEintrag } from './wiederholung'

// Export/Import des kompletten Nutzerstands als JSON-Datei — damit Fortschritt
// und Journal zwischen PC und Handy wandern können. Import MERGT (statt zu
// ersetzen): Trades per Id dedupliziert, Lektionen mit dem besseren Quiz-Ergebnis,
// Übungen mit der besseren Bewertung, Wiederholungen mit dem höheren Lernstand.

export const SICHERUNG_VERSION = 1

export interface LektionErgebnis {
  quizProzent: number
  abgeschlossenAm: number
}
export interface SzenarioErgebnis {
  bewertung: SzenarioBewertung
  rMultiple: number
}

export interface Sicherung {
  app: 'chartakademie'
  version: number
  exportiertAm: string
  simulator: { tradeHistorie: Trade[] }
  fortschritt: {
    abgeschlosseneLektionen: Record<string, LektionErgebnis>
    szenarioErgebnisse: Record<string, SzenarioErgebnis>
    wiederholungen: Record<string, WiederholungsEintrag>
  }
}

export function sicherungErstellen(
  tradeHistorie: Trade[],
  fortschritt: Sicherung['fortschritt'],
  jetzt = new Date(),
): Sicherung {
  return {
    app: 'chartakademie',
    version: SICHERUNG_VERSION,
    exportiertAm: jetzt.toISOString(),
    simulator: { tradeHistorie },
    fortschritt,
  }
}

/** Prüft grob, ob ein geparstes JSON eine ChartAkademie-Sicherung ist. */
export function istSicherung(x: unknown): x is Sicherung {
  if (!x || typeof x !== 'object') return false
  const s = x as Partial<Sicherung>
  return (
    s.app === 'chartakademie' &&
    typeof s.version === 'number' &&
    !!s.simulator &&
    Array.isArray(s.simulator.tradeHistorie) &&
    !!s.fortschritt &&
    typeof s.fortschritt === 'object'
  )
}

const RANG: Record<SzenarioBewertung, number> = { falsch: 0, verpasst: 1, ok: 2, perfekt: 3 }

export function mergeTrades(vorhanden: Trade[], neue: Trade[]): Trade[] {
  const ids = new Set(vorhanden.map((t) => t.id))
  const frisch = neue.filter((t) => !ids.has(t.id))
  return [...vorhanden, ...frisch].sort((a, b) => a.exitTime - b.exitTime || a.entryTime - b.entryTime)
}

export function mergeLektionen(
  a: Record<string, LektionErgebnis>,
  b: Record<string, LektionErgebnis>,
): Record<string, LektionErgebnis> {
  const out = { ...a }
  for (const [id, e] of Object.entries(b)) {
    const alt = out[id]
    if (!alt || e.quizProzent > alt.quizProzent) out[id] = e
  }
  return out
}

export function mergeSzenarien(
  a: Record<string, SzenarioErgebnis>,
  b: Record<string, SzenarioErgebnis>,
): Record<string, SzenarioErgebnis> {
  const out = { ...a }
  for (const [id, e] of Object.entries(b)) {
    const alt = out[id]
    if (!alt || RANG[e.bewertung] > RANG[alt.bewertung]) out[id] = e
  }
  return out
}

export function mergeWiederholungen(
  a: Record<string, WiederholungsEintrag>,
  b: Record<string, WiederholungsEintrag>,
): Record<string, WiederholungsEintrag> {
  const out = { ...a }
  for (const [key, e] of Object.entries(b)) {
    const alt = out[key]
    // höherer Lernstand gewinnt; bei Gleichstand die frühere Fälligkeit
    if (!alt || e.stufe > alt.stufe || (e.stufe === alt.stufe && e.faelligAm < alt.faelligAm)) out[key] = e
  }
  return out
}

export function sicherungZusammenfuehren(
  aktuell: { tradeHistorie: Trade[]; fortschritt: Sicherung['fortschritt'] },
  importiert: Sicherung,
): { tradeHistorie: Trade[]; fortschritt: Sicherung['fortschritt']; neueTrades: number } {
  const tradeHistorie = mergeTrades(aktuell.tradeHistorie, importiert.simulator.tradeHistorie)
  return {
    tradeHistorie,
    fortschritt: {
      abgeschlosseneLektionen: mergeLektionen(
        aktuell.fortschritt.abgeschlosseneLektionen,
        importiert.fortschritt.abgeschlosseneLektionen ?? {},
      ),
      szenarioErgebnisse: mergeSzenarien(
        aktuell.fortschritt.szenarioErgebnisse,
        importiert.fortschritt.szenarioErgebnisse ?? {},
      ),
      wiederholungen: mergeWiederholungen(
        aktuell.fortschritt.wiederholungen,
        importiert.fortschritt.wiederholungen ?? {},
      ),
    },
    neueTrades: tradeHistorie.length - aktuell.tradeHistorie.length,
  }
}

/** Kontostand ist abgeleitet: Startkapital + Summe aller Trade-PnLs. */
export function kontostandAus(startKapital: number, trades: Trade[]): number {
  return startKapital + trades.reduce((s, t) => s + t.pnl, 0)
}
