import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DcfAnnahmen, SyncZustand } from './types'

// Eigener Store für den Aktien-Bereich (chartakademie-aktien). Bewusst getrennt von
// Fortschritt, Journal und Git-Sync: nichts davon landet in Export/Import oder im Repo.
// Der Einladungscode bleibt wie das GitHub-Token nur im Browser-Speicher.

export interface AktienEinstellungen {
  /** Einladungscode (CA-XXXX-XXXX-XXXX); die Worker-Adresse ist fest (config.ts) */
  code: string
  /** Firmenvergleich: Beträge in dieser Währung anzeigen; '' = jeweilige Originalwährung */
  vergleichsWaehrung: string
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

/** Im Dev-Server ist „test“ das Dienst-Token aus worker/.dev.vars */
const STANDARD_CODE = import.meta.env.DEV ? 'test' : ''

export const AKTIEN_STORE_VERSION = 2

/**
 * Version 1 hatte workerUrl + secret. Das alte Geheimnis ist jetzt das Dienst-Token des Workers
 * und wird als Code weitergereicht, damit die Geräte des Owners nach dem Update ohne Eingabe
 * weiterlaufen (die Zugang-Karte bittet dann, es durch den Admin-Code zu ersetzen).
 */
export function migriereAktienStand(gespeichert: unknown, version: number): Partial<AktienState> {
  const g = (gespeichert && typeof gespeichert === 'object' ? gespeichert : {}) as Record<string, unknown>
  if (version >= AKTIEN_STORE_VERSION) return g as Partial<AktienState>
  const { workerUrl: _url, secret, ...rest } = g
  void _url
  return { ...rest, code: typeof secret === 'string' ? secret.trim() : '' } as Partial<AktienState>
}

export const useAktienStore = create<AktienState>()(
  persist(
    (set) => ({
      code: STANDARD_CODE,
      vergleichsWaehrung: '',
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
      version: AKTIEN_STORE_VERSION,
      migrate: (gespeichert, version) => migriereAktienStand(gespeichert, version) as AktienState,
      merge: (gespeichert, aktuell) => {
        const g = (gespeichert ?? {}) as Partial<AktienState>
        return { ...aktuell, ...g, code: typeof g.code === 'string' ? g.code : aktuell.code, watchlist: g.watchlist ?? [], dcfAnnahmen: g.dcfAnnahmen ?? {}, cikManuell: g.cikManuell ?? {} }
      },
    },
  ),
)

export function syncZustandAus(s: Pick<AktienState, 'watchlist' | 'dcfAnnahmen' | 'cikManuell' | 'aktualisiertAm'>): SyncZustand {
  return { watchlist: s.watchlist, dcfAnnahmen: s.dcfAnnahmen, cikManuell: s.cikManuell, aktualisiertAm: s.aktualisiertAm }
}
