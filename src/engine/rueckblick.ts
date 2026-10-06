import type { Candle, Trade } from '../types'
import { erkenneImFenster, typischeSpanne, type ErkanntesSetup } from './setupErkennung'
import { logischeTrades, type LogischerTrade } from './auswertung'
import { letzterAtr } from './indikatoren/atr'

// Setup-Rückblick nach einer Simulator-Sitzung: Welche Setups aus Level 4 hat
// der gespielte Abschnitt angeboten — und welche davon wurden gehandelt, welche
// verpasst? Jedes Setup wird mit einem festen, nachvollziehbaren Trade bewertet:
// Einstieg zum Schlusskurs der Signalkerze, Stop und Ziel aus der Erkennung.
// Ausgewertet wird nur bis zur letzten gespielten Kerze (kein Blick dahinter).

export interface IdealErgebnis {
  /** tp/sl: Ziel bzw. Stop erreicht · offen: bis zum Sitzungsende weder noch */
  art: 'tp' | 'sl' | 'offen'
  /** Ergebnis in R (ohne Gebühren); bei „offen“ der Buchstand zum Sitzungsende */
  r: number
  exitIndex: number
}

export type FundStatus = 'gehandelt' | 'verpasst' | 'belegt'

export interface SetupFund {
  id: string
  setup: ErkanntesSetup
  /** Regelkonformer Einstieg: Schlusskurs der Signalkerze */
  entry: number
  stopLoss: number
  takeProfit: number
  crv: number
  ergebnis: IdealErgebnis
  /** belegt: Zum Signal lief bereits ein anderer Trade — kein echtes Versäumnis */
  status: FundStatus
  eigenerTrade?: LogischerTrade
}

const MIN_CRV = 1
const MIN_ABSTAND = 15 // Kerzen zwischen zwei Setups derselben Richtung
const IMPULS = 3.5 // Vielfaches der typischen Kerzenspanne
const MIN_STOP_ATR = 1 // Stop mindestens so viele ATR vom Einstieg entfernt
const DOCHT_PUFFER_ATR = 0.25 // Abstand des Stops zum Extrem der Signalkerze

/**
 * Signalkerze ist ein Impuls GEGEN die Handelsrichtung (z.B. Absturz in eine
 * Unterstützung)? Dann wäre der Einstieg zum Schlusskurs ein Griff ins fallende
 * Messer — so ein Signal gilt im Rückblick nicht als handelbares Setup.
 */
export function istGegenImpuls(c: Candle[], s: ErkanntesSetup): boolean {
  const bar = c[s.signalIndex]
  const koerper = (bar.close - bar.open) / bar.close
  const gegen = s.richtung === 'long' ? -koerper : koerper
  return gegen > IMPULS * typischeSpanne(c, s.signalIndex - 1)
}

/** Der regelkonforme Trade eines Setups — null, wenn er sich zum Signal-Schlusskurs nicht lohnt. */
export function bewerteIdeal(
  c: Candle[],
  setup: ErkanntesSetup,
  bisIndex: number,
): Pick<SetupFund, 'entry' | 'stopLoss' | 'takeProfit' | 'crv' | 'ergebnis'> | null {
  const long = setup.richtung === 'long'
  const signal = c[setup.signalIndex]
  const entry = signal.close
  const takeProfit = setup.idealTakeProfit
  const chance = long ? takeProfit - entry : entry - takeProfit
  if (chance <= 0 || (long ? setup.idealStopLoss >= entry : setup.idealStopLoss <= entry)) return null

  // Der Stop der Erkennung hängt am Level, nicht an der Kerze. Zum Schlusskurs der
  // Signalkerze kann er dadurch unsinnig eng sein (oder ihr Docht hat ihn schon
  // durchstoßen) — so ein Trade stoppt sich im normalen Rauschen selbst aus.
  // Deshalb: mindestens 1 ATR Abstand und immer jenseits des Signalkerzen-Extrems.
  const atr = letzterAtr(c, setup.signalIndex)
  const stopLoss = long
    ? Math.min(setup.idealStopLoss, entry - MIN_STOP_ATR * atr, signal.low - DOCHT_PUFFER_ATR * atr)
    : Math.max(setup.idealStopLoss, entry + MIN_STOP_ATR * atr, signal.high + DOCHT_PUFFER_ATR * atr)
  const risiko = long ? entry - stopLoss : stopLoss - entry
  if (risiko <= 0) return null
  const crv = chance / risiko
  if (crv < MIN_CRV) return null

  const ende = Math.min(bisIndex, c.length - 1)
  for (let j = setup.signalIndex + 1; j <= ende; j++) {
    const bar = c[j]
    // SL-zuerst-Regel wie im Broker
    if (long ? bar.low <= stopLoss : bar.high >= stopLoss) {
      return { entry, stopLoss, takeProfit, crv, ergebnis: { art: 'sl', r: -1, exitIndex: j } }
    }
    if (long ? bar.high >= takeProfit : bar.low <= takeProfit) {
      return { entry, stopLoss, takeProfit, crv, ergebnis: { art: 'tp', r: crv, exitIndex: j } }
    }
  }
  const letzter = c[ende].close
  const r = (long ? letzter - entry : entry - letzter) / risiko
  return { entry, stopLoss, takeProfit, crv, ergebnis: { art: 'offen', r, exitIndex: ende } }
}

/**
 * Sucht Setups an den Signal-Indizes [von, bis] und hängt sie an `gefunden` an.
 * Dicht aufeinanderfolgende Treffer derselben Idee werden zusammengefasst:
 * gleiche Richtung innerhalb von 15 Kerzen oder dasselbe Setup im noch offenen
 * Entry-Fenster zählt nicht doppelt.
 */
export function sucheBereich(c: Candle[], von: number, bis: number, gefunden: ErkanntesSetup[]): void {
  for (let i = Math.max(150, von); i <= Math.min(bis, c.length - 1); i++) {
    const s = erkenneImFenster(c, i)
    if (!s || istGegenImpuls(c, s)) continue
    const doppelt = gefunden.some(
      (g) =>
        g.richtung === s.richtung &&
        (i - g.signalIndex < MIN_ABSTAND || (g.strategieId === s.strategieId && i <= g.entryZone.barBis)),
    )
    if (!doppelt) gefunden.push(s)
  }
}

/**
 * Wie sucheBereich, gibt aber zwischendurch den Thread frei — die Suche über
 * eine lange Sitzung soll die Oberfläche nicht einfrieren.
 */
export async function sucheSetups(
  c: Candle[],
  von: number,
  bis: number,
  optionen: { onFortschritt?: (anteil: number) => void; abgebrochen?: () => boolean } = {},
): Promise<ErkanntesSetup[]> {
  const gefunden: ErkanntesSetup[] = []
  const start = Math.max(150, von)
  const SCHRITT = 60
  for (let i = start; i <= bis; i += SCHRITT) {
    if (optionen.abgebrochen?.()) return gefunden
    sucheBereich(c, i, Math.min(bis, i + SCHRITT - 1), gefunden)
    optionen.onFortschritt?.(Math.min(1, (i + SCHRITT - start) / Math.max(1, bis - start + 1)))
    await new Promise((r) => setTimeout(r, 0))
  }
  return gefunden
}

/** Index der Kerze mit dieser Zeit (oder der letzten davor). */
function indexZuZeit(c: Candle[], zeit: number): number {
  let lo = 0
  let hi = c.length - 1
  while (lo < hi) {
    const mitte = (lo + hi + 1) >> 1
    if (c[mitte].time <= zeit) lo = mitte
    else hi = mitte - 1
  }
  return lo
}

/** Setups bewerten und den eigenen Trades gegenüberstellen. */
export function rueckblick(c: Candle[], setups: ErkanntesSetup[], trades: Trade[], bisIndex: number): SetupFund[] {
  const eigene = logischeTrades(trades).map((t) => ({
    trade: t,
    von: indexZuZeit(c, t.entryTime),
    bis: indexZuZeit(c, t.exitTime),
  }))
  const funde: SetupFund[] = []
  for (const setup of setups) {
    const ideal = bewerteIdeal(c, setup, bisIndex)
    if (!ideal) continue
    const i = setup.signalIndex
    // Gehandelt: eigener Einstieg in dieselbe Richtung zwischen Signal und Ende des Entry-Fensters
    const treffer = eigene.find(
      (e) => e.trade.richtung === setup.richtung && e.von >= i - 1 && e.von <= setup.entryZone.barBis,
    )
    const imTrade = eigene.some((e) => e.von < i - 1 && e.bis > i)
    funde.push({
      id: `${setup.strategieId}-${setup.richtung}-${i}`,
      setup,
      ...ideal,
      status: treffer ? 'gehandelt' : imTrade ? 'belegt' : 'verpasst',
      eigenerTrade: treffer?.trade,
    })
  }
  return funde.sort((a, b) => a.setup.signalIndex - b.setup.signalIndex)
}

export interface RueckblickSumme {
  gesamt: number
  gehandelt: number
  verpasst: number
  belegt: number
  /** Nur verpasste Setups, deren Trade bis zum Sitzungsende entschieden war */
  verpassteGewinner: number
  verpassteVerlierer: number
  verpassteOffen: number
  /** Summe R der entschiedenen verpassten Setups (ohne Gebühren) */
  verpassteR: number
}

export function rueckblickSumme(funde: SetupFund[]): RueckblickSumme {
  const verpasst = funde.filter((f) => f.status === 'verpasst')
  const entschieden = verpasst.filter((f) => f.ergebnis.art !== 'offen')
  return {
    gesamt: funde.length,
    gehandelt: funde.filter((f) => f.status === 'gehandelt').length,
    verpasst: verpasst.length,
    belegt: funde.filter((f) => f.status === 'belegt').length,
    verpassteGewinner: entschieden.filter((f) => f.ergebnis.art === 'tp').length,
    verpassteVerlierer: entschieden.filter((f) => f.ergebnis.art === 'sl').length,
    verpassteOffen: verpasst.length - entschieden.length,
    verpassteR: entschieden.reduce((s, f) => s + f.ergebnis.r, 0),
  }
}
