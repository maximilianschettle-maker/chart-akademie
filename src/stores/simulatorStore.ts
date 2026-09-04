import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Trade } from '../types'

export const START_KAPITAL = 10000

interface SimulatorState {
  kontostand: number
  tradeHistorie: Trade[]
  /** Übernimmt neue Trades (dedupliziert per id) und verbucht ihre PnL. */
  tradesUebernehmen: (neue: Trade[]) => void
  zuruecksetzen: () => void
}

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set) => ({
      kontostand: START_KAPITAL,
      tradeHistorie: [],

      tradesUebernehmen: (neue) =>
        set((s) => {
          const vorhanden = new Set(s.tradeHistorie.map((t) => t.id))
          const frisch = neue.filter((t) => !vorhanden.has(t.id))
          if (frisch.length === 0) return s
          return {
            kontostand: s.kontostand + frisch.reduce((summe, t) => summe + t.pnl, 0),
            tradeHistorie: [...s.tradeHistorie, ...frisch],
          }
        }),

      zuruecksetzen: () => set({ kontostand: START_KAPITAL, tradeHistorie: [] }),
    }),
    { name: 'chartakademie-simulator' },
  ),
)
