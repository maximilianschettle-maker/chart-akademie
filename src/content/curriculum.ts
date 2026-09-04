import type { Lesson, LevelDef } from '../types'
import { l1Lektionen } from './lektionen'

// Einzige Quelle für Reihenfolge und Freischaltung des Lernpfads.

export const CURRICULUM: LevelDef[] = [
  {
    level: 1,
    titel: 'Grundlagen',
    beschreibung: 'Wie Märkte funktionieren, Kerzen lesen, Long & Short verstehen.',
    lektionIds: ['l1-01', 'l1-02', 'l1-03', 'l1-04', 'l1-05'],
  },
  {
    level: 2,
    titel: 'Risikomanagement',
    beschreibung: 'Das Fundament: Position Sizing, Stop-Loss, R-Multiple, Psychologie.',
    lektionIds: [],
    geplant: [
      'Warum Risiko vor Entry kommt',
      'Position Sizing & die 1-%-Regel',
      'Stop-Loss, Take-Profit & R-Multiple',
      'Trading-Psychologie',
    ],
  },
  {
    level: 3,
    titel: 'Parameter & Marktdaten',
    beschreibung: 'Volume, Volume Profile, Open Interest, Funding, Liquidation & Liquidity Map, Heatmaps.',
    lektionIds: [],
    geplant: [
      'Volumen richtig lesen',
      'Volume Profile (POC & Value Area)',
      'Open Interest & Funding Rate',
      'Liquidation & Liquidity Map',
      'Heatmaps & Orderbuch-Level',
      'EMA & RSI — die zwei Indikatoren, die reichen',
    ],
  },
  {
    level: 4,
    titel: 'Strategien',
    beschreibung: 'Fünf konkrete Setups — mit annotierten Beispielen und Replay-Übungen.',
    lektionIds: [],
    geplant: [
      'Trendfolge mit EMAs',
      'Support/Resistance-Bounce',
      'Breakout + Retest',
      'Range Trading',
      'Liquidity Sweep (SMC-Basics)',
    ],
  },
  {
    level: 5,
    titel: 'Praxis',
    beschreibung: 'Szenario-Serie, freier Replay-Modus und dein Trade-Journal.',
    lektionIds: [],
    geplant: ['Geführte Szenario-Serie', 'Freier Replay-Modus', 'Trade-Journal & Statistik'],
  },
]

export const LEKTIONEN: Record<string, Lesson> = Object.fromEntries(
  [...l1Lektionen].map((l) => [l.id, l]),
)

export const QUIZ_BESTANDEN_PROZENT = 70

/** Ein Level ist frei, wenn alle Lektionen des vorherigen Levels abgeschlossen sind. */
export function istLevelFrei(
  level: number,
  abgeschlossene: Record<string, unknown>,
): boolean {
  if (level === 1) return true
  const vorheriges = CURRICULUM.find((l) => l.level === level - 1)
  if (!vorheriges) return false
  // Level mit noch ungebauten Lektionen können nicht abgeschlossen werden →
  // nachfolgende Level bleiben gesperrt, bis der Content existiert.
  if (vorheriges.lektionIds.length === 0) return false
  return vorheriges.lektionIds.every((id) => id in abgeschlossene)
}

/** Die nächste noch offene Lektion (für den „Weiter lernen"-Button). */
export function naechsteOffeneLektion(
  abgeschlossene: Record<string, unknown>,
): Lesson | undefined {
  for (const level of CURRICULUM) {
    if (!istLevelFrei(level.level, abgeschlossene)) break
    for (const id of level.lektionIds) {
      if (!(id in abgeschlossene)) return LEKTIONEN[id]
    }
  }
  return undefined
}
