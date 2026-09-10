import type { LessonMeta, LevelDef } from '../types'
import { LEKTION_META, ladeLektion } from './lektionen'

// Einzige Quelle für Reihenfolge und Freischaltung des Lernpfads.
// Lektionstexte werden lazy geladen (siehe lektionen/index.ts) — hier gibt es
// nur die Meta-Daten.

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
    lektionIds: ['l2-01', 'l2-02', 'l2-03', 'l2-04'],
  },
  {
    level: 3,
    titel: 'Parameter & Marktdaten',
    beschreibung: 'Volume, Volume Profile, Open Interest, Funding, Liquidation & Liquidity Map, Heatmaps.',
    lektionIds: ['l3-01', 'l3-02', 'l3-03', 'l3-04', 'l3-05', 'l3-06'],
  },
  {
    level: 4,
    titel: 'Strategien',
    beschreibung: 'Fünf konkrete Setups — mit echten Beispielen und Replay-Übungen.',
    lektionIds: ['l4-01', 'l4-02', 'l4-03', 'l4-04', 'l4-05'],
  },
  {
    level: 5,
    titel: 'Praxis',
    beschreibung: 'Szenario-Serie, freier Replay-Modus, Trade-Journal — und die Prüfung ohne Ansage.',
    lektionIds: ['l5-01', 'l5-02', 'l5-03', 'l5-04'],
  },
]

export const LEKTIONEN_META: Record<string, LessonMeta> = Object.fromEntries(
  LEKTION_META.map((l) => [l.id, l]),
)

export { ladeLektion }

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
): LessonMeta | undefined {
  for (const level of CURRICULUM) {
    if (!istLevelFrei(level.level, abgeschlossene)) break
    for (const id of level.lektionIds) {
      if (!(id in abgeschlossene)) return LEKTIONEN_META[id]
    }
  }
  return undefined
}
