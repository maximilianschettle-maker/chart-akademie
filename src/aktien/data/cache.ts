import { openDB, type IDBPDatabase } from 'idb'
import type { Fundamentaldaten, Kurs, KursChart, Wechselkurs } from '../types'

// Eigene IndexedDB für den Aktien-Bereich (die Kerzen-DB bleibt unangetastet).
// Einträge tragen ihren Zeitstempel; die Frische prüft der Aufrufer. Fehler sind nie fatal.

const DB_NAME = 'chartakademie-aktien'
const FIRMEN = 'firmen'
const KURSE = 'kurse'
const CHARTS = 'charts'
const WECHSELKURSE = 'wechselkurse'

interface Eintrag<T> {
  standAm: number
  daten: T
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 3, {
      upgrade(db) {
        for (const store of [FIRMEN, KURSE, CHARTS, WECHSELKURSE]) {
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

/** Wechselkurse je Paarcode ('HKDCNY'); Frische 1 h prüft der Aufrufer. */
export const wechselkursCache = {
  lesen: (paar: string) => lesen<Wechselkurs>(WECHSELKURSE, paar),
  schreiben: (paar: string, daten: Wechselkurs) => schreiben(WECHSELKURSE, paar, daten),
}
