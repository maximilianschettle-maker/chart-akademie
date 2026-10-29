import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Zeichnung } from '../types'

// Zeichnungen (horizontale Linien, Zonen, Trendlinien) im Trader-Chart je Symbol; bleiben im Browser
// (localStorage `chartakademie-zeichnungen`). Trendlinien hängen an Zeitpunkten und passen deshalb
// nur zu Zeiträumen mit demselben Kerzenintervall – Schlüssel ist Symbol + Intervall.

interface ZeichnungenState {
  je: Record<string, Zeichnung[]>
  hinzu: (schluessel: string, z: Zeichnung) => void
  loeschen: (schluessel: string) => void
}

export const useZeichnungenStore = create<ZeichnungenState>()(
  persist(
    (set) => ({
      je: {},
      hinzu: (schluessel, z) => set((s) => ({ je: { ...s.je, [schluessel]: [...(s.je[schluessel] ?? []), z].slice(-40) } })),
      loeschen: (schluessel) =>
        set((s) => {
          const je = { ...s.je }
          delete je[schluessel]
          return { je }
        }),
    }),
    { name: 'chartakademie-zeichnungen' },
  ),
)

export const KEINE_ZEICHNUNGEN: Zeichnung[] = []
