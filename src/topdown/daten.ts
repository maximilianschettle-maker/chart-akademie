import type { Candle } from '../types'
import type { TrackerDaten } from '../tracker/types'
import { kerzenAusKompakt } from '../tracker/engine/analyse'
import { getCandles } from '../data/candleService'

// Kerzen-Archiv der Tracker-Action (public/data/archiv/<id>-1h.json, <id>-15m.json): Stundenkerzen
// bis 730 Tage zurück → Runden irgendwo im letzten Jahr statt nur in den letzten zwei Wochen,
// 15-Minuten-Kerzen für das Replay, sobald der Zeitpunkt im Archiv liegt.
const archivCache = new Map<string, Promise<Candle[] | null>>()

export function archivLaden(id: string, ebene: '15m' | '1h'): Promise<Candle[] | null> {
  const key = `${id}-${ebene}`
  let p = archivCache.get(key)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/archiv/${key}.json`, { cache: 'no-cache' })
      .then(async (res) => {
        if (!res.ok) return null
        const roh: unknown = await res.json()
        return Array.isArray(roh) ? kerzenAusKompakt(roh as number[][]) : null
      })
      .catch(() => null)
    archivCache.set(key, p)
  }
  return p
}

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
  /** Tracker: Stundenkerzen nach T (für das Replay, wenn es keine 15-Minuten-Kerzen gibt) */
  stundeNach?: Candle[]
  /** Tracker: Instrument-Id für das Archiv */
  instrumentId?: string
}

export interface ReplayDaten {
  kerzen: Candle[]
  /** Index der ersten Kerze nach T (hier startet das Replay) */
  startIndex: number
  intervall: '15m' | '1h'
}

const REPLAY_KONTEXT = 120
const REPLAY_LAENGE = 200

const KRYPTO = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', ab: Date.UTC(2021, 0, 1) / 1000 },
  { symbol: 'ETHUSDT', name: 'Ethereum', ab: Date.UTC(2021, 0, 1) / 1000 },
  { symbol: 'SOLUSDT', name: 'Solana', ab: Date.UTC(2022, 0, 1) / 1000 },
]
const TRACKER_INSTRUMENTE = ['nasdaq100', 'gold', 'oel', 'sp500', 'dax', 'eurusd']
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

/** Mindestens so viele Tageskerzen vor T und so viele Stundenkerzen nach T (fürs Replay) */
const MIN_TAGE_VOR = 100
const MIN_STUNDEN_NACH = 30

/**
 * Runde aus Tages- und Stundenkerzen eines Instruments (rein): T zufällig so, dass genug Tageskerzen
 * davor und genug Stundenkerzen danach liegen. null, wenn die Spanne nicht reicht.
 */
export function rundeAusKerzen(
  inst: { name: string; symbol: string; waehrung: string },
  tagAlle: Candle[],
  stundeAlle: Candle[],
  zufall: () => number = Math.random,
): Runde | null {
  if (tagAlle.length < MIN_TAGE_VOR + 1 || stundeAlle.length < MIN_STUNDEN + MIN_STUNDEN_NACH) return null
  const fruehestens = tagAlle[MIN_TAGE_VOR].time
  const erlaubt = stundeAlle.map((_, i) => i).filter((i) => i >= MIN_STUNDEN - 1 && i <= stundeAlle.length - 1 - MIN_STUNDEN_NACH && stundeAlle[i].time >= fruehestens)
  if (erlaubt.length === 0) return null
  const endeIndex = waehleZufall(erlaubt, zufall)
  const endeZeit = stundeAlle[endeIndex].time
  const stunde = stundeAlle.slice(0, endeIndex + 1).slice(-STUNDEN_VORLAUF)
  const stundeNach = stundeAlle.slice(endeIndex + 1)
  const tag = tagAlle.filter((k) => k.time <= endeZeit).slice(-TAGE_VORLAUF)
  return { quelle: 'tracker', instrumentName: inst.name, symbol: inst.symbol, waehrung: inst.waehrung, endeZeit, tag, stunde, stundeNach }
}

/** Runde aus Tracker-Daten; Stundenkerzen aus dem Archiv (730 Tage), sonst die 400 aus tracker.json */
export async function rundeAusTracker(daten: TrackerDaten, zufall: () => number = Math.random): Promise<Runde | null> {
  const kandidaten = trackerKandidaten(daten)
  if (kandidaten.length === 0) return null
  const inst = waehleZufall(kandidaten, zufall)
  const archiv = await archivLaden(inst.id, '1h')
  const stundeAlle = archiv && archiv.length > 600 ? archiv : kerzenAusKompakt(inst.stunde!.kerzen)
  const tagAlle = kerzenAusKompakt(inst.kerzen)
  const r = rundeAusKerzen(inst, tagAlle, stundeAlle, zufall)
  return r ? { ...r, instrumentId: inst.id } : null
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
    const r = tracker ? await rundeAusTracker(tracker, zufall) : null
    if (r) return r
    return rundeAusBinance(zufall)
  }
  try {
    return await rundeAusBinance(zufall)
  } catch (e) {
    const r = tracker ? await rundeAusTracker(tracker, zufall) : null
    if (r) return r
    throw e
  }
}

/**
 * Kerzen für das Replay: Krypto 15 Minuten über Binance (Kontext vor T + 200 Kerzen danach),
 * Tracker-Instrumente die Stundenkerzen (vor und nach T), weil es dort keine 15-Minuten-Historie gibt.
 */
export async function ladeReplay(r: Runde): Promise<ReplayDaten> {
  if (r.quelle === 'binance') {
    const kerzen = await getCandles(r.symbol, '15m', r.endeZeit - REPLAY_KONTEXT * 900, r.endeZeit + REPLAY_LAENGE * 900)
    const startIndex = kerzen.findIndex((k) => k.time > r.endeZeit)
    if (startIndex < 20 || kerzen.length - startIndex < 30) throw new Error('Zu wenige 15-Minuten-Kerzen für das Replay')
    return { kerzen, startIndex, intervall: '15m' }
  }
  // 15-Minuten-Kerzen aus dem Archiv, wenn der Zeitpunkt darin liegt
  if (r.instrumentId) {
    const archiv = await archivLaden(r.instrumentId, '15m')
    if (archiv) {
      const kontext = archiv.filter((k) => k.time <= r.endeZeit).slice(-REPLAY_KONTEXT)
      const danach = archiv.filter((k) => k.time > r.endeZeit).slice(0, REPLAY_LAENGE)
      if (kontext.length >= 40 && danach.length >= 20) return { kerzen: [...kontext, ...danach], startIndex: kontext.length, intervall: '15m' }
    }
  }
  const vor = r.stunde.slice(-REPLAY_KONTEXT)
  const nach = (r.stundeNach ?? []).slice(0, REPLAY_LAENGE)
  if (nach.length < 20) throw new Error('Zu wenige Stundenkerzen nach dem Zeitpunkt für das Replay')
  return { kerzen: [...vor, ...nach], startIndex: vor.length, intervall: '1h' }
}
