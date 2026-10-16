import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DcfAnnahmen, SyncZustand } from './types'

// Eigener Store für den Aktien-Bereich (chartakademie-aktien). Bewusst getrennt von
// Fortschritt, Journal und Git-Sync: nichts davon landet in Export/Import oder im Repo.
// Das Worker-Geheimnis bleibt wie das GitHub-Token nur im Browser-Speicher.

export interface AktienEinstellungen {
  /** Basis-URL des Cloudflare Workers, z.B. https://chart-akademie-aktien.xyz.workers.dev */
  workerUrl: string
  secret: string
}

interface AktienState extends AktienEinstellungen, Omit<SyncZustand, 'aktualisiertAm'> {
  /** Zeitpunkt der letzten lokalen Änderung am Sync-Zustand (Watchlist, DCF, CIK) */
  aktualisiertAm: number
  letzterSync: number | null
  einstellungenSetzen: (neu: Partial<AktienEinstellungen>) => void
  watchlistHinzu: (symbol: string, name: string) => void
  watchlistEntfernen: (symbol: string) => void
  dcfSetzen: (symbol: string, annahmen: DcfAnnahmen | null) => void
  cikSetzen: (symbol: string, cik: string | null) => void
  /** Stand aus dem Worker übernehmen (Geräte-Sync); liefert true, wenn lokal etwas Neueres existiert */
  zustandUebernehmen: (fern: SyncZustand) => void
  syncMarkieren: () => void
}

const STANDARD_URL = import.meta.env.DEV ? 'http://localhost:8787' : ''
const STANDARD_SECRET = import.meta.env.DEV ? 'test' : ''

export const useAktienStore = create<AktienState>()(
  persist(
    (set) => ({
      workerUrl: STANDARD_URL,
      secret: STANDARD_SECRET,
      watchlist: [],
      dcfAnnahmen: {},
      cikManuell: {},
      aktualisiertAm: 0,
      letzterSync: null,

      einstellungenSetzen: (neu) => set(neu),

      watchlistHinzu: (symbol, name) =>
        set((s) => {
          if (s.watchlist.some((w) => w.symbol === symbol)) return s
          return { watchlist: [...s.watchlist, { symbol, name, hinzugefuegtAm: Date.now() }], aktualisiertAm: Date.now() }
        }),

      watchlistEntfernen: (symbol) =>
        set((s) => ({ watchlist: s.watchlist.filter((w) => w.symbol !== symbol), aktualisiertAm: Date.now() })),

      dcfSetzen: (symbol, annahmen) =>
        set((s) => {
          const rest = { ...s.dcfAnnahmen }
          if (annahmen) rest[symbol] = annahmen
          else delete rest[symbol]
          return { dcfAnnahmen: rest, aktualisiertAm: Date.now() }
        }),

      cikSetzen: (symbol, cik) =>
        set((s) => {
          const rest = { ...s.cikManuell }
          if (cik) rest[symbol] = cik
          else delete rest[symbol]
          return { cikManuell: rest, aktualisiertAm: Date.now() }
        }),

      zustandUebernehmen: (fern) =>
        set((s) => {
          if (fern.aktualisiertAm <= s.aktualisiertAm) return s
          // Der fernere Stand ist neuer: übernehmen, aber lokal seitdem Hinzugefügtes behalten
          const seitdem = s.watchlist.filter((w) => w.hinzugefuegtAm > fern.aktualisiertAm && !fern.watchlist.some((f) => f.symbol === w.symbol))
          return {
            watchlist: [...fern.watchlist, ...seitdem],
            dcfAnnahmen: { ...fern.dcfAnnahmen },
            cikManuell: { ...fern.cikManuell },
            aktualisiertAm: seitdem.length > 0 ? Date.now() : fern.aktualisiertAm,
          }
        }),

      syncMarkieren: () => set({ letzterSync: Date.now() }),
    }),
    {
      name: 'chartakademie-aktien',
      merge: (gespeichert, aktuell) => {
        const g = (gespeichert ?? {}) as Partial<AktienState>
        return { ...aktuell, ...g, watchlist: g.watchlist ?? [], dcfAnnahmen: g.dcfAnnahmen ?? {}, cikManuell: g.cikManuell ?? {} }
      },
    },
  ),
)

export function syncZustandAus(s: Pick<AktienState, 'watchlist' | 'dcfAnnahmen' | 'cikManuell' | 'aktualisiertAm'>): SyncZustand {
  return { watchlist: s.watchlist, dcfAnnahmen: s.dcfAnnahmen, cikManuell: s.cikManuell, aktualisiertAm: s.aktualisiertAm }
}
