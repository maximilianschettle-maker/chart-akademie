import type { Candle, Richtung, Scenario } from '../types'
import { ema } from './indikatoren/ema'

// Regelbasierte Setup-Erkennung in einem beliebigen Kerzenabschnitt.
// Sucht an einem Signal-Index i (nur Daten bis i sichtbar — kein Blick in die
// Zukunft) nach einem der drei am klarsten definierbaren Setups aus Level 4:
//   - Range-Bounce an der Unterkante (range-trading)
//   - Trendfolge-Pullback an die EMA 20 (trendfolge-ema)
//   - Breakout + Retest einer mehrfach getesteten Decke (breakout-retest)
// Aus dem Treffer wird ein Übungs-Szenario gebaut. Ob der Trade dann aufgeht,
// ist offen — genau wie im Markt.

export interface ErkanntesSetup {
  strategieId: string
  richtung: Richtung
  signalIndex: number
  entryZone: { preisVon: number; preisBis: number; barVon: number; barBis: number }
  idealEntry: number
  idealStopLoss: number
  idealTakeProfit: number
  /** Kurzbeschreibung der Marktlage (ohne das Setup zu verraten) */
  lage: string
}

const MIN_CRV = 1.5

function maxHigh(c: Candle[], von: number, bis: number): number {
  let m = -Infinity
  for (let i = Math.max(0, von); i <= bis; i++) m = Math.max(m, c[i].high)
  return m
}
function minLow(c: Candle[], von: number, bis: number): number {
  let m = Infinity
  for (let i = Math.max(0, von); i <= bis; i++) m = Math.min(m, c[i].low)
  return m
}

/** Anzahl „Berührungen“ eines Bands, mindestens `abstand` Bars auseinander. */
function beruehrungen(
  c: Candle[],
  von: number,
  bis: number,
  test: (bar: Candle) => boolean,
  abstand: number,
): number {
  let n = 0
  let letzte = -Infinity
  for (let i = Math.max(0, von); i <= bis; i++) {
    if (test(c[i]) && i - letzte >= abstand) {
      n++
      letzte = i
    }
  }
  return n
}

export function erkenneRangeBounce(c: Candle[], i: number): ErkanntesSetup | null {
  const N = 80
  if (i < N + 20) return null
  const hoch = maxHigh(c, i - N, i - 1)
  const tief = minLow(c, i - N, i - 1)
  const w = hoch - tief
  if (w <= 0 || w / tief > 0.12) return null // zu wild für eine Range
  const untenBand = (b: Candle) => b.low <= tief + 0.15 * w
  const obenBand = (b: Candle) => b.high >= hoch - 0.15 * w
  if (beruehrungen(c, i - N, i - 1, untenBand, 8) < 2) return null
  if (beruehrungen(c, i - N, i - 1, obenBand, 8) < 2) return null
  // Preis nähert sich gerade der Unterkante, ist aber noch nicht darunter
  const close = c[i].close
  if (close > tief + 0.35 * w || close < tief) return null
  const idealEntry = tief + 0.1 * w
  const idealStopLoss = tief - 0.15 * w
  const idealTakeProfit = hoch - 0.1 * w
  return {
    strategieId: 'range-trading',
    richtung: 'long',
    signalIndex: i,
    entryZone: { preisVon: tief - 0.03 * w, preisBis: tief + 0.22 * w, barVon: i, barBis: i + 30 },
    idealEntry,
    idealStopLoss,
    idealTakeProfit,
    lage: `Der Markt pendelt seit ~${N} Kerzen zwischen ~${runde(tief)} und ~${runde(hoch)} $ und nähert sich gerade dem unteren Bereich.`,
  }
}

export function erkenneTrendPullback(c: Candle[], i: number, richtung: Richtung): ErkanntesSetup | null {
  if (i < 120) return null
  const sicht = c.slice(0, i + 1)
  const e20 = ema(sicht, 20)
  const e50 = ema(sicht, 50)
  // Trend intakt: EMA20 auf der richtigen Seite der EMA50 seit 30 Bars
  for (let k = i - 30; k <= i; k++) {
    if (!Number.isFinite(e20[k]) || !Number.isFinite(e50[k])) return null
    if (richtung === 'long' ? e20[k] <= e50[k] : e20[k] >= e50[k]) return null
  }
  const close = c[i].close
  const ema20 = e20[i]
  if (richtung === 'long') {
    const hoch = maxHigh(c, i - 40, i - 1)
    const altesHoch = maxHigh(c, i - 80, i - 41)
    if (hoch <= altesHoch) return null // kein Higher High
    // Pullback: Close in der Nähe der EMA20, deutlich unter dem letzten Hoch
    if (close < ema20 * 0.98 || close > ema20 * 1.015) return null
    if (close > hoch * 0.985) return null
    const swingTief = minLow(c, i - 12, i)
    const idealEntry = ema20
    // Stop unter das letzte Swing-Tief; liegt das über dem Entry, unter die EMA 50
    const idealStopLoss = (swingTief < idealEntry ? swingTief : e50[i]) * 0.995
    // Ziel: altes Hoch, mindestens aber 2R (Trendfolge läuft oft weiter als das letzte Hoch)
    const idealTakeProfit = Math.max(hoch, idealEntry + 2 * (idealEntry - idealStopLoss))
    if ((idealTakeProfit - idealEntry) / (idealEntry - idealStopLoss) < MIN_CRV) return null
    return {
      strategieId: 'trendfolge-ema',
      richtung: 'long',
      signalIndex: i,
      entryZone: { preisVon: idealStopLoss * 1.003, preisBis: ema20 * 1.015, barVon: i, barBis: i + 25 },
      idealEntry,
      idealStopLoss,
      idealTakeProfit,
      lage: `Der Markt macht seit Wochen höhere Hochs und höhere Tiefs und setzt gerade vom letzten Hoch (~${runde(hoch)} $) zurück.`,
    }
  }
  const tief = minLow(c, i - 40, i - 1)
  const altesTief = minLow(c, i - 80, i - 41)
  if (tief >= altesTief) return null
  if (close > ema20 * 1.02 || close < ema20 * 0.985) return null
  if (close < tief * 1.015) return null
  const swingHoch = maxHigh(c, i - 12, i)
  const idealEntry = ema20
  const idealStopLoss = (swingHoch > idealEntry ? swingHoch : e50[i]) * 1.005
  const idealTakeProfit = Math.min(tief, idealEntry - 2 * (idealStopLoss - idealEntry))
  if ((idealEntry - idealTakeProfit) / (idealStopLoss - idealEntry) < MIN_CRV) return null
  return {
    strategieId: 'trendfolge-ema',
    richtung: 'short',
    signalIndex: i,
    entryZone: { preisVon: ema20 * 0.985, preisBis: idealStopLoss * 0.997, barVon: i, barBis: i + 25 },
    idealEntry,
    idealStopLoss,
    idealTakeProfit,
    lage: `Der Markt macht seit Wochen tiefere Tiefs und tiefere Hochs und erholt sich gerade vom letzten Tief (~${runde(tief)} $).`,
  }
}

export function erkenneBreakoutRetest(c: Candle[], i: number): ErkanntesSetup | null {
  if (i < 140) return null
  const level = maxHigh(c, i - 120, i - 12)
  const nahAmLevel = (b: Candle) => b.high >= level * 0.99 && b.high <= level * 1.002
  if (beruehrungen(c, i - 120, i - 12, nahAmLevel, 10) < 3) return null
  // Ausbruch: ein Close deutlich über dem Level in den letzten 12 Bars
  let ausbruch = -1
  for (let k = i - 11; k <= i - 2; k++) if (c[k].close > level * 1.01) ausbruch = k
  if (ausbruch < 0) return null
  const ausbruchsHoch = maxHigh(c, ausbruch, i)
  // Retest: Preis kommt zurück auf das Level, hat es aber nicht klar verloren
  const close = c[i].close
  if (close < level * 0.985 || close > level * 1.02) return null
  const idealEntry = level * 1.003
  const idealStopLoss = level * 0.975
  let idealTakeProfit = ausbruchsHoch
  if ((idealTakeProfit - idealEntry) / (idealEntry - idealStopLoss) < MIN_CRV) {
    idealTakeProfit = idealEntry + (idealEntry - idealStopLoss) * 2
  }
  return {
    strategieId: 'breakout-retest',
    richtung: 'long',
    signalIndex: i,
    entryZone: { preisVon: level * 0.98, preisBis: level * 1.02, barVon: i, barBis: i + 30 },
    idealEntry,
    idealStopLoss,
    idealTakeProfit,
    lage: `Ein Widerstand um ~${runde(level)} $ hat mehrfach gehalten und wurde vor Kurzem impulsiv überschritten.`,
  }
}

function runde(p: number): string {
  return rundePreis(p).toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/** Preis auf eine sinnvolle Genauigkeit runden (BTC ganze Dollar, SOL Cent). */
export function rundePreis(p: number): number {
  const stellen = p >= 1000 ? 0 : p >= 100 ? 1 : 2
  const f = 10 ** stellen
  return Math.round(p * f) / f
}

/**
 * Durchsucht den Abschnitt nach einem Setup. Kandidaten-Indizes in zufälliger
 * Reihenfolge, damit nicht immer dieselbe Stelle gefunden wird. Es bleiben
 * mindestens `nachlauf` Bars nach dem Signal für das Replay.
 */
export function findeSetup(c: Candle[], nachlauf = 80, zufall: () => number = Math.random): ErkanntesSetup | null {
  const kandidaten: number[] = []
  for (let i = 150; i < c.length - nachlauf; i += 2) kandidaten.push(i)
  for (let k = kandidaten.length - 1; k > 0; k--) {
    const j = Math.floor(zufall() * (k + 1))
    ;[kandidaten[k], kandidaten[j]] = [kandidaten[j], kandidaten[k]]
  }
  for (const i of kandidaten) {
    const treffer =
      erkenneBreakoutRetest(c, i) ??
      erkenneRangeBounce(c, i) ??
      erkenneTrendPullback(c, i, 'long') ??
      erkenneTrendPullback(c, i, 'short')
    if (treffer) return treffer
  }
  return null
}

const FEEDBACK_GENERISCH = {
  perfekt:
    'Setup erkannt und regelkonform ausgeführt: Entry in der Zone, Stop auf der richtigen Seite, CRV ≥ 1,5. Ob der Trade gewonnen oder verloren hat, ist Statistik — der Prozess war richtig. Genau das trainierst du hier.',
  ok: 'Die Zone hast du richtig gelesen, aber Stop oder Ziel waren unsauber (SL nicht an der Widerlegung oder CRV unter 1,5). Beim nächsten Mal: erst Stop und Ziel definieren, dann Entry.',
  verpasst:
    'Kein Entry — dabei hat die Erkennung hier ein Setup aus Level 4 gesehen. Schau dir die eingezeichnete Zone an: Hättest du sie mit den Zeichenwerkzeugen vorher markiert, wäre der Auslöser sichtbar gewesen.',
  falsch:
    'Der Entry passte nicht zum erkannten Setup — falsche Richtung oder außerhalb der Zone. Vergleiche deine Zone mit der eingezeichneten Ideal-Zone: Wo lag der Unterschied in der Lesart?',
}

/** Baut aus einem erkannten Setup ein vollwertiges Übungs-Szenario. */
export function setupZuSzenario(
  setup: ErkanntesSetup,
  symbol: string,
  interval: string,
  nachlauf = 80,
): Scenario {
  return {
    id: `zufall-${symbol}-${interval}-${setup.signalIndex}-${Date.now()}`,
    titel: 'Zufalls-Übung',
    strategieId: setup.strategieId,
    datensatz: '',
    symbol,
    interval,
    startIndex: setup.signalIndex,
    endIndex: setup.signalIndex + nachlauf,
    aufgabe: `${setup.lage} Erkenne selbst, ob und wo ein Setup entsteht — oder ob Abwarten richtig ist.`,
    richtung: setup.richtung,
    entryZone: {
      ...setup.entryZone,
      preisVon: rundePreis(setup.entryZone.preisVon),
      preisBis: rundePreis(setup.entryZone.preisBis),
    },
    idealEntry: rundePreis(setup.idealEntry),
    idealStopLoss: rundePreis(setup.idealStopLoss),
    idealTakeProfit: rundePreis(setup.idealTakeProfit),
    feedback: FEEDBACK_GENERISCH,
    datumVerdeckt: true,
    ansageVerdeckt: true,
    generiert: true,
  }
}
