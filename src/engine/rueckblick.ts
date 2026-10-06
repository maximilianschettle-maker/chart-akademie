import type { Candle, Richtung, Trade } from '../types'
import { erkenneImFenster, typischeSpanne, type ErkanntesSetup } from './setupErkennung'
import { logischeTrades, type LogischerTrade } from './auswertung'
import { letzterAtr } from './indikatoren/atr'
import { ema } from './indikatoren/ema'

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
  /** Handelsrichtung = Richtung des übergeordneten Trends (Kurs über/unter der EMA 200)? null: zu wenig Vorgeschichte */
  mitTrend: boolean | null
  /** 1–5: wie lehrbuchmäßig das Setup zu erkennen war — KEINE Gewinnwahrscheinlichkeit */
  deutlichkeit: number
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

/**
 * Deutlichkeit eines Setups (1–5): Wie klar stand es im Chart? Zählt, wie oft das
 * Level bestätigt war, ob der übergeordnete Trend dieselbe Richtung hatte und ob
 * Stop und Ziel ein ordentliches Verhältnis ergaben. Bewusst KEIN Erfolgsmaß — an
 * echten Daten sagen diese Merkmale den Ausgang nicht vorher. Sie sagen nur, wie
 * gut man das Setup hätte sehen können.
 */
export function deutlichkeit(setup: ErkanntesSetup, mitTrend: boolean | null, crv: number): number {
  let punkte = 1
  if (setup.staerke === undefined) punkte += 1 // Trend-Setup: die EMA-Lage ist objektiv ablesbar
  else if (setup.staerke >= 4) punkte += 2
  else if (setup.staerke >= 3) punkte += 1
  if (mitTrend) punkte += 1
  if (crv >= 1.5) punkte += 1
  return Math.min(5, punkte)
}

/** Passt ein eigener Einstieg (Kerzen-Index) zu diesem Setup? */
function passtZu(setup: ErkanntesSetup, richtung: Richtung, entryIndex: number): boolean {
  return (
    richtung === setup.richtung && entryIndex >= setup.signalIndex - 1 && entryIndex <= setup.entryZone.barBis
  )
}

/**
 * Setups bewerten und den eigenen Trades gegenüberstellen.
 * `abIndex`: Nur Signale ab dieser Kerze gelten als Angebot der Sitzung (die Suche
 * darf etwas früher beginnen, damit frühe eigene Trades ihr Setup finden).
 */
export function rueckblick(
  c: Candle[],
  setups: ErkanntesSetup[],
  trades: Trade[],
  bisIndex: number,
  abIndex = 0,
): SetupFund[] {
  const eigene = logischeTrades(trades).map((t) => ({
    trade: t,
    von: indexZuZeit(c, t.entryTime),
    bis: indexZuZeit(c, t.exitTime),
  }))
  const e200 = ema(c, 200)
  const funde: SetupFund[] = []
  for (const setup of setups) {
    if (setup.signalIndex < abIndex) continue
    const ideal = bewerteIdeal(c, setup, bisIndex)
    if (!ideal) continue
    const i = setup.signalIndex
    const trend = e200[i]
    const mitTrend = Number.isFinite(trend)
      ? setup.richtung === 'long'
        ? c[i].close > trend
        : c[i].close < trend
      : null
    // Gehandelt: eigener Einstieg in dieselbe Richtung zwischen Signal und Ende des Entry-Fensters
    const treffer = eigene.find((e) => passtZu(setup, e.trade.richtung, e.von))
    const imTrade = eigene.some((e) => e.von < i - 1 && e.bis > i)
    funde.push({
      id: `${setup.strategieId}-${setup.richtung}-${i}`,
      setup,
      ...ideal,
      status: treffer ? 'gehandelt' : imTrade ? 'belegt' : 'verpasst',
      eigenerTrade: treffer?.trade,
      mitTrend,
      deutlichkeit: deutlichkeit(setup, mitTrend, ideal.crv),
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

// ── Eigene Trades gegenprüfen ────────────────────────────────────────────────

export interface TradeAbgleich {
  trade: LogischerTrade
  /** Erkanntes Setup, zu dem der Einstieg passt — null: Trade ohne erkanntes Setup */
  setup: ErkanntesSetup | null
  /** Stimmt das selbst vergebene Setup-Tag mit dem erkannten überein? null: kein Tag oder kein Setup */
  tagPasst: boolean | null
}

/**
 * Die Umkehrung des Rückblicks: Hatte jeder eigene Trade ein erkennbares Setup?
 * Trades ohne Treffer sind Kandidaten für „Bauchgefühl“ — oder für ein Setup,
 * das die regelbasierte Erkennung nicht kennt.
 */
export function pruefeEigeneTrades(c: Candle[], setups: ErkanntesSetup[], trades: Trade[]): TradeAbgleich[] {
  return logischeTrades(trades).map((trade) => {
    const index = indexZuZeit(c, trade.entryTime)
    const kandidaten = setups.filter((s) => passtZu(s, trade.richtung, index))
    // bevorzugt das Setup, das der Trader selbst getaggt hat, sonst das jüngste Signal
    const setup =
      kandidaten.find((s) => s.strategieId === trade.strategieId) ??
      kandidaten.sort((a, b) => b.signalIndex - a.signalIndex)[0] ??
      null
    return {
      trade,
      setup,
      tagPasst: trade.strategieId && setup ? setup.strategieId === trade.strategieId : null,
    }
  })
}

// ── Gespeicherter Rückblick (Journal) ────────────────────────────────────────

export interface RueckblickEintrag {
  strategieId: string
  richtung: Richtung
  status: FundStatus
  art: IdealErgebnis['art']
  r: number
  mitTrend: boolean | null
  deutlichkeit: number
  /** Zeit der Signalkerze (Unix-Sekunden) */
  zeit: number
}

/** Kompakter Stand eines Rückblicks — klein genug für localStorage, genug für die Journal-Bilanz. */
export interface GespeicherterRueckblick {
  sitzungId: string
  symbol: string
  interval: string
  erstelltAm: number
  kerzen: number
  eintraege: RueckblickEintrag[]
  trades: number
  tradesOhneSetup: number
}

export function rueckblickKompakt(
  meta: { sitzungId: string; symbol: string; interval: string; kerzen: number; erstelltAm: number },
  c: Candle[],
  funde: SetupFund[],
  abgleich: TradeAbgleich[],
): GespeicherterRueckblick {
  return {
    ...meta,
    eintraege: funde.map((f) => ({
      strategieId: f.setup.strategieId,
      richtung: f.setup.richtung,
      status: f.status,
      art: f.ergebnis.art,
      r: f.ergebnis.r,
      mitTrend: f.mitTrend,
      deutlichkeit: f.deutlichkeit,
      zeit: c[f.setup.signalIndex].time,
    })),
    trades: abgleich.length,
    tradesOhneSetup: abgleich.filter((a) => !a.setup).length,
  }
}

export interface SetupBilanz {
  strategieId: string
  /** gehandelt + verpasst (ohne „belegt“ — da war man schon im Trade) */
  angeboten: number
  gehandelt: number
  verpasst: number
  /** Anteil der angebotenen Setups, die gehandelt wurden (0..100) */
  quote: number
  verpassteGewinner: number
  verpassteVerlierer: number
  verpassteR: number
}

/** Über alle gespeicherten Sitzungen: Welche Setups werden gesehen, welche regelmäßig verpasst? */
export function setupBilanz(rueckblicke: GespeicherterRueckblick[]): {
  zeilen: SetupBilanz[]
  sitzungen: number
  trades: number
  tradesOhneSetup: number
} {
  const map = new Map<string, SetupBilanz>()
  for (const rb of rueckblicke) {
    for (const e of rb.eintraege) {
      if (e.status === 'belegt') continue
      let z = map.get(e.strategieId)
      if (!z) {
        z = {
          strategieId: e.strategieId,
          angeboten: 0,
          gehandelt: 0,
          verpasst: 0,
          quote: 0,
          verpassteGewinner: 0,
          verpassteVerlierer: 0,
          verpassteR: 0,
        }
        map.set(e.strategieId, z)
      }
      z.angeboten++
      if (e.status === 'gehandelt') z.gehandelt++
      else {
        z.verpasst++
        if (e.art === 'tp') {
          z.verpassteGewinner++
          z.verpassteR += e.r
        } else if (e.art === 'sl') {
          z.verpassteVerlierer++
          z.verpassteR += e.r
        }
      }
    }
  }
  const zeilen = [...map.values()]
    .map((z) => ({ ...z, quote: z.angeboten > 0 ? (z.gehandelt / z.angeboten) * 100 : 0 }))
    .sort((a, b) => b.verpasst - a.verpasst)
  return {
    zeilen,
    sitzungen: rueckblicke.length,
    trades: rueckblicke.reduce((sum, rb) => sum + rb.trades, 0),
    tradesOhneSetup: rueckblicke.reduce((sum, rb) => sum + rb.tradesOhneSetup, 0),
  }
}
