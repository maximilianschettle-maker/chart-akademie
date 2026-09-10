import type { Candle, Richtung, Scenario } from '../types'
import { ema } from './indikatoren/ema'

// Regelbasierte Setup-Erkennung in einem beliebigen Kerzenabschnitt.
// Sucht an einem Signal-Index i (nur Daten bis i sichtbar — kein Blick in die
// Zukunft) nach einem der Setups aus Level 4:
//   - Breakout + Retest einer mehrfach getesteten Decke (breakout-retest)
//   - Liquidity Sweep: Docht unter eine Unterstützung + Rückeroberung (liquidity-sweep)
//   - Range-Bounce an der Unterkante (range-trading)
//   - S/R-Bounce an einer mehrfach bestätigten Zone (sr-bounce)
//   - Trendfolge-Pullback an die EMA 20 (trendfolge-ema)
// Jeder Detektor feuert nur beim ERSTEN Eintritt in seine Zone (nicht an jeder
// Bar darin) und arbeitet mit einer Toleranz, die sich an der Kerzenspanne des
// Abschnitts orientiert (15m-BTC ist enger als 4h-SOL).
// Aus dem Treffer wird ein Übungs-Szenario gebaut. Ob der Trade dann aufgeht,
// ist offen — genau wie im Markt. Geprüft gegen die eingecheckten echten
// Datensätze in setupErkennung.real.test.ts.

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

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

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

/** Typische relative Kerzenspanne (Median von (high−low)/close) der letzten 100 Bars. */
export function typischeSpanne(c: Candle[], i: number): number {
  const werte: number[] = []
  for (let k = Math.max(1, i - 100); k <= i; k++) werte.push((c[k].high - c[k].low) / c[k].close)
  werte.sort((a, b) => a - b)
  return werte[Math.floor(werte.length / 2)] ?? 0.01
}

/** Zonen-Toleranz aus der Kerzenspanne: 1,5 Spannen, begrenzt auf 0,4 %–6 %. */
function toleranz(c: Candle[], i: number): number {
  return Math.min(0.06, Math.max(0.004, 1.5 * typischeSpanne(c, i)))
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

/** Indizes lokaler Swing-Tiefs/-Hochs (Extremum im Fenster ±breite). */
function swings(c: Candle[], von: number, bis: number, art: 'tief' | 'hoch', breite = 4): number[] {
  const out: number[] = []
  for (let i = Math.max(breite, von); i <= Math.min(bis, c.length - 1 - breite); i++) {
    let extrem = true
    for (let k = i - breite; k <= i + breite && extrem; k++) {
      if (k === i) continue
      if (art === 'tief' ? c[k].low < c[i].low : c[k].high > c[i].high) extrem = false
    }
    if (extrem) out.push(i)
  }
  return out
}

/**
 * Mehrfach bestätigtes Level: ein Swing-Extrem, zu dem mindestens ein weiteres
 * Swing-Extrem innerhalb der Toleranz liegt (≥ 10 Bars Abstand). Liefert den
 * Durchschnitt der Cluster-Preise oder null.
 */
function bestaetigtesLevel(
  c: Candle[],
  von: number,
  bis: number,
  art: 'tief' | 'hoch',
  tol: number,
): number | null {
  const idx = swings(c, von, bis, art)
  const preis = (i: number) => (art === 'tief' ? c[i].low : c[i].high)
  let bestes: { preis: number; n: number } | null = null
  for (const a of idx) {
    const cluster = idx.filter(
      (b) => b === a || (Math.abs(preis(b) - preis(a)) / preis(a) <= tol && Math.abs(b - a) >= 10),
    )
    if (cluster.length >= 2 && (!bestes || cluster.length > bestes.n)) {
      bestes = { preis: cluster.reduce((s, b) => s + preis(b), 0) / cluster.length, n: cluster.length }
    }
  }
  return bestes?.preis ?? null
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

// ── Detektoren ───────────────────────────────────────────────────────────────

/**
 * Breakout + Retest: Irgendwo in den letzten 250 Bars hat ein Close eine
 * Decke überschritten, die davor ≥ 3× gehalten hatte. Seitdem kein Close
 * klar unter der Decke (sonst Fakeout), aber schon mal deutlich darüber.
 * Jetzt kommt der Preis zum ersten Mal zurück auf die Decke.
 */
export function erkenneBreakoutRetest(c: Candle[], i: number): ErkanntesSetup | null {
  if (i < 150) return null
  const tol = toleranz(c, i)
  const close = c[i].close
  for (let k = i - 5; k >= Math.max(121, i - 250); k--) {
    const level = maxHigh(c, k - 120, k - 1)
    if (!(c[k].close > level * (1 + tol / 2) && c[k - 1].close <= level)) continue // erster Close drüber
    const nah = (b: Candle) => b.high >= level * (1 - tol) && b.high <= level * 1.002
    if (beruehrungen(c, k - 120, k - 1, nah, 10) < 3) continue
    let verloren = false
    let weit = false
    for (let m = k; m < i; m++) {
      if (c[m].close < level * (1 - tol)) verloren = true
      if (c[m].close > level * (1 + tol)) weit = true
    }
    if (verloren || !weit) continue
    const inZone = close >= level * (1 - tol) && close <= level * (1 + tol)
    const vorherDrueber = c[i - 1].close > level * (1 + tol)
    if (!inZone || !vorherDrueber) return null
    const idealEntry = level * 1.003
    const idealStopLoss = level * (1 - 2 * tol)
    let idealTakeProfit = maxHigh(c, k, i)
    if ((idealTakeProfit - idealEntry) / (idealEntry - idealStopLoss) < MIN_CRV) {
      idealTakeProfit = idealEntry + (idealEntry - idealStopLoss) * 2
    }
    return {
      strategieId: 'breakout-retest',
      richtung: 'long',
      signalIndex: i,
      entryZone: { preisVon: level * (1 - 1.5 * tol), preisBis: level * (1 + 1.5 * tol), barVon: i, barBis: i + 30 },
      idealEntry,
      idealStopLoss,
      idealTakeProfit,
      lage: `Ein Widerstand um ~${runde(level)} $ hat mehrfach gehalten und wurde vor einiger Zeit impulsiv überschritten.`,
    }
  }
  return null
}

/**
 * Liquidity Sweep: Docht unter eine mehrfach bestätigte Unterstützung, und die
 * aktuelle Kerze ist der erste Close wieder darüber.
 */
export function erkenneLiquiditySweep(c: Candle[], i: number): ErkanntesSetup | null {
  if (i < 150) return null
  const tol = toleranz(c, i)
  const level = bestaetigtesLevel(c, i - 250, i - 6, 'tief', tol)
  if (level === null) return null
  const sweepTief = minLow(c, i - 3, i)
  if (sweepTief > level * (1 - tol / 2)) return null // kein echter Bruch
  const close = c[i].close
  if (close < level || close > level * (1 + 2 * tol)) return null
  if (c[i - 1].close >= level) return null // erster Close zurück über dem Level
  const idealEntry = level * 1.005
  const idealStopLoss = sweepTief * 0.995
  let idealTakeProfit = maxHigh(c, i - 40, i - 1)
  if ((idealTakeProfit - idealEntry) / (idealEntry - idealStopLoss) < MIN_CRV) {
    idealTakeProfit = idealEntry + 2 * (idealEntry - idealStopLoss)
  }
  return {
    strategieId: 'liquidity-sweep',
    richtung: 'long',
    signalIndex: i,
    entryZone: { preisVon: level * (1 - tol), preisBis: level * (1 + 2.5 * tol), barVon: i, barBis: i + 15 },
    idealEntry,
    idealStopLoss,
    idealTakeProfit,
    lage: `Eine mehrfach bestätigte Unterstützung um ~${runde(level)} $ wurde gerade mit einem Docht unterschritten.`,
  }
}

/** Range-Bounce: Preis erreicht zum ersten Mal wieder das untere Drittel einer klaren Range. */
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
  const close = c[i].close
  if (close > tief + 0.3 * w || close < tief) return null
  if (c[i - 1].close <= tief + 0.3 * w) return null // erster Eintritt ins untere Band
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

/** S/R-Bounce: erster Eintritt in eine mehrfach bestätigte Zone, nach Anlauf von außen. */
export function erkenneSrBounce(c: Candle[], i: number, richtung: Richtung): ErkanntesSetup | null {
  if (i < 150) return null
  const tol = toleranz(c, i)
  const close = c[i].close
  if (richtung === 'long') {
    const level = bestaetigtesLevel(c, i - 150, i - 6, 'tief', tol)
    if (level === null) return null
    if (close < level * (1 - tol) || close > level * (1 + tol)) return null
    if (c[i - 1].close <= level * (1 + tol)) return null // erster Eintritt
    if (maxHigh(c, i - 30, i - 1) < level * (1 + 4 * tol)) return null // kam von weiter oben
    const idealEntry = level * 1.003
    const idealStopLoss = level * (1 - 2 * tol)
    let idealTakeProfit = maxHigh(c, i - 60, i - 1)
    if ((idealTakeProfit - idealEntry) / (idealEntry - idealStopLoss) < MIN_CRV) {
      idealTakeProfit = idealEntry + 2 * (idealEntry - idealStopLoss)
    }
    return {
      strategieId: 'sr-bounce',
      richtung: 'long',
      signalIndex: i,
      entryZone: { preisVon: level * (1 - 1.5 * tol), preisBis: level * (1 + 1.5 * tol), barVon: i, barBis: i + 25 },
      idealEntry,
      idealStopLoss,
      idealTakeProfit,
      lage: `Unter dem Markt liegt eine Zone um ~${runde(level)} $, die schon mehrfach als Unterstützung gehalten hat — der Preis fällt gerade wieder hinein.`,
    }
  }
  const level = bestaetigtesLevel(c, i - 150, i - 6, 'hoch', tol)
  if (level === null) return null
  if (close > level * (1 + tol) || close < level * (1 - tol)) return null
  if (c[i - 1].close >= level * (1 - tol)) return null
  if (minLow(c, i - 30, i - 1) > level * (1 - 4 * tol)) return null
  const idealEntry = level * 0.997
  const idealStopLoss = level * (1 + 2 * tol)
  let idealTakeProfit = minLow(c, i - 60, i - 1)
  if ((idealEntry - idealTakeProfit) / (idealStopLoss - idealEntry) < MIN_CRV) {
    idealTakeProfit = idealEntry - 2 * (idealStopLoss - idealEntry)
  }
  return {
    strategieId: 'sr-bounce',
    richtung: 'short',
    signalIndex: i,
    entryZone: { preisVon: level * (1 - 1.5 * tol), preisBis: level * (1 + 1.5 * tol), barVon: i, barBis: i + 25 },
    idealEntry,
    idealStopLoss,
    idealTakeProfit,
    lage: `Über dem Markt liegt eine Zone um ~${runde(level)} $, an der der Preis schon mehrfach abgeprallt ist — er steigt gerade wieder hinein.`,
  }
}

/** Trendfolge-Pullback: intakter EMA-Trend, Preis berührt erstmals wieder die EMA 20. */
export function erkenneTrendPullback(c: Candle[], i: number, richtung: Richtung): ErkanntesSetup | null {
  if (i < 120) return null
  const sicht = c.slice(0, i + 1)
  const e20 = ema(sicht, 20)
  const e50 = ema(sicht, 50)
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
    if (close < ema20 * 0.98 || close > ema20 * 1.015) return null
    // erster Kontakt: vorherige Bar noch klar über der EMA, und kürzlich deutlich darüber
    if (c[i - 1].close <= e20[i - 1] * 1.005) return null
    if (maxHigh(c, i - 10, i - 1) < ema20 * 1.015) return null
    if (close > hoch * 0.985) return null
    const swingTief = minLow(c, i - 12, i)
    const idealEntry = ema20
    const idealStopLoss = (swingTief < idealEntry ? swingTief : e50[i]) * 0.995
    const idealTakeProfit = Math.max(hoch, idealEntry + 2 * (idealEntry - idealStopLoss))
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
  if (c[i - 1].close >= e20[i - 1] * 0.995) return null
  if (minLow(c, i - 10, i - 1) > ema20 * 0.985) return null
  if (close < tief * 1.015) return null
  const swingHoch = maxHigh(c, i - 12, i)
  const idealEntry = ema20
  const idealStopLoss = (swingHoch > idealEntry ? swingHoch : e50[i]) * 1.005
  const idealTakeProfit = Math.min(tief, idealEntry - 2 * (idealStopLoss - idealEntry))
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

// ── Suche & Szenario ─────────────────────────────────────────────────────────

/** Alle Detektoren an einem Index, in Prioritätsreihenfolge. */
export function erkenneAn(c: Candle[], i: number): ErkanntesSetup | null {
  return (
    erkenneBreakoutRetest(c, i) ??
    erkenneLiquiditySweep(c, i) ??
    erkenneRangeBounce(c, i) ??
    erkenneSrBounce(c, i, 'long') ??
    erkenneSrBounce(c, i, 'short') ??
    erkenneTrendPullback(c, i, 'long') ??
    erkenneTrendPullback(c, i, 'short')
  )
}

/**
 * Durchsucht den Abschnitt nach einem Setup. Kandidaten-Indizes in zufälliger
 * Reihenfolge, damit nicht immer dieselbe Stelle gefunden wird. Es bleiben
 * mindestens `nachlauf` Bars nach dem Signal für das Replay.
 */
export function findeSetup(c: Candle[], nachlauf = 80, zufall: () => number = Math.random): ErkanntesSetup | null {
  const kandidaten: number[] = []
  for (let i = 150; i < c.length - nachlauf; i++) kandidaten.push(i)
  for (let k = kandidaten.length - 1; k > 0; k--) {
    const j = Math.floor(zufall() * (k + 1))
    ;[kandidaten[k], kandidaten[j]] = [kandidaten[j], kandidaten[k]]
  }
  for (const i of kandidaten) {
    const treffer = erkenneAn(c, i)
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
