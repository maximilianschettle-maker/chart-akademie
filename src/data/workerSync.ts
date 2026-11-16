// Geräte-Sync von Journal (Simulator-Trades, Rückblicke, echte Trades) und Lernfortschritt
// über den Worker (GET/PUT /api/sync/<teil>). Vorbild: aktien/data/sync.ts.
//
// Läuft unabhängig von React: einmal aus App.tsx gestartet, lauscht es auf die Stores, schreibt
// Änderungen verzögert (5 s, KV-Schreiblimit) und übernimmt den vom Worker gemergten Stand.
// Der Worker mergt selbst (src/engine/mergen.ts), deshalb gibt es keine Konflikte — nur
// „beide Seiten kennen danach dasselbe“.
import { useSyncExternalStore } from 'react'
import { useAktienStore } from '../aktien/store'
import { AktienFehler, anfrage, codeVorhanden } from '../aktien/data/client'
import { syncStandLesen, syncStandText, type SyncStandW, type SyncTeilW } from '../engine/mergen'
import type { Trade } from '../types'
import type { GespeicherterRueckblick } from '../engine/rueckblick'
import type { JournalEintrag } from '../journal/types'
import { useSimulatorStore } from '../stores/simulatorStore'
import { useJournalStore } from '../journal/store'
import { useProgressStore, type UebungsLogEintrag } from '../stores/progressStore'
import { useSyncStore } from '../stores/syncStore'
import { teilZusammenfuehren } from '../engine/gitSync'

export const TEILE: SyncTeilW[] = ['journal', 'fortschritt']
const VERZOEGERUNG_MS = 5000
const NACHHOLEN_MS = 5 * 60_000

export interface WorkerSyncStatus {
  /** false ohne Code oder wenn der Nutzer den Sync abgeschaltet hat */
  aktiv: boolean
  laeuft: boolean
  fehler: string | null
  letzterSync: number | null
}

let status: WorkerSyncStatus = { aktiv: false, laeuft: false, fehler: null, letzterSync: null }
const hoerer = new Set<() => void>()
function setze(teil: Partial<WorkerSyncStatus>) {
  status = { ...status, ...teil }
  for (const h of hoerer) h()
}

let gestartet = false
/** Code, für den beide Teile zuletzt geholt wurden */
let geholtFuer = ''
let zuletztGeholtAm = 0
const timer: Partial<Record<SyncTeilW, ReturnType<typeof setTimeout>>> = {}
/** Text des Stands, den der Worker zuletzt bestätigt hat — gleicher Text = nichts zu schreiben */
const zuletztText: Partial<Record<SyncTeilW, string>> = {}
let offen = 0

function aktiv(): boolean {
  return codeVorhanden() && useSyncStore.getState().cloud
}

function lokalerStand<T extends SyncTeilW>(teil: T): SyncStandW[T] {
  if (teil === 'journal') {
    const sim = useSimulatorStore.getState()
    const stand: SyncStandW['journal'] = {
      tradeHistorie: sim.tradeHistorie,
      rueckblicke: sim.rueckblicke,
      eintraege: useJournalStore.getState().eintraege,
    }
    return stand as SyncStandW[T]
  }
  const p = useProgressStore.getState()
  const stand: SyncStandW['fortschritt'] = {
    abgeschlosseneLektionen: p.abgeschlosseneLektionen,
    szenarioErgebnisse: p.szenarioErgebnisse,
    wiederholungen: p.wiederholungen,
    uebungsLog: p.uebungsLog ?? [],
  }
  return stand as SyncStandW[T]
}

/** Fernen Stand in die Stores mergen (dieselben Regeln wie Datei-Import und Git-Sync). */
function uebernehmen<T extends SyncTeilW>(teil: T, fern: SyncStandW[T]): void {
  if (teil === 'journal') {
    const j = fern as SyncStandW['journal']
    const sim = useSimulatorStore.getState()
    sim.tradesImportieren(j.tradeHistorie as unknown as Trade[])
    sim.rueckblickeImportieren(j.rueckblicke as unknown as GespeicherterRueckblick[])
    useJournalStore.getState().importieren(j.eintraege as unknown as JournalEintrag[])
    return
  }
  const f = fern as SyncStandW['fortschritt']
  const p = useProgressStore.getState()
  const lokal = { abgeschlosseneLektionen: p.abgeschlosseneLektionen, szenarioErgebnisse: p.szenarioErgebnisse, wiederholungen: p.wiederholungen }
  p.importieren(teilZusammenfuehren('fortschritt', lokal, f as unknown as typeof lokal))
  p.uebungsLogImportieren(f.uebungsLog as unknown as UebungsLogEintrag[])
}

function fehlerText(e: unknown): string {
  if (e instanceof AktienFehler && e.status >= 500 && /limit/i.test(e.message)) return 'Speicher-Tageslimit des Workers erreicht – morgen geht es weiter.'
  return e instanceof Error ? e.message : String(e)
}

async function schreiben(teil: SyncTeilW): Promise<void> {
  delete timer[teil]
  if (!aktiv() || geholtFuer !== useAktienStore.getState().code.trim()) return
  const lokal = lokalerStand(teil)
  const text = syncStandText(teil, lokal)
  if (text === zuletztText[teil]) return
  offen++
  setze({ laeuft: true })
  try {
    const antwort = await anfrage<SyncStandW[typeof teil] & { standAm: number }>(`/api/sync/${teil}`, { method: 'PUT', body: JSON.stringify(lokal) })
    const gemergt = antwort ? syncStandLesen(teil, antwort) : null
    if (gemergt) {
      uebernehmen(teil, gemergt)
      zuletztText[teil] = syncStandText(teil, gemergt)
    } else {
      zuletztText[teil] = text
    }
    setze({ fehler: null, letzterSync: Date.now() })
  } catch (e) {
    setze({ fehler: fehlerText(e) })
  } finally {
    offen--
    setze({ laeuft: offen > 0 })
  }
}

function planeSchreiben(teil: SyncTeilW): void {
  if (!aktiv()) return
  if (timer[teil]) clearTimeout(timer[teil])
  timer[teil] = setTimeout(() => void schreiben(teil), VERZOEGERUNG_MS)
}

async function holen(teil: SyncTeilW): Promise<void> {
  const fern = await anfrage<SyncStandW[typeof teil] | null>(`/api/sync/${teil}`)
  const stand = fern ? syncStandLesen(teil, fern) : null
  if (stand) {
    uebernehmen(teil, stand)
    zuletztText[teil] = syncStandText(teil, stand)
  } else {
    zuletztText[teil] = undefined
  }
  // Lokal gibt es mehr als der Worker kennt → gleich schreiben (der Worker mergt)
  if (syncStandText(teil, lokalerStand(teil)) !== zuletztText[teil]) await schreiben(teil)
}

/** Beide Teile holen und bei Bedarf schreiben. `erzwingen` ignoriert „schon geholt“. */
export async function abgleichen(erzwingen = false): Promise<void> {
  if (!aktiv()) {
    setze({ aktiv: false })
    return
  }
  const code = useAktienStore.getState().code.trim()
  if (!erzwingen && geholtFuer === code) return
  offen++
  setze({ aktiv: true, laeuft: true, fehler: null })
  try {
    geholtFuer = code
    for (const teil of TEILE) await holen(teil)
    zuletztGeholtAm = Date.now()
    setze({ fehler: null, letzterSync: Date.now() })
  } catch (e) {
    geholtFuer = ''
    setze({ fehler: fehlerText(e) })
  } finally {
    offen--
    setze({ laeuft: offen > 0 })
  }
}

/** Einmal beim App-Start: Stores beobachten, fernen Stand holen. Mehrfachaufrufe sind harmlos. */
export function workerSyncStarten(): void {
  if (gestartet) return
  gestartet = true

  useSimulatorStore.subscribe((s, v) => {
    if (s.tradeHistorie !== v.tradeHistorie || s.rueckblicke !== v.rueckblicke) planeSchreiben('journal')
  })
  useJournalStore.subscribe((s, v) => {
    if (s.eintraege !== v.eintraege) planeSchreiben('journal')
  })
  useProgressStore.subscribe((s, v) => {
    if (
      s.abgeschlosseneLektionen !== v.abgeschlosseneLektionen ||
      s.szenarioErgebnisse !== v.szenarioErgebnisse ||
      s.wiederholungen !== v.wiederholungen ||
      s.uebungsLog !== v.uebungsLog
    )
      planeSchreiben('fortschritt')
  })
  useAktienStore.subscribe((s, v) => {
    if (s.code !== v.code) {
      geholtFuer = ''
      for (const teil of TEILE) zuletztText[teil] = undefined
      void abgleichen()
    }
  })
  useSyncStore.subscribe((s, v) => {
    if (s.cloud !== v.cloud) {
      if (s.cloud) void abgleichen(true)
      else setze({ aktiv: false })
    }
  })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - zuletztGeholtAm > NACHHOLEN_MS) void abgleichen(true)
    })
  }
  void abgleichen()
}

export function useWorkerSyncStatus(): WorkerSyncStatus {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => status,
  )
}
