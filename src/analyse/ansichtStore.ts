import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Einstellungen des Trader-Charts im Analyse-Bereich: Indikatoren und die Vorgaben des CRV-Rechners.
// Bleiben im Browser (localStorage `chartakademie-ansicht`). Der frühere Trader/Investor-Schalter
// ist weg (Nutzerwunsch 2026-10-29): es gibt nur noch die Trader-Ansicht.

interface AnsichtState {
  /** CRV-Rechner: Kontogröße in Kurswährung und Risiko je Trade in Prozent */
  konto: number
  risikoProzent: number
  /** Trader-Chart: Indikatoren */
  ema: number[]
  rsi: boolean
  volumen: boolean
  setzen: (neu: Partial<Pick<AnsichtState, 'konto' | 'risikoProzent' | 'ema' | 'rsi' | 'volumen'>>) => void
}

export const useAnsichtStore = create<AnsichtState>()(
  persist(
    (set) => ({
      konto: 10_000,
      risikoProzent: 1,
      ema: [20, 50],
      rsi: false,
      volumen: true,
      setzen: (neu) => set(neu),
    }),
    { name: 'chartakademie-ansicht' },
  ),
)
