import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Fortschritt der Top-Down-Übung: je Runde Richtung richtig? und Zonen-Trefferquote.

export interface TopDownRunde {
  am: number
  instrument: string
  richtungRichtig: boolean
  /** getroffene wichtige Zonen / wichtige Zonen */
  zonenGetroffen: number
  zonenWichtig: number
  /** Bänder ohne Zone */
  zonenUeberfluessig: number
}

const MAX_RUNDEN = 200

interface TopDownState {
  runden: TopDownRunde[]
  rundeSpeichern: (r: TopDownRunde) => void
  zuruecksetzen: () => void
}

export const useTopDownStore = create<TopDownState>()(
  persist(
    (set) => ({
      runden: [],
      rundeSpeichern: (r) => set((s) => ({ runden: [...s.runden, r].slice(-MAX_RUNDEN) })),
      zuruecksetzen: () => set({ runden: [] }),
    }),
    { name: 'chartakademie-topdown' },
  ),
)

export function topDownStatistik(runden: TopDownRunde[]): { runden: number; richtungQuote: number; zonenQuote: number } {
  if (runden.length === 0) return { runden: 0, richtungQuote: 0, zonenQuote: 0 }
  const richtung = runden.filter((r) => r.richtungRichtig).length / runden.length
  const wichtig = runden.reduce((s, r) => s + r.zonenWichtig, 0)
  const getroffen = runden.reduce((s, r) => s + r.zonenGetroffen, 0)
  return { runden: runden.length, richtungQuote: richtung, zonenQuote: wichtig ? getroffen / wichtig : 0 }
}
