import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SzenarioBewertung } from '../types'

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
  lektionAbschliessen: (lektionId: string, quizProzent: number) => void
  szenarioAbschliessen: (szenarioId: string, ergebnis: SzenarioErgebnis) => void
  zuruecksetzen: () => void
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      abgeschlosseneLektionen: {},
      szenarioErgebnisse: {},

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

      zuruecksetzen: () =>
        set({ abgeschlosseneLektionen: {}, szenarioErgebnisse: {} }),
    }),
    { name: 'chartakademie-fortschritt' },
  ),
)
