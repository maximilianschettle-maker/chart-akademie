import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Trade, Zeichnung } from '../types'
import type { BrokerZustand } from '../engine/broker'
import { MAKER_GEBUEHR, SLIPPAGE, TAKER_GEBUEHR } from '../engine/broker'
import type { SitzungConfig } from '../data/sitzung'
import { kontostandAus, mergeTrades } from '../engine/sicherung'

export const START_KAPITAL = 10000

export interface SimEinstellungen {
  /** Gebühren und Slippage als Anteil (0,0005 = 0,05 %) */
  taker: number
  maker: number
  slippage: number
  funding: boolean
  /** Positionswert darf höchstens Konto × maxHebel sein */
  maxHebel: number
  /** Replay hält an, sobald eine Order füllt oder eine Position schließt */
  pauseBeiEreignis: boolean
  ema: number[]
  rsi: boolean
  volumen: boolean
}

export const STANDARD_EINSTELLUNGEN: SimEinstellungen = {
  taker: TAKER_GEBUEHR,
  maker: MAKER_GEBUEHR,
  slippage: SLIPPAGE,
  funding: true,
  maxHebel: 20,
  pauseBeiEreignis: true,
  ema: [],
  rsi: false,
  volumen: true,
}

/** Stand einer laufenden Sitzung — überlebt Reload und geschlossene Tabs. */
export interface GespeicherteSitzung {
  config: SitzungConfig
  /** Zeit der letzten sichtbaren Kerze */
  cursorZeit: number
  broker: BrokerZustand
  zeichnungen: Zeichnung[]
  startKapital: number
  gespieltKerzen: number
}

interface SimulatorState {
  kontostand: number
  tradeHistorie: Trade[]
  einstellungen: SimEinstellungen
  aktiveSitzung: GespeicherteSitzung | null
  /** Übernimmt neue Trades (dedupliziert per id) und verbucht ihre PnL. */
  tradesUebernehmen: (neue: Trade[]) => void
  /** Import aus einer Sicherung: Trades zusammenführen, Kontostand neu ableiten. */
  tradesImportieren: (neue: Trade[]) => void
  einstellungenSetzen: (neu: Partial<SimEinstellungen>) => void
  sitzungSpeichern: (s: GespeicherteSitzung | null) => void
  zuruecksetzen: () => void
}

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set) => ({
      kontostand: START_KAPITAL,
      tradeHistorie: [],
      einstellungen: STANDARD_EINSTELLUNGEN,
      aktiveSitzung: null,

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

      tradesImportieren: (neue) =>
        set((s) => {
          const tradeHistorie = mergeTrades(s.tradeHistorie, neue)
          return { tradeHistorie, kontostand: kontostandAus(START_KAPITAL, tradeHistorie) }
        }),

      einstellungenSetzen: (neu) => set((s) => ({ einstellungen: { ...s.einstellungen, ...neu } })),

      sitzungSpeichern: (aktiveSitzung) => set({ aktiveSitzung }),

      zuruecksetzen: () => set({ kontostand: START_KAPITAL, tradeHistorie: [], aktiveSitzung: null }),
    }),
    {
      name: 'chartakademie-simulator',
      // Ältere Stände kennen einstellungen/aktiveSitzung noch nicht → Defaults ergänzen
      merge: (gespeichert, aktuell) => {
        const g = (gespeichert ?? {}) as Partial<SimulatorState>
        return {
          ...aktuell,
          ...g,
          einstellungen: { ...STANDARD_EINSTELLUNGEN, ...g.einstellungen },
        }
      },
    },
  ),
)
