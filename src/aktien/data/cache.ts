import { openDB, type IDBPDatabase } from 'idb'
import type { Fundamentaldaten, Kurs, KursChart } from '../types'

// Eigene IndexedDB für den Aktien-Bereich (die Kerzen-DB bleibt unangetastet).
// Einträge tragen ihren Zeitstempel; die Frische prüft der Aufrufer. Fehler sind nie fatal.

const DB_NAME = 'chartakademie-aktien'
const FIRMEN = 'firmen'
const KURSE = 'kurse'
const CHARTS = 'charts'

interface Eintrag<T> {
  standAm: number
  daten: T
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db) {
        for (const store of [FIRMEN, KURSE, CHARTS]) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
        }
      },
    })
  }
  return dbPromise
}

async function lesen<T>(store: string, key: string): Promise<Eintrag<T> | undefined> {
  try {
    return await (await getDb()).get(store, key)
  } catch {
    return undefined
  }
}

async function schreiben<T>(store: string, key: string, daten: T): Promise<void> {
  try {
    await (await getDb()).put(store, { standAm: Date.now(), daten } satisfies Eintrag<T>, key)
  } catch {
    // Cache-Fehler sind nie fatal
  }
}

export const firmenCache = {
  lesen: (symbol: string) => lesen<Fundamentaldaten>(FIRMEN, symbol),
  schreiben: (symbol: string, daten: Fundamentaldaten) => schreiben(FIRMEN, symbol, daten),
  async entfernen(symbol: string) {
    try {
      await (await getDb()).delete(FIRMEN, symbol)
    } catch {
      // egal
    }
  },
}

export const kursCache = {
  lesen: (symbol: string) => lesen<Kurs>(KURSE, symbol),
  schreiben: (symbol: string, daten: Kurs) => schreiben(KURSE, symbol, daten),
}

/** Kursverläufe, Schlüssel `SYMBOL:BEREICH`; die Frische prüft der Aufrufer je Bereich. */
export const chartCache = {
  lesen: (key: string) => lesen<KursChart>(CHARTS, key),
  schreiben: (key: string, daten: KursChart) => schreiben(CHARTS, key, daten),
}
