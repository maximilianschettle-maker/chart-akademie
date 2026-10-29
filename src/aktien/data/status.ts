import { create } from 'zustand'

// Zustand der Worker-Verbindung für die Statusanzeige (live / veraltet / Fehler). Nicht persistiert:
// nach einem Neustart ist der Zustand unbekannt, bis die erste Anfrage durch ist.

export type DatenLage = 'unbekannt' | 'live' | 'veraltet' | 'fehler'

export interface DatenStatusState {
  lage: DatenLage
  /** Unix-ms der letzten erfolgreichen Antwort */
  letzterErfolg: number | null
  /** Unix-ms des ältesten Stands, der gerade als Ersatz angezeigt wird */
  standVeraltet: number | null
  letzterFehler: string | null
  fehlerSeit: number | null
  erfolg: () => void
  veraltet: (standAm: number | undefined, grund?: string) => void
  fehler: (text: string) => void
}

export const useDatenStatus = create<DatenStatusState>()((set) => ({
  lage: 'unbekannt',
  letzterErfolg: null,
  standVeraltet: null,
  letzterFehler: null,
  fehlerSeit: null,
  erfolg: () => set({ lage: 'live', letzterErfolg: Date.now(), standVeraltet: null, letzterFehler: null, fehlerSeit: null }),
  veraltet: (standAm, grund) =>
    set((s) => ({
      lage: 'veraltet',
      standVeraltet: standAm ?? s.standVeraltet,
      letzterFehler: grund ?? s.letzterFehler,
      fehlerSeit: s.fehlerSeit ?? Date.now(),
    })),
  fehler: (text) => set((s) => ({ lage: s.lage === 'veraltet' ? 'veraltet' : 'fehler', letzterFehler: text, fehlerSeit: s.fehlerSeit ?? Date.now() })),
}))

/** Für Nicht-React-Code: Status melden, ohne den Hook zu brauchen */
export const datenStatus = {
  erfolg: () => useDatenStatus.getState().erfolg(),
  veraltet: (standAm: number | undefined, grund?: string) => useDatenStatus.getState().veraltet(standAm, grund),
  fehler: (text: string) => useDatenStatus.getState().fehler(text),
}
