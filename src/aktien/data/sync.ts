// Geräte-Sync von Watchlist, DCF-Annahmen und CIK-Zuordnungen über den Worker (KV).
// Läuft unabhängig von React-Komponenten: Beim Start wird der ferne Stand geholt und gemergt,
// jede lokale Änderung wird verzögert geschrieben — auch wenn die Seite inzwischen gewechselt hat.
import { useSyncExternalStore } from 'react'
import { syncZustandAus, useAktienStore } from '../store'
import { workerKonfiguriert } from './client'
import { zustandHolen, zustandSchreiben } from './service'

const VERZOEGERUNG_MS = 1500

let abonniert = false
let geholtFuer = ''
let timer: ReturnType<typeof setTimeout> | null = null
let zuletztGeschrieben = 0
let fehler: string | null = null
const hoerer = new Set<() => void>()

function melde(f: string | null) {
  fehler = f
  for (const h of hoerer) h()
}

function schluessel(): string {
  const s = useAktienStore.getState()
  return `${s.workerUrl}|${s.secret}`
}

async function holen(): Promise<void> {
  if (!workerKonfiguriert()) return
  const key = schluessel()
  if (geholtFuer === key) return
  try {
    const fern = await zustandHolen()
    if (schluessel() !== key) return // Einstellungen wurden währenddessen geändert
    if (fern) useAktienStore.getState().zustandUebernehmen(fern)
    geholtFuer = key
    useAktienStore.getState().syncMarkieren()
    melde(null)
    // Lokal gibt es Änderungen, die der Worker noch nicht kennt → schreiben
    const s = useAktienStore.getState()
    if (!fern || s.aktualisiertAm > fern.aktualisiertAm) planeSchreiben()
  } catch (e) {
    melde(e instanceof Error ? e.message : String(e))
  }
}

function planeSchreiben() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(schreiben, VERZOEGERUNG_MS)
}

async function schreiben(): Promise<void> {
  timer = null
  if (!workerKonfiguriert() || geholtFuer !== schluessel()) return
  const z = syncZustandAus(useAktienStore.getState())
  if (z.aktualisiertAm === 0 || z.aktualisiertAm === zuletztGeschrieben) return
  try {
    const r = await zustandSchreiben(z)
    if (!r.ok) {
      useAktienStore.getState().zustandUebernehmen(r.fern)
      const erneut = syncZustandAus(useAktienStore.getState())
      if (erneut.aktualisiertAm > r.fern.aktualisiertAm) await zustandSchreiben(erneut)
      zuletztGeschrieben = erneut.aktualisiertAm
    } else {
      zuletztGeschrieben = z.aktualisiertAm
    }
    useAktienStore.getState().syncMarkieren()
    melde(null)
  } catch (e) {
    melde(e instanceof Error ? e.message : String(e))
  }
}

/** Einmalig abonnieren, dann fernen Stand holen. Mehrfachaufrufe sind harmlos. */
export function syncStarten(): void {
  if (!abonniert) {
    abonniert = true
    useAktienStore.subscribe((s, vorher) => {
      if (s.aktualisiertAm !== vorher.aktualisiertAm) planeSchreiben()
      if (s.workerUrl !== vorher.workerUrl || s.secret !== vorher.secret) {
        geholtFuer = ''
        void holen()
      }
    })
  }
  void holen()
}

export function useSyncFehler(): string | null {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => fehler,
  )
}
