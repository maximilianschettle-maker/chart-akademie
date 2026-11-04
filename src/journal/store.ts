import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JournalEintrag } from './types'
import { mergeEintraege } from './engine'

// Echte Trades (eToro) – localStorage `chartakademie-journal`. Snapshots der Kerzen liegen
// getrennt in IndexedDB (snapshots.ts), damit der Store klein bleibt.

interface JournalState {
  eintraege: JournalEintrag[]
  hinzufuegen: (e: JournalEintrag) => void
  /** Felder ändern; geaendertAm wird gesetzt */
  aendern: (id: string, teil: Partial<JournalEintrag>, jetztMs?: number) => void
  loeschen: (id: string) => void
  /** Import/Sync: zusammenführen, neuerer Stand je Id gewinnt */
  importieren: (neue: JournalEintrag[]) => void
  /** Git-Sync „ersetzen“ */
  ersetzen: (eintraege: JournalEintrag[]) => void
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      eintraege: [],
      hinzufuegen: (e) => set((s) => ({ eintraege: mergeEintraege(s.eintraege, [e]) })),
      aendern: (id, teil, jetztMs = Date.now()) =>
        set((s) => ({
          eintraege: s.eintraege.map((e) => (e.id === id ? { ...e, ...teil, id, geaendertAm: jetztMs } : e)),
        })),
      loeschen: (id) => set((s) => ({ eintraege: s.eintraege.filter((e) => e.id !== id) })),
      importieren: (neue) => set((s) => ({ eintraege: mergeEintraege(s.eintraege, neue) })),
      ersetzen: (eintraege) => set({ eintraege: mergeEintraege([], eintraege) }),
    }),
    { name: 'chartakademie-journal' },
  ),
)
