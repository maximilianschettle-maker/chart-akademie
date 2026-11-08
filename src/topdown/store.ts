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
  /** Teil 2: Replay-Entscheidung (fehlt, wenn die Runde vor dem Replay beendet wurde) */
  replay?: { entscheidung: 'trade' | 'kein-trade'; bewertung: string; r: number | null }
}

const MAX_RUNDEN = 200

interface TopDownState {
  runden: TopDownRunde[]
  rundeSpeichern: (r: TopDownRunde) => void
  /** Replay-Ergebnis an die zuletzt gespeicherte Runde hängen */
  replayErgaenzen: (am: number, replay: NonNullable<TopDownRunde['replay']>) => void
  zuruecksetzen: () => void
}

export const useTopDownStore = create<TopDownState>()(
  persist(
    (set) => ({
      runden: [],
      rundeSpeichern: (r) => set((s) => ({ runden: [...s.runden, r].slice(-MAX_RUNDEN) })),
      replayErgaenzen: (am, replay) => set((s) => ({ runden: s.runden.map((r) => (r.am === am ? { ...r, replay } : r)) })),
      zuruecksetzen: () => set({ runden: [] }),
    }),
    { name: 'chartakademie-topdown' },
  ),
)

export function topDownStatistik(runden: TopDownRunde[]): { runden: number; richtungQuote: number; zonenQuote: number; replayRunden: number; replayQuote: number } {
  if (runden.length === 0) return { runden: 0, richtungQuote: 0, zonenQuote: 0, replayRunden: 0, replayQuote: 0 }
  const richtung = runden.filter((r) => r.richtungRichtig).length / runden.length
  const wichtig = runden.reduce((s, r) => s + r.zonenWichtig, 0)
  const getroffen = runden.reduce((s, r) => s + r.zonenGetroffen, 0)
  const mitReplay = runden.filter((r) => r.replay)
  const gut = mitReplay.filter((r) => r.replay!.bewertung === 'sauber' || r.replay!.bewertung === 'richtig').length
  return { runden: runden.length, richtungQuote: richtung, zonenQuote: wichtig ? getroffen / wichtig : 0, replayRunden: mitReplay.length, replayQuote: mitReplay.length ? gut / mitReplay.length : 0 }
}
