import type { Candle } from '../types'
import type { TrackerDaten } from '../tracker/types'
import { kerzenAusKompakt } from '../tracker/engine/analyse'
import { getCandles } from '../data/candleService'

// Daten einer Top-Down-Runde: Tageskerzen bis zu einem Zeitpunkt T und Stundenkerzen bis zu
// demselben T. Krypto über Binance (beliebig weit zurück, jede Runde anders), Nasdaq/Gold/Öl aus
// den Tracker-Daten (Stundenkerzen nur für die letzten ~400 Stunden → T liegt in dieser Spanne).

export interface Runde {
  quelle: 'binance' | 'tracker'
  instrumentName: string
  symbol: string
  waehrung: string
  /** Zeitpunkt T (Unix-Sekunden), bis zu dem beide Ebenen reichen */
  endeZeit: number
  tag: Candle[]
  stunde: Candle[]
}

const KRYPTO = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', ab: Date.UTC(2021, 0, 1) / 1000 },
  { symbol: 'ETHUSDT', name: 'Ethereum', ab: Date.UTC(2021, 0, 1) / 1000 },
  { symbol: 'SOLUSDT', name: 'Solana', ab: Date.UTC(2022, 0, 1) / 1000 },
]
const TRACKER_INSTRUMENTE = ['nasdaq100', 'gold', 'oel', 'sp500', 'dax']
const TAGE_VORLAUF = 300
const STUNDEN_VORLAUF = 400
const MIN_STUNDEN = 150

export function waehleZufall<T>(liste: T[], zufall: () => number = Math.random): T {
  return liste[Math.min(liste.length - 1, Math.floor(zufall() * liste.length))]
}

/** Tracker-Instrumente, die genug Stundenkerzen haben */
export function trackerKandidaten(daten: TrackerDaten | null): TrackerDaten['instrumente'] {
  if (!daten) return []
  return daten.instrumente.filter((i) => TRACKER_INSTRUMENTE.includes(i.id) && (i.stunde?.kerzen.length ?? 0) >= MIN_STUNDEN && i.kerzen.length >= 100)
}

/** Runde aus Tracker-Daten: T zufällig in der zweiten Hälfte der Stundenkerzen */
export function rundeAusTracker(daten: TrackerDaten, zufall: () => number = Math.random): Runde | null {
  const kandidaten = trackerKandidaten(daten)
  if (kandidaten.length === 0) return null
  const inst = waehleZufall(kandidaten, zufall)
  const stundeAlle = kerzenAusKompakt(inst.stunde!.kerzen)
  const tagAlle = kerzenAusKompakt(inst.kerzen)
  const von = Math.floor(stundeAlle.length / 2)
  const endeIndex = von + Math.floor(zufall() * (stundeAlle.length - von))
  const endeZeit = stundeAlle[endeIndex].time
  const stunde = stundeAlle.slice(0, endeIndex + 1).slice(-STUNDEN_VORLAUF)
  const tag = tagAlle.filter((k) => k.time <= endeZeit).slice(-TAGE_VORLAUF)
  return { quelle: 'tracker', instrumentName: inst.name, symbol: inst.symbol, waehrung: inst.waehrung, endeZeit, tag, stunde }
}

/** Runde über Binance: zufälliger Zeitpunkt zwischen Start des Instruments und vor einer Woche */
export async function rundeAusBinance(zufall: () => number = Math.random): Promise<Runde> {
  const k = waehleZufall(KRYPTO, zufall)
  const jetzt = Math.floor(Date.now() / 1000)
  const spaetestens = jetzt - 7 * 86_400
  const endeZeit = Math.floor((k.ab + TAGE_VORLAUF * 86_400 + zufall() * (spaetestens - k.ab - TAGE_VORLAUF * 86_400)) / 3600) * 3600
  const [tag, stunde] = await Promise.all([
    getCandles(k.symbol, '1d', endeZeit - TAGE_VORLAUF * 86_400, endeZeit),
    getCandles(k.symbol, '1h', endeZeit - STUNDEN_VORLAUF * 3600, endeZeit),
  ])
  if (tag.length < 100 || stunde.length < MIN_STUNDEN) throw new Error('Zu wenige Kerzen von Binance')
  return { quelle: 'binance', instrumentName: k.name, symbol: k.symbol, waehrung: 'USDT', endeZeit, tag: tag.filter((c) => c.time <= endeZeit), stunde: stunde.filter((c) => c.time <= endeZeit) }
}

/** Neue Runde: Tracker und Binance im Wechsel, Fallback jeweils auf die andere Quelle */
export async function neueRunde(tracker: TrackerDaten | null, zufall: () => number = Math.random): Promise<Runde> {
  const erstTracker = zufall() < 0.5
  if (erstTracker) {
    const r = rundeAusTracker(tracker ?? { instrumente: [] } as unknown as TrackerDaten, zufall)
    if (r) return r
    return rundeAusBinance(zufall)
  }
  try {
    return await rundeAusBinance(zufall)
  } catch (e) {
    const r = tracker ? rundeAusTracker(tracker, zufall) : null
    if (r) return r
    throw e
  }
}
