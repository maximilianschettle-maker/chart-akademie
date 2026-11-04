import { openDB, type IDBPDatabase } from 'idb'
import type { JournalEintrag, Snapshot } from './types'
import { ladeChart } from '../aktien/data/service'
import { workerKonfiguriert } from '../aktien/data/client'
import { bereichDef } from '../aktien/engine/chart'
import { bereichFuerZeitrahmen, kerzenUmEinstieg, SNAPSHOT_NACH, SNAPSHOT_VOR } from './engine'

// Kerzen rund um den Einstieg je Journal-Eintrag, gerätelokal in IndexedDB. Yahoo liefert
// 5-/15-Minuten-Kerzen nur für die letzten Tage, deshalb wird der Ausschnitt beim Speichern
// geholt und bleibt dann erhalten – auch wenn die Quelle ihn später nicht mehr hergibt.

const DB_NAME = 'chartakademie-journal'
const STORE = 'snapshots'

let dbPromise: Promise<IDBPDatabase> | null = null
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export async function snapshotLesen(eintragId: string): Promise<Snapshot | undefined> {
  try {
    return await (await getDb()).get(STORE, eintragId)
  } catch {
    return undefined
  }
}

export async function snapshotSchreiben(s: Snapshot): Promise<void> {
  try {
    await (await getDb()).put(STORE, s, s.eintragId)
  } catch {
    // gerätelokaler Komfort, nie fatal
  }
}

export async function snapshotEntfernen(eintragId: string): Promise<void> {
  try {
    await (await getDb()).delete(STORE, eintragId)
  } catch {
    // egal
  }
}

export type SnapshotErgebnis = { art: 'ok'; snapshot: Snapshot } | { art: 'kein-worker' } | { art: 'zu-alt' } | { art: 'fehler'; text: string }

/**
 * Holt den Ausschnitt über den Worker: erst im Zeitrahmen des Trades, wenn der Einstieg dafür zu
 * lange her ist mit Tageskerzen. Bei geschlossenen Trades reicht der Ausschnitt bis hinter den Ausstieg.
 */
export async function snapshotLaden(e: JournalEintrag): Promise<SnapshotErgebnis> {
  if (!workerKonfiguriert()) return { art: 'kein-worker' }
  const bereiche = [bereichFuerZeitrahmen(e.zeitrahmen), '6M' as const]
  try {
    for (const bereich of bereiche) {
      const daten = await ladeChart(e.symbol, bereich)
      const nachAusstieg = e.exitTime ? daten.kerzen.filter((k) => k.time > e.entryTime && k.time <= e.exitTime!).length + 20 : 0
      const ausschnitt = kerzenUmEinstieg(daten.kerzen, e.entryTime, SNAPSHOT_VOR, Math.max(SNAPSHOT_NACH, nachAusstieg))
      if (!ausschnitt) continue
      const snapshot: Snapshot = {
        eintragId: e.id,
        symbol: e.symbol,
        intervall: bereichDef(bereich)?.intervall ?? '1d',
        kerzen: ausschnitt,
        standAm: Date.now(),
      }
      await snapshotSchreiben(snapshot)
      return { art: 'ok', snapshot }
    }
    return { art: 'zu-alt' }
  } catch (err) {
    return { art: 'fehler', text: err instanceof Error ? err.message : String(err) }
  }
}
