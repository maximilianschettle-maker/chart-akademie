import { openDB, type IDBPDatabase } from 'idb'
import type { Candle } from '../types'

// Historische Kerzen ändern sich nicht — deshalb Cache ohne TTL.
// Key = symbol:interval:von:bis (die Lektionen fragen feste Bereiche ab).

const DB_NAME = 'chartakademie'
const STORE = 'candles'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export function cacheKey(symbol: string, interval: string, von: number, bis: number) {
  return `${symbol}:${interval}:${von}:${bis}`
}

export async function ausCache(key: string): Promise<Candle[] | undefined> {
  try {
    const db = await getDb()
    return await db.get(STORE, key)
  } catch {
    return undefined // IndexedDB nicht verfügbar → einfach ohne Cache arbeiten
  }
}

export async function inCache(key: string, candles: Candle[]): Promise<void> {
  try {
    const db = await getDb()
    await db.put(STORE, candles, key)
  } catch {
    // Cache-Fehler sind nie fatal
  }
}
