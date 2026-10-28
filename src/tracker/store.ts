import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MusterId, TrackerConfig } from './types'
import { normalisiereConfig, STANDARD_CONFIG } from './engine/katalog'
import { AktienFehler, anfrage, workerKonfiguriert } from '../aktien/data/client'

// Konfiguration des Markt-Trackers: lokal (persist) und im Worker-KV (/api/tracker),
// von dort liest die GitHub Action. Neuerer Stand (aktualisiertAm) gewinnt.

export type SyncStatus = 'kein-worker' | 'laedt' | 'synchron' | 'fehler'

interface TrackerState {
  config: TrackerConfig
  sync: SyncStatus
  syncFehler: string | null
  instrumentUmschalten: (id: string) => void
  musterUmschalten: (id: MusterId) => void
  pushSetzen: (an: boolean) => void
  /** fernen Stand holen; ist er neuer, übernehmen, sonst eigenen schreiben */
  abgleichen: () => Promise<void>
}

let schreibTimer: ReturnType<typeof setTimeout> | null = null

async function schreiben(config: TrackerConfig, set: (s: Partial<TrackerState>) => void) {
  if (!workerKonfiguriert()) return
  try {
    await anfrage<TrackerConfig>('/api/tracker', { method: 'PUT', body: JSON.stringify(config) })
    set({ sync: 'synchron', syncFehler: null })
  } catch (e) {
    if (e instanceof AktienFehler && e.status === 409) {
      const fern = await anfrage<TrackerConfig | null>('/api/tracker').catch(() => null)
      if (fern) {
        set({ config: normalisiereConfig(fern), sync: 'synchron', syncFehler: null })
        return
      }
    }
    set({ sync: 'fehler', syncFehler: e instanceof Error ? e.message : String(e) })
  }
}

export const useTrackerStore = create<TrackerState>()(
  persist(
    (set, get) => {
      const aendern = (teil: Partial<TrackerConfig>) => {
        const config = { ...get().config, ...teil, aktualisiertAm: Date.now() }
        set({ config })
        if (schreibTimer) clearTimeout(schreibTimer)
        schreibTimer = setTimeout(() => schreiben(get().config, set), 1200)
      }
      return {
        config: { ...STANDARD_CONFIG },
        sync: 'kein-worker',
        syncFehler: null,
        instrumentUmschalten: (id) => {
          const liste = get().config.instrumente
          aendern({ instrumente: liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id] })
        },
        musterUmschalten: (id) => aendern({ muster: { ...get().config.muster, [id]: !get().config.muster[id] } }),
        pushSetzen: (an) => aendern({ push: an }),
        abgleichen: async () => {
          if (!workerKonfiguriert()) {
            set({ sync: 'kein-worker' })
            return
          }
          set({ sync: 'laedt' })
          try {
            const fern = await anfrage<TrackerConfig | null>('/api/tracker')
            const lokal = get().config
            if (fern && fern.aktualisiertAm > lokal.aktualisiertAm) {
              set({ config: normalisiereConfig(fern), sync: 'synchron', syncFehler: null })
            } else if (!fern || lokal.aktualisiertAm > fern.aktualisiertAm) {
              await schreiben(lokal, set)
            } else {
              set({ sync: 'synchron', syncFehler: null })
            }
          } catch (e) {
            set({ sync: 'fehler', syncFehler: e instanceof Error ? e.message : String(e) })
          }
        },
      }
    },
    {
      name: 'chartakademie-tracker',
      partialize: (s) => ({ config: s.config }),
      merge: (gespeichert, aktuell) => {
        const g = (gespeichert ?? {}) as Partial<TrackerState>
        return { ...aktuell, config: normalisiereConfig(g.config) }
      },
    },
  ),
)
