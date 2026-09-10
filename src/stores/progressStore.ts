import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SzenarioBewertung } from '../types'
import {
  type WiederholungsEintrag,
  neuerEintrag,
  nachWiederholung,
  schluessel,
} from '../engine/wiederholung'

interface LektionErgebnis {
  quizProzent: number
  abgeschlossenAm: number // Unix-ms
}

interface SzenarioErgebnis {
  bewertung: SzenarioBewertung
  rMultiple: number
}

interface ProgressState {
  abgeschlosseneLektionen: Record<string, LektionErgebnis>
  szenarioErgebnisse: Record<string, SzenarioErgebnis>
  /** Falsch beantwortete Quizfragen in der Wiederholungs-Box (Spaced Repetition) */
  wiederholungen: Record<string, WiederholungsEintrag>
  lektionAbschliessen: (lektionId: string, quizProzent: number) => void
  szenarioAbschliessen: (szenarioId: string, ergebnis: SzenarioErgebnis) => void
  /** Antwort im Lektions-Quiz: falsch → Frage landet in der Box (bzw. bleibt drin) */
  frageBeantwortet: (lektionId: string, frageIndex: number, richtig: boolean) => void
  /** Antwort in der Wiederholung: richtig → Stufe hoch, falsch → zurück auf Stufe 0 */
  wiederholungBeantwortet: (key: string, richtig: boolean) => void
  zuruecksetzen: () => void
  /** Kompletten Zustand ersetzen (Import) */
  importieren: (daten: Pick<ProgressState, 'abgeschlosseneLektionen' | 'szenarioErgebnisse' | 'wiederholungen'>) => void
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      abgeschlosseneLektionen: {},
      szenarioErgebnisse: {},
      wiederholungen: {},

      lektionAbschliessen: (lektionId, quizProzent) =>
        set((s) => ({
          abgeschlosseneLektionen: {
            ...s.abgeschlosseneLektionen,
            [lektionId]: { quizProzent, abgeschlossenAm: Date.now() },
          },
        })),

      szenarioAbschliessen: (szenarioId, ergebnis) =>
        set((s) => ({
          szenarioErgebnisse: { ...s.szenarioErgebnisse, [szenarioId]: ergebnis },
        })),

      frageBeantwortet: (lektionId, frageIndex, richtig) =>
        set((s) => {
          if (richtig) return s
          const key = schluessel(lektionId, frageIndex)
          const vorhanden = s.wiederholungen[key]
          const eintrag = vorhanden
            ? { ...vorhanden, stufe: 0, faelligAm: neuerEintrag(lektionId, frageIndex).faelligAm, fehlversuche: vorhanden.fehlversuche + 1 }
            : neuerEintrag(lektionId, frageIndex)
          return { wiederholungen: { ...s.wiederholungen, [key]: eintrag } }
        }),

      wiederholungBeantwortet: (key, richtig) =>
        set((s) => {
          const e = s.wiederholungen[key]
          if (!e) return s
          const neu = nachWiederholung(e, richtig)
          const rest = { ...s.wiederholungen }
          if (neu) rest[key] = neu
          else delete rest[key]
          return { wiederholungen: rest }
        }),

      zuruecksetzen: () =>
        set({ abgeschlosseneLektionen: {}, szenarioErgebnisse: {}, wiederholungen: {} }),

      importieren: (daten) =>
        set({
          abgeschlosseneLektionen: daten.abgeschlosseneLektionen ?? {},
          szenarioErgebnisse: daten.szenarioErgebnisse ?? {},
          wiederholungen: daten.wiederholungen ?? {},
        }),
    }),
    { name: 'chartakademie-fortschritt' },
  ),
)
