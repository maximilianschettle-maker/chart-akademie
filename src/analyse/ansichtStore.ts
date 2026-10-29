import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Trader- oder Investor-Ansicht im Analyse-Bereich (Phase 3). Gleiche Daten, andere Voreinstellungen:
//   Trader   – Kerzen, Tages- und Intraday-Zeiträume, EMA/RSI/Volumen, Zeichenwerkzeuge, CRV-Rechner
//   Investor – Linienchart, Wochen/Monate, Log-Skala, Fundamentalkennzahlen, Leitzins-Overlay
// Die Wahl bleibt im Browser (localStorage `chartakademie-ansicht`), ebenso Konto und Risiko des CRV-Rechners.

export type Ansicht = 'trader' | 'investor'

interface AnsichtState {
  ansicht: Ansicht
  /** CRV-Rechner: Kontogröße in Kurswährung und Risiko je Trade in Prozent */
  konto: number
  risikoProzent: number
  /** Trader-Chart: Indikatoren */
  ema: number[]
  rsi: boolean
  volumen: boolean
  /** Investor-Chart: Leitzins als Overlay */
  leitzins: boolean
  setAnsicht: (a: Ansicht) => void
  setzen: (neu: Partial<Pick<AnsichtState, 'konto' | 'risikoProzent' | 'ema' | 'rsi' | 'volumen' | 'leitzins'>>) => void
}

export const useAnsichtStore = create<AnsichtState>()(
  persist(
    (set) => ({
      ansicht: 'trader',
      konto: 10_000,
      risikoProzent: 1,
      ema: [20, 50],
      rsi: false,
      volumen: true,
      leitzins: true,
      setAnsicht: (ansicht) => set({ ansicht }),
      setzen: (neu) => set(neu),
    }),
    { name: 'chartakademie-ansicht' },
  ),
)

export function useAnsicht(): Ansicht {
  return useAnsichtStore((s) => s.ansicht)
}
