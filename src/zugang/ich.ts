// „Wer bin ich?“ beim Worker: Name, Rolle, KI-Verbrauch. Nicht persistiert — der Code im
// Aktien-Store ist die Wahrheit, dieser Store nur die Antwort des Workers dazu.
import { create } from 'zustand'
import { anfrage } from '../aktien/data/client'
import { useAktienStore } from '../aktien/store'

export type Rolle = 'admin' | 'nutzer' | 'dienst'

export interface Ich {
  nutzerId: string
  name: string
  rolle: Rolle
  ki: { heute: number; limit: number | null }
  version: string
}

/** Mit `code` wird dieser Code geprüft statt des gespeicherten (Eingabe vor dem Speichern). */
export async function ichLaden(code?: string): Promise<Ich> {
  const ich = await anfrage<Ich>('/api/ich', code ? { headers: { Authorization: `Bearer ${code}` } } : {})
  if (!ich || typeof ich.nutzerId !== 'string') throw new Error('Leere Antwort vom Worker')
  return ich
}

export type ZugangStatus = 'unbekannt' | 'prueft' | 'ok' | 'fehler'

interface ZugangState {
  ich: Ich | null
  status: ZugangStatus
  fehler: string | null
  /** true direkt nach einer erfolgreichen Code-Eingabe (Willkommensmeldung in der Karte) */
  willkommen: boolean
  /** Antwort des Workers zum gespeicherten Code holen (beim Start, nach Code-Wechsel) */
  pruefen: () => Promise<void>
  zuruecksetzen: () => void
}

export const useZugangStore = create<ZugangState>()((set) => ({
  ich: null,
  status: 'unbekannt',
  fehler: null,
  willkommen: false,
  pruefen: async () => {
    if (!useAktienStore.getState().code.trim()) {
      set({ ich: null, status: 'unbekannt', fehler: null, willkommen: false })
      return
    }
    set({ status: 'prueft', fehler: null })
    try {
      const ich = await ichLaden()
      set({ ich, status: 'ok', fehler: null })
    } catch (e) {
      set({ ich: null, status: 'fehler', fehler: e instanceof Error ? e.message : String(e) })
    }
  },
  zuruecksetzen: () => set({ ich: null, status: 'unbekannt', fehler: null, willkommen: false }),
}))

let gestartet = false

/** Einmal beim App-Start: Code prüfen und bei Code-Wechsel erneut. */
export function zugangStarten(): void {
  if (gestartet) return
  gestartet = true
  useAktienStore.subscribe((s, vorher) => {
    if (s.code !== vorher.code) void useZugangStore.getState().pruefen()
  })
  void useZugangStore.getState().pruefen()
}
