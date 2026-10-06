import type { Candle, Richtung, Scenario } from '../types'
import { ema } from './indikatoren/ema'

// Regelbasierte Setup-Erkennung in einem beliebigen Kerzenabschnitt.
// Sucht an einem Signal-Index i (nur Daten bis i sichtbar — kein Blick in die
// Zukunft) nach einem der Setups aus Level 4:
//   - Breakout + Retest einer mehrfach getesteten Decke bzw. eines Bodens (breakout-retest)
//   - Liquidity Sweep: Docht durch ein Level + Rückeroberung (liquidity-sweep)
//   - Range-Bounce an Unter- oder Oberkante (range-trading)
//   (alle drei in beide Richtungen)
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
  /** Woran das Setup an der Signalkerze erkennbar war — als Checkliste für den Rückblick */
  merkmale: string[]
  /** Preis-Ebenen, die das Setup ausmachen (Level, Range-Kanten) */
  ebenen: SetupEbene[]
  /** Auffällige Kerzen (Tests des Levels, Ausbruch, Sweep …) */
  punkte: SetupPunkt[]
  /** EMAs, die zum Setup gehören */
  emaPerioden?: number[]
  /** Wie oft das Level vor dem Signal bestätigt wurde (Tests, Swing-Extreme); fehlt beim Trend-Setup */
  staerke?: number
}

export interface SetupEbene {
  preis: number
  text: string
}

export interface SetupPunkt {
  index: number
  text: string
  /** Markierung über (true) oder unter der Kerze */
  oben: boolean
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

/** Indizes der „Berührungen“ eines Bands, mindestens `abstand` Bars auseinander. */
function beruehrungsIndizes(
  c: Candle[],
  von: number,
  bis: number,
  test: (bar: Candle) => boolean,
  abstand: number,
): number[] {
  const out: number[] = []
  let letzte = -Infinity
  for (let i = Math.max(0, von); i <= bis; i++) {
    if (test(c[i]) && i - letzte >= abstand) {
      out.push(i)
      letzte = i
    }
  }
  return out
}

function argMin(c: Candle[], von: number, bis: number): number {
  let best = Math.max(0, von)
  for (let i = best; i <= bis; i++) if (c[i].low < c[best].low) best = i
  return best
}
function argMax(c: Candle[], von: number, bis: number): number {
  let best = Math.max(0, von)
  for (let i = best; i <= bis; i++) if (c[i].high > c[best].high) best = i
  return best
}

/** Höchstens die letzten `n` Indizes als Markierungen. */
function alsPunkte(indizes: number[], text: string, oben: boolean, n = 3): SetupPunkt[] {
  return indizes.slice(-n).map((index) => ({ index, text, oben }))
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
): { preis: number; indizes: number[] } | null {
  const idx = swings(c, von, bis, art)
  const preis = (i: number) => (art === 'tief' ? c[i].low : c[i].high)
  let bestes: { preis: number; indizes: number[] } | null = null
  for (const a of idx) {
    const cluster = idx.filter(
      (b) => b === a || (Math.abs(preis(b) - preis(a)) / preis(a) <= tol && Math.abs(b - a) >= 10),
    )
    if (cluster.length >= 2 && (!bestes || cluster.length > bestes.indizes.length)) {
      bestes = { preis: cluster.reduce((s, b) => s + preis(b), 0) / cluster.length, indizes: cluster }
    }
  }
  return bestes
}

/** Wurde ein Level nach seinem letzten Test klar gebrochen? Dann gilt es nicht mehr. */
function gebrochenSeit(c: Candle[], tests: number[], i: number, bruch: (bar: Candle) => boolean): boolean {
  const letzter = Math.max(...tests)
  for (let m = letzter + 1; m < i; m++) if (bruch(c[m])) return true
  return false
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
 * Breakout + Retest (long): Irgendwo in den letzten 250 Bars hat ein Close eine
 * Decke überschritten, die davor ≥ 3× gehalten hatte. Seitdem kein Close klar
 * unter der Decke (sonst Fakeout), aber schon mal deutlich darüber. Jetzt kommt
 * der Preis zum ersten Mal zurück auf die Decke.
 * Short spiegelbildlich: Bruch eines mehrfach getesteten Bodens, erster Rücklauf von unten.
 */
export function erkenneBreakoutRetest(c: Candle[], i: number, richtung: Richtung = 'long'): ErkanntesSetup | null {
  if (i < 150) return null
  const long = richtung === 'long'
  const tol = toleranz(c, i)
  const close = c[i].close
  for (let k = i - 5; k >= Math.max(121, i - 250); k--) {
    const level = long ? maxHigh(c, k - 120, k - 1) : minLow(c, k - 120, k - 1)
    // erster Close jenseits des Levels
    const bruch = long
      ? c[k].close > level * (1 + tol / 2) && c[k - 1].close <= level
      : c[k].close < level * (1 - tol / 2) && c[k - 1].close >= level
    if (!bruch) continue
    const nah = long
      ? (bar: Candle) => bar.high >= level * (1 - tol) && bar.high <= level * 1.002
      : (bar: Candle) => bar.low <= level * (1 + tol) && bar.low >= level * 0.998
    const tests = beruehrungsIndizes(c, k - 120, k - 1, nah, 10)
    if (tests.length < 3) continue
    let verloren = false
    let weit = false
    for (let m = k; m < i; m++) {
      if (long ? c[m].close < level * (1 - tol) : c[m].close > level * (1 + tol)) verloren = true
      if (long ? c[m].close > level * (1 + tol) : c[m].close < level * (1 - tol)) weit = true
    }
    if (verloren || !weit) continue
    const inZone = close >= level * (1 - tol) && close <= level * (1 + tol)
    const vorherWeg = long ? c[i - 1].close > level * (1 + tol) : c[i - 1].close < level * (1 - tol)
    if (!inZone || !vorherWeg) return null
    const idealEntry = long ? level * 1.003 : level * 0.997
    const idealStopLoss = long ? level * (1 - 2 * tol) : level * (1 + 2 * tol)
    const risiko = Math.abs(idealEntry - idealStopLoss)
    let idealTakeProfit = long ? maxHigh(c, k, i) : minLow(c, k, i)
    if (Math.abs(idealTakeProfit - idealEntry) / risiko < MIN_CRV) {
      idealTakeProfit = long ? idealEntry + 2 * risiko : idealEntry - 2 * risiko
    }
    return {
      strategieId: 'breakout-retest',
      richtung,
      signalIndex: i,
      entryZone: { preisVon: level * (1 - 1.5 * tol), preisBis: level * (1 + 1.5 * tol), barVon: i, barBis: i + 30 },
      idealEntry,
      idealStopLoss,
      idealTakeProfit,
      staerke: tests.length,
      lage: long
        ? `Ein Widerstand um ~${runde(level)} $ hat mehrfach gehalten und wurde vor einiger Zeit impulsiv überschritten.`
        : `Eine Unterstützung um ~${runde(level)} $ hat mehrfach gehalten und wurde vor einiger Zeit impulsiv unterschritten.`,
      merkmale: long
        ? [
            `Widerstand um ~${runde(level)} $: ${tests.length}× angelaufen und jedes Mal abgewiesen.`,
            `Ausbruch vor ${i - k} Kerzen: Schlusskurs klar über dem Level.`,
            'Seitdem kein Schlusskurs zurück unter das Level — kein Fakeout.',
            'Jetzt der erste Rücklauf auf das alte Hoch: Aus Widerstand wird Unterstützung — hier liegt der Entry.',
          ]
        : [
            `Unterstützung um ~${runde(level)} $: ${tests.length}× angelaufen und jedes Mal gehalten.`,
            `Bruch vor ${i - k} Kerzen: Schlusskurs klar unter dem Level.`,
            'Seitdem kein Schlusskurs zurück über das Level — kein Fehlausbruch.',
            'Jetzt der erste Rücklauf von unten an das alte Tief: Aus Unterstützung wird Widerstand — hier liegt der Short-Entry.',
          ],
      ebenen: [{ preis: level, text: long ? 'alter Widerstand' : 'alte Unterstützung' }],
      punkte: [...alsPunkte(tests, 'Test', long), { index: k, text: long ? 'Ausbruch' : 'Bruch', oben: !long }],
    }
  }
  return null
}

/**
 * Liquidity Sweep (long): Docht unter eine mehrfach bestätigte Unterstützung, und
 * die aktuelle Kerze ist der erste Close wieder darüber.
 * Short spiegelbildlich: Docht über einen Widerstand, erster Close wieder darunter.
 */
export function erkenneLiquiditySweep(c: Candle[], i: number, richtung: Richtung = 'long'): ErkanntesSetup | null {
  if (i < 150) return null
  const long = richtung === 'long'
  const tol = toleranz(c, i)
  const cluster = bestaetigtesLevel(c, i - 250, i - 6, long ? 'tief' : 'hoch', tol)
  if (cluster === null) return null
  const level = cluster.preis
  const extrem = long ? minLow(c, i - 3, i) : maxHigh(c, i - 3, i)
  if (long ? extrem > level * (1 - tol / 2) : extrem < level * (1 + tol / 2)) return null // kein echter Bruch
  const close = c[i].close
  if (long ? close < level || close > level * (1 + 2 * tol) : close > level || close < level * (1 - 2 * tol)) return null
  // erster Close zurück auf der richtigen Seite des Levels
  if (long ? c[i - 1].close >= level : c[i - 1].close <= level) return null
  let jenseits = 0
  for (let m = i - 1; m >= 0 && (long ? c[m].close < level : c[m].close > level); m--) jenseits++
  if (jenseits > 8) return null // länger jenseits = Bruch, kein Sweep
  const idealEntry = long ? level * 1.005 : level * 0.995
  const idealStopLoss = long ? extrem * 0.995 : extrem * 1.005
  const risiko = Math.abs(idealEntry - idealStopLoss)
  let idealTakeProfit = long ? maxHigh(c, i - 40, i - 1) : minLow(c, i - 40, i - 1)
  if ((long ? idealTakeProfit - idealEntry : idealEntry - idealTakeProfit) / risiko < MIN_CRV) {
    idealTakeProfit = long ? idealEntry + 2 * risiko : idealEntry - 2 * risiko
  }
  const n = cluster.indizes.length
  return {
    strategieId: 'liquidity-sweep',
    richtung,
    signalIndex: i,
    entryZone: long
      ? { preisVon: level * (1 - tol), preisBis: level * (1 + 2.5 * tol), barVon: i, barBis: i + 15 }
      : { preisVon: level * (1 - 2.5 * tol), preisBis: level * (1 + tol), barVon: i, barBis: i + 15 },
    idealEntry,
    idealStopLoss,
    idealTakeProfit,
    staerke: n,
    lage: long
      ? `Eine mehrfach bestätigte Unterstützung um ~${runde(level)} $ wurde gerade mit einem Docht unterschritten.`
      : `Ein mehrfach bestätigter Widerstand um ~${runde(level)} $ wurde gerade mit einem Docht überschritten.`,
    merkmale: long
      ? [
          `Unterstützung um ~${runde(level)} $: ${n} Swing-Tiefs auf gleicher Höhe — darunter liegen die Stops der Longs.`,
          `Ein Docht sticht bis ~${runde(extrem)} $ darunter: Die Stops werden abgefischt.`,
          'Der Schlusskurs liegt sofort wieder über dem Level — die Unterstützung ist zurückerobert.',
          'Entry nach der Rückeroberung, Stop unter das Docht-Tief.',
        ]
      : [
          `Widerstand um ~${runde(level)} $: ${n} Swing-Hochs auf gleicher Höhe — darüber liegen die Stops der Shorts.`,
          `Ein Docht sticht bis ~${runde(extrem)} $ darüber: Die Stops werden abgefischt.`,
          'Der Schlusskurs liegt sofort wieder unter dem Level — der Ausbruch ist gescheitert.',
          'Short-Entry nach der Rückkehr unter das Level, Stop über das Docht-Hoch.',
        ],
    ebenen: [{ preis: level, text: long ? 'Unterstützung' : 'Widerstand' }],
    punkte: [
      ...alsPunkte(cluster.indizes, long ? 'Tief' : 'Hoch', !long),
      { index: long ? argMin(c, i - 3, i) : argMax(c, i - 3, i), text: 'Sweep', oben: !long },
    ],
  }
}

/**
 * Range-Bounce: Preis erreicht zum ersten Mal wieder das untere Drittel einer
 * klaren Range (long) bzw. das obere Drittel (short).
 */
export function erkenneRangeBounce(c: Candle[], i: number, richtung: Richtung = 'long'): ErkanntesSetup | null {
  const N = 80
  if (i < N + 20) return null
  const long = richtung === 'long'
  const hoch = maxHigh(c, i - N, i - 1)
  const tief = minLow(c, i - N, i - 1)
  const w = hoch - tief
  if (w <= 0 || w / tief > 0.12) return null // zu wild für eine Range
  const untenBand = (bar: Candle) => bar.low <= tief + 0.15 * w
  const obenBand = (bar: Candle) => bar.high >= hoch - 0.15 * w
  const testsUnten = beruehrungsIndizes(c, i - N, i - 1, untenBand, 8)
  const testsOben = beruehrungsIndizes(c, i - N, i - 1, obenBand, 8)
  if (testsUnten.length < 2 || testsOben.length < 2) return null
  // Echte Range = Pendeln. Erst nur unten und dann nur oben getestet ist eine Stufe (Trendschub).
  const folge = [...testsUnten.map((k) => ({ k, seite: 'u' })), ...testsOben.map((k) => ({ k, seite: 'o' }))].sort(
    (x, y) => x.k - y.k,
  )
  let wechsel = 0
  for (let m = 1; m < folge.length; m++) if (folge[m].seite !== folge[m - 1].seite) wechsel++
  if (wechsel < 2) return null
  const close = c[i].close
  if (long) {
    if (close > tief + 0.3 * w || close < tief) return null
    if (c[i - 1].close <= tief + 0.3 * w) return null // erster Eintritt ins untere Band
  } else {
    if (close < hoch - 0.3 * w || close > hoch) return null
    if (c[i - 1].close >= hoch - 0.3 * w) return null // erster Eintritt ins obere Band
  }
  const breite = ((w / tief) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return {
    strategieId: 'range-trading',
    richtung,
    signalIndex: i,
    entryZone: long
      ? { preisVon: tief - 0.03 * w, preisBis: tief + 0.22 * w, barVon: i, barBis: i + 30 }
      : { preisVon: hoch - 0.22 * w, preisBis: hoch + 0.03 * w, barVon: i, barBis: i + 30 },
    idealEntry: long ? tief + 0.1 * w : hoch - 0.1 * w,
    idealStopLoss: long ? tief - 0.15 * w : hoch + 0.15 * w,
    idealTakeProfit: long ? hoch - 0.1 * w : tief + 0.1 * w,
    staerke: Math.min(testsUnten.length, testsOben.length) + 1,
    lage: `Der Markt pendelt seit ~${N} Kerzen zwischen ~${runde(tief)} und ~${runde(hoch)} $ und nähert sich gerade dem ${long ? 'unteren' : 'oberen'} Bereich.`,
    merkmale: [
      `Seit ~${N} Kerzen Seitwärtsphase zwischen ~${runde(tief)} und ~${runde(hoch)} $ (${breite} % breit) — kein Trend.`,
      `Oberkante ${testsOben.length}× und Unterkante ${testsUnten.length}× getestet: Beide Seiten halten.`,
      long
        ? 'Jetzt der erste Eintritt ins untere Drittel — Long Richtung Oberkante, Stop unter die Range.'
        : 'Jetzt der erste Eintritt ins obere Drittel — Short Richtung Unterkante, Stop über die Range.',
    ],
    ebenen: [
      { preis: hoch, text: 'Range-Oberkante' },
      { preis: tief, text: 'Range-Unterkante' },
    ],
    punkte: [...alsPunkte(testsOben, 'Test', true, 2), ...alsPunkte(testsUnten, 'Test', false, 2)],
  }
}

/** S/R-Bounce: erster Eintritt in eine mehrfach bestätigte Zone, nach Anlauf von außen. */
export function erkenneSrBounce(c: Candle[], i: number, richtung: Richtung): ErkanntesSetup | null {
  if (i < 150) return null
  const tol = toleranz(c, i)
  const close = c[i].close
  if (richtung === 'long') {
    const cluster = bestaetigtesLevel(c, i - 150, i - 6, 'tief', tol)
    if (cluster === null) return null
    const level = cluster.preis
    if (close < level * (1 - tol) || close > level * (1 + tol)) return null
    if (c[i - 1].close <= level * (1 + tol)) return null // erster Eintritt
    if (maxHigh(c, i - 30, i - 1) < level * (1 + 4 * tol)) return null // kam von weiter oben
    if (gebrochenSeit(c, cluster.indizes, i, (b) => b.close < level * (1 - 2 * tol))) return null
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
      merkmale: [
        `Zone um ~${runde(level)} $: ${cluster.indizes.length}× als Unterstützung gehalten (Swing-Tiefs auf gleicher Höhe).`,
        'Der Kurs kommt von deutlich weiter oben — kein Dauer-Geknabber an der Zone.',
        'Jetzt der erste Eintritt in die Zone: Long mit Stop knapp darunter.',
      ],
      ebenen: [{ preis: level, text: 'Unterstützung' }],
      punkte: alsPunkte(cluster.indizes, 'Tief', false),
      staerke: cluster.indizes.length,
    }
  }
  const cluster = bestaetigtesLevel(c, i - 150, i - 6, 'hoch', tol)
  if (cluster === null) return null
  const level = cluster.preis
  if (close > level * (1 + tol) || close < level * (1 - tol)) return null
  if (c[i - 1].close >= level * (1 - tol)) return null
  if (minLow(c, i - 30, i - 1) > level * (1 - 4 * tol)) return null
  if (gebrochenSeit(c, cluster.indizes, i, (b) => b.close > level * (1 + 2 * tol))) return null
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
    merkmale: [
      `Zone um ~${runde(level)} $: ${cluster.indizes.length}× als Widerstand gehalten (Swing-Hochs auf gleicher Höhe).`,
      'Der Kurs kommt von deutlich weiter unten — ein frischer Anlauf.',
      'Jetzt der erste Eintritt in die Zone: Short mit Stop knapp darüber.',
    ],
    ebenen: [{ preis: level, text: 'Widerstand' }],
    punkte: alsPunkte(cluster.indizes, 'Hoch', true),
    staerke: cluster.indizes.length,
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
      merkmale: [
        'EMA 20 liegt seit über 30 Kerzen über der EMA 50 — intakter Aufwärtstrend.',
        `Höheres Hoch bei ~${runde(hoch)} $: Der Trend hat sich gerade erst bestätigt.`,
        'Jetzt der erste Rücksetzer an die EMA 20 — Einstieg in Trendrichtung, Stop unter das letzte Swing-Tief.',
      ],
      ebenen: [],
      punkte: [{ index: argMax(c, i - 40, i - 1), text: 'höheres Hoch', oben: true }],
      emaPerioden: [20, 50],
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
    merkmale: [
      'EMA 20 liegt seit über 30 Kerzen unter der EMA 50 — intakter Abwärtstrend.',
      `Tieferes Tief bei ~${runde(tief)} $: Der Trend hat sich gerade erst bestätigt.`,
      'Jetzt die erste Erholung an die EMA 20 — Short in Trendrichtung, Stop über das letzte Swing-Hoch.',
    ],
    ebenen: [],
    punkte: [{ index: argMin(c, i - 40, i - 1), text: 'tieferes Tief', oben: false }],
    emaPerioden: [20, 50],
  }
}

// ── Suche & Szenario ─────────────────────────────────────────────────────────

/** Alle Detektoren an einem Index, in Prioritätsreihenfolge. */
export function erkenneAn(c: Candle[], i: number): ErkanntesSetup | null {
  return (
    erkenneBreakoutRetest(c, i, 'long') ??
    erkenneBreakoutRetest(c, i, 'short') ??
    erkenneLiquiditySweep(c, i, 'long') ??
    erkenneLiquiditySweep(c, i, 'short') ??
    erkenneRangeBounce(c, i, 'long') ??
    erkenneRangeBounce(c, i, 'short') ??
    erkenneSrBounce(c, i, 'long') ??
    erkenneSrBounce(c, i, 'short') ??
    erkenneTrendPullback(c, i, 'long') ??
    erkenneTrendPullback(c, i, 'short')
  )
}

/** Längste Rückschau aller Detektoren (Breakout: 250 + 120 Bars) plus Reserve für die EMAs. */
export const ERKENNUNG_RUECKSCHAU = 420

/**
 * Wie erkenneAn, rechnet aber nur auf einem Fenster vor dem Index — die Kosten
 * hängen dann nicht von der Länge des Abschnitts ab (wichtig für lange
 * Simulator-Sitzungen). Indizes im Ergebnis beziehen sich auf `c`.
 */
export function erkenneImFenster(c: Candle[], i: number): ErkanntesSetup | null {
  const von = Math.max(0, i - ERKENNUNG_RUECKSCHAU)
  const s = erkenneAn(c.slice(von, i + 1), i - von)
  if (!s || von === 0) return s
  return {
    ...s,
    signalIndex: s.signalIndex + von,
    entryZone: { ...s.entryZone, barVon: s.entryZone.barVon + von, barBis: s.entryZone.barBis + von },
    punkte: s.punkte.map((p) => ({ ...p, index: p.index + von })),
  }
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
