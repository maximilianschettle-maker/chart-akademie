import type { Candle, CandleDatensatz } from '../types'
import { getCandles } from './candleService'
import { REPLAY_FALLBACKS } from './zufall'

// Simulator-Sitzung: frei wählbarer oder zufälliger Startpunkt, Kerzen werden in
// festen Blöcken nachgeladen — das Replay läuft so lange, wie es Daten gibt.
// Blöcke haben feste Grenzen relativ zum Start, damit der IndexedDB-Cache beim
// Fortsetzen einer Sitzung trifft.

export interface SymbolDef {
  id: string
  name: string
  /** Ab hier sind die Daten auf Binance durchgehend brauchbar (Unix-Sekunden) */
  ab: number
}

const jahr = (j: number) => Date.UTC(j, 0, 1) / 1000

export const SYMBOLE: SymbolDef[] = [
  { id: 'BTCUSDT', name: 'Bitcoin', ab: jahr(2018) },
  { id: 'ETHUSDT', name: 'Ethereum', ab: jahr(2018) },
  { id: 'SOLUSDT', name: 'Solana', ab: jahr(2021) },
  { id: 'BNBUSDT', name: 'BNB', ab: jahr(2018) },
  { id: 'XRPUSDT', name: 'XRP', ab: jahr(2019) },
  { id: 'DOGEUSDT', name: 'Dogecoin', ab: jahr(2020) },
  { id: 'ADAUSDT', name: 'Cardano', ab: jahr(2019) },
  { id: 'LINKUSDT', name: 'Chainlink', ab: jahr(2020) },
  { id: 'AVAXUSDT', name: 'Avalanche', ab: jahr(2021) },
]

export interface IntervallDef {
  id: string
  label: string
  sek: number
}

export const INTERVALLE: IntervallDef[] = [
  { id: '5m', label: '5m', sek: 300 },
  { id: '15m', label: '15m', sek: 900 },
  { id: '1h', label: '1h', sek: 3600 },
  { id: '4h', label: '4h', sek: 14400 },
  { id: '1d', label: '1D', sek: 86400 },
]

/** Anzeige-Timeframes ab dem Basis-Intervall aufwärts (inkl. Woche). */
export function anzeigeTimeframes(interval: string): { label: string; sek: number }[] {
  const leiter = [...INTERVALLE.map((i) => ({ label: i.label, sek: i.sek })), { label: '1W', sek: 604800 }]
  const basis = intervallSek(interval)
  return leiter.filter((t) => t.sek >= basis)
}

export function intervallSek(interval: string): number {
  return INTERVALLE.find((i) => i.id === interval)?.sek ?? 3600
}

export function symbolName(id: string): string {
  return SYMBOLE.find((s) => s.id === id)?.name ?? id
}

export const BLOCK = 1000 // Kerzen je Nachlade-Block (= ein API-Request)
export const KONTEXT_BLOECKE = 1 // sichtbare Vorgeschichte vor dem Start

export interface SitzungConfig {
  id: string
  symbol: string
  interval: string
  /** Zeit der ersten Replay-Kerze (Unix-Sekunden, aufs Intervall gerundet) */
  startZeit: number
  /** Symbol und Datum verdeckt bis zum Sitzungsende */
  blind: boolean
  anzeigeName: string
  /** Eingebauter Offline-Abschnitt statt Live-Daten */
  offlineDatei?: string
}

function zufall<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)]
}

function blindName(): string {
  return `Asset ${zufall(['A', 'B', 'C', 'D', 'E', 'F'])}`
}

export function neueSitzung(wahl: {
  symbol: string | 'zufall'
  interval: string | 'zufall'
  /** Unix-Sekunden oder 'zufall' */
  start: number | 'zufall'
  blind: boolean
}): SitzungConfig {
  const symbol = wahl.symbol === 'zufall' ? zufall(SYMBOLE.slice(0, 3)).id : wahl.symbol
  const interval = wahl.interval === 'zufall' ? zufall(['15m', '1h', '4h']) : wahl.interval
  const sek = intervallSek(interval)
  const jetzt = Math.floor(Date.now() / 1000)
  const ab = SYMBOLE.find((s) => s.id === symbol)?.ab ?? jahr(2021)
  const fruehestens = ab + KONTEXT_BLOECKE * BLOCK * sek
  // mindestens ein halber Block Replay muss vor „heute“ liegen
  const spaetestens = jetzt - (BLOCK / 2) * sek

  let start =
    wahl.start === 'zufall'
      ? fruehestens + Math.random() * Math.max(0, spaetestens - fruehestens)
      : wahl.start
  start = Math.min(Math.max(start, fruehestens), Math.max(fruehestens, spaetestens))
  const startZeit = Math.floor(start / sek) * sek

  return {
    id: `${symbol}-${startZeit}-${interval}-${jetzt.toString(36)}`,
    symbol,
    interval,
    startZeit,
    blind: wahl.blind,
    anzeigeName: wahl.blind ? blindName() : symbolName(symbol),
  }
}

/** Frühestes wählbares Startdatum (inkl. Vorgeschichte) für die Datumsauswahl. */
export function fruehesterStart(symbol: string, interval: string): number {
  const ab = SYMBOLE.find((s) => s.id === symbol)?.ab ?? jahr(2021)
  return ab + KONTEXT_BLOECKE * BLOCK * intervallSek(interval)
}

export interface BlockErgebnis {
  candles: Candle[]
  /** false: Dieser Block reicht bis „jetzt“ — danach gibt es nichts mehr */
  hatMehr: boolean
}

/**
 * Lädt Block k der Sitzung (k = −KONTEXT_BLOECKE … ∞). Block 0 beginnt bei startZeit.
 * Grenzen sind deterministisch → der Kerzen-Cache trifft beim Fortsetzen.
 */
export async function ladeBlock(config: SitzungConfig, k: number): Promise<BlockErgebnis> {
  const sek = intervallSek(config.interval)
  const von = config.startZeit + k * BLOCK * sek
  const bis = von + BLOCK * sek - 1
  const jetzt = Math.floor(Date.now() / 1000)
  if (von > jetzt) return { candles: [], hatMehr: false }
  const candles = await getCandles(config.symbol, config.interval, von, bis)
  // Die gerade laufende (unfertige) Kerze nicht ins Replay nehmen
  const fertig = candles.filter((c) => c.time >= von && c.time <= bis && c.time + sek <= jetzt)
  return { candles: fertig, hatMehr: bis < jetzt }
}

export interface SitzungDaten {
  candles: Candle[]
  /** Index der ersten Replay-Kerze (davor: Vorgeschichte) */
  startIndex: number
  /** Nächster nachzuladender Block; null = Ende der Daten */
  naechsterBlock: number | null
}

/** Vorgeschichte + so viele Blöcke, dass `bisZeit` (z.B. der gespeicherte Cursor) abgedeckt ist. */
export async function ladeSitzung(config: SitzungConfig, bisZeit?: number): Promise<SitzungDaten> {
  if (config.offlineDatei) return ladeOffline(config.offlineDatei)

  const sek = intervallSek(config.interval)
  const ziel = bisZeit ?? config.startZeit
  const letzterNoetig = Math.max(0, Math.floor((ziel - config.startZeit) / (BLOCK * sek)))
  const nummern: number[] = []
  for (let k = -KONTEXT_BLOECKE; k <= letzterNoetig; k++) nummern.push(k)
  const bloecke = await Promise.all(nummern.map((k) => ladeBlock(config, k)))

  const candles = bloecke.flatMap((b) => b.candles)
  const startIndex = candles.findIndex((c) => c.time >= config.startZeit)
  if (startIndex < 50 || candles.length - startIndex < 20) {
    throw new Error('Zu wenige Kerzen im gewählten Zeitraum')
  }
  const letzter = bloecke[bloecke.length - 1]
  return { candles, startIndex, naechsterBlock: letzter.hatMehr ? letzterNoetig + 1 : null }
}

async function ladeOffline(datei: string): Promise<SitzungDaten> {
  const res = await fetch(`${import.meta.env.BASE_URL}replay/${datei}.json`)
  if (!res.ok) throw new Error(`Offline-Abschnitt ${datei} fehlt`)
  const daten = (await res.json()) as CandleDatensatz
  return {
    candles: daten.candles,
    startIndex: Math.min(500, Math.floor(daten.candles.length * 0.6)),
    naechsterBlock: null,
  }
}

/** Sitzung aus dem eingebauten Offline-Vorrat (wenn die Kursdaten-APIs nicht erreichbar sind). */
export function offlineSitzung(): SitzungConfig {
  const datei = zufall(REPLAY_FALLBACKS)
  // Dateiname: replay-<symbol>-<interval>-<jahr>
  const [, sym, interval] = datei.split('-')
  const symbol = `${sym.toUpperCase()}USDT`
  return {
    id: `${datei}-${Date.now().toString(36)}`,
    symbol,
    interval,
    startZeit: 0,
    blind: true,
    anzeigeName: blindName(),
    offlineDatei: datei,
  }
}
