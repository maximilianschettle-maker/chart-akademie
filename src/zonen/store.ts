import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AktienFehler, anfrage, codeVorhanden } from '../aktien/data/client'
import { LEERER_STATUS, normalisiereStatus, type ZonenStatus } from './alarm'
import { annaeherungBegrenzt, normalisiereZonen, zoneGeaendert } from './engine'
import { ANNAEHERUNG_STANDARD, ZONEN_MAX, type PreisZone, type ZonenMarktId, type ZonenStand, type ZonenZeiteinheit } from './types'

// Preiszonen des Nutzers: lokal (localStorage `chartakademie-zonen`) und im Worker-KV (/api/zonen),
// von dort liest sie die Tracker-Action für die Alarme. Neuerer Stand (aktualisiertAm) gewinnt –
// wie bei den Tracker-Einstellungen. Der Alarm-Status (/api/zonen/status) wird nur gelesen.

export type ZonenSync = 'kein-worker' | 'laedt' | 'synchron' | 'fehler'

interface ZonenState extends ZonenStand {
  /** zuletzt gewählte Ansicht der Zonen-Seite */
  markt: ZonenMarktId
  zeiteinheit: ZonenZeiteinheit
  sync: ZonenSync
  syncFehler: string | null
  /** Alarm-Zustand je Zone und letzte Alarme, wie die Action sie zuletzt gespeichert hat */
  status: ZonenStatus
  ansichtSetzen: (teil: { markt?: ZonenMarktId; zeiteinheit?: ZonenZeiteinheit }) => void
  /** false, wenn die Obergrenze erreicht ist */
  hinzu: (z: PreisZone) => boolean
  aendern: (id: string, teil: Partial<Omit<PreisZone, 'id' | 'erstelltAm'>>) => void
  loeschen: (id: string) => void
  annaeherungSetzen: (prozent: number) => void
  /** fernen Stand holen; ist er neuer, übernehmen, sonst eigenen schreiben */
  abgleichen: () => Promise<void>
  statusLaden: () => Promise<void>
}

const SCHREIB_PAUSE_MS = 1500
let schreibTimer: ReturnType<typeof setTimeout> | null = null

const standVon = (s: ZonenStand): ZonenStand => ({ zonen: s.zonen, annaeherungProzent: s.annaeherungProzent, aktualisiertAm: s.aktualisiertAm })

async function schreiben(stand: ZonenStand, set: (s: Partial<ZonenState>) => void, beimVerlassen = false) {
  if (!codeVorhanden()) return
  try {
    // keepalive: die Anfrage überlebt das Schließen des Tabs
    await anfrage<ZonenStand>('/api/zonen', { method: 'PUT', body: JSON.stringify(stand), keepalive: beimVerlassen })
    set({ sync: 'synchron', syncFehler: null })
  } catch (e) {
    if (e instanceof AktienFehler && e.status === 409) {
      const fern = await anfrage<ZonenStand | null>('/api/zonen').catch(() => null)
      if (fern) {
        set({ ...normalisiereZonen(fern), sync: 'synchron', syncFehler: null })
        return
      }
    }
    set({ sync: 'fehler', syncFehler: e instanceof Error ? e.message : String(e) })
  }
}

/** Wartet noch eine Änderung auf ihr Schreiben, geht sie sofort raus (Tab wird verlassen oder geschlossen) */
function offeneAenderungSchreiben() {
  if (!schreibTimer) return
  clearTimeout(schreibTimer)
  schreibTimer = null
  void schreiben(standVon(useZonenStore.getState()), (s) => useZonenStore.setState(s), true)
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') offeneAenderungSchreiben()
  })
  window.addEventListener('pagehide', offeneAenderungSchreiben)
}

export const useZonenStore = create<ZonenState>()(
  persist(
    (set, get) => {
      /** lokale Änderung übernehmen und verzögert in den Worker schreiben */
      const geaendert = (teil: Partial<ZonenStand>) => {
        set({ ...teil, aktualisiertAm: Date.now() })
        if (schreibTimer) clearTimeout(schreibTimer)
        schreibTimer = setTimeout(() => {
          schreibTimer = null
          void schreiben(standVon(get()), set)
        }, SCHREIB_PAUSE_MS)
      }
      return {
        zonen: [],
        annaeherungProzent: ANNAEHERUNG_STANDARD,
        aktualisiertAm: 0,
        markt: 'nasdaq',
        zeiteinheit: '1h',
        sync: 'kein-worker',
        syncFehler: null,
        status: LEERER_STATUS,
        ansichtSetzen: (teil) => set(teil),
        hinzu: (z) => {
          if (get().zonen.length >= ZONEN_MAX) return false
          geaendert({ zonen: [...get().zonen, z] })
          return true
        },
        aendern: (id, teil) => {
          const jetzt = Date.now()
          geaendert({ zonen: get().zonen.map((z) => (z.id === id ? zoneGeaendert(z, teil, jetzt) : z)) })
        },
        loeschen: (id) => geaendert({ zonen: get().zonen.filter((z) => z.id !== id) }),
        annaeherungSetzen: (prozent) => geaendert({ annaeherungProzent: annaeherungBegrenzt(prozent) }),
        abgleichen: async () => {
          if (!codeVorhanden()) {
            set({ sync: 'kein-worker' })
            return
          }
          set({ sync: 'laedt' })
          try {
            const fern = await anfrage<ZonenStand | null>('/api/zonen')
            const lokal = standVon(get())
            if (fern && fern.aktualisiertAm > lokal.aktualisiertAm) {
              set({ ...normalisiereZonen(fern), sync: 'synchron', syncFehler: null })
            } else if (lokal.aktualisiertAm > (fern?.aktualisiertAm ?? 0)) {
              await schreiben(lokal, set)
            } else {
              set({ sync: 'synchron', syncFehler: null })
            }
          } catch (e) {
            set({ sync: 'fehler', syncFehler: e instanceof Error ? e.message : String(e) })
          }
        },
        statusLaden: async () => {
          if (!codeVorhanden()) return
          try {
            set({ status: normalisiereStatus(await anfrage<ZonenStatus>('/api/zonen/status')) })
          } catch {
            // Status ist Beiwerk: der letzte bekannte bleibt stehen
          }
        },
      }
    },
    {
      name: 'chartakademie-zonen',
      partialize: (s) => ({ zonen: s.zonen, annaeherungProzent: s.annaeherungProzent, aktualisiertAm: s.aktualisiertAm, markt: s.markt, zeiteinheit: s.zeiteinheit }),
      merge: (gespeichert, aktuell) => {
        const g = (gespeichert ?? {}) as Partial<ZonenState>
        return { ...aktuell, ...normalisiereZonen(g), markt: g.markt ?? aktuell.markt, zeiteinheit: g.zeiteinheit ?? aktuell.zeiteinheit }
      },
    },
  ),
)
