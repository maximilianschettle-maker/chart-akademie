import type { SzenarioBewertung, Trade } from '../types'
import type { WiederholungsEintrag } from './wiederholung'
import type { GespeicherterRueckblick } from './rueckblick'
import type { JournalEintrag } from '../journal/types'
import {
  mergeEintraege,
  mergeLektionen,
  mergeRueckblicke,
  mergeSzenarien,
  mergeTrades,
  mergeWiederholungen,
} from './mergen'

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
  /** rueckblicke fehlt in Sicherungen aus älteren Versionen */
  simulator: { tradeHistorie: Trade[]; rueckblicke?: GespeicherterRueckblick[] }
  /** echte Trades (eToro) – fehlt in Sicherungen vor 2026-11 */
  journal?: { eintraege: JournalEintrag[] }
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
  rueckblicke: GespeicherterRueckblick[] = [],
  eintraege: JournalEintrag[] = [],
): Sicherung {
  return {
    app: 'chartakademie',
    version: SICHERUNG_VERSION,
    exportiertAm: jetzt.toISOString(),
    simulator: { tradeHistorie, rueckblicke },
    journal: { eintraege },
    fortschritt,
  }
}

/** Echte Trades aus einer Sicherung (leer bei älteren Dateien) */
export function sicherungEintraege(s: Sicherung): JournalEintrag[] {
  return Array.isArray(s.journal?.eintraege) ? s.journal.eintraege : []
}

// Merge-Regeln liegen importfrei in mergen.ts (auch der Worker nutzt sie); hier nur re-exportiert.
export { mergeEintraege, mergeLektionen, mergeRueckblicke, mergeSzenarien, mergeTrades, mergeWiederholungen }

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
