import type { Candle, ExitGrund, Order, Position, Trade } from '../types'

// Reiner, immutabler Broker: Jede Funktion nimmt einen Zustand und gibt einen
// neuen zurück. Bewusste Vereinfachungen:
//  - genau eine Position gleichzeitig, kein Hedging
//  - Market-Orders füllen am Open der NÄCHSTEN Bar (barVerarbeiten) oder sofort
//    zum aktuellen Kurs (marketSofort) — beides ohne Blick in die Zukunft
//  - Limit wartet auf einen besseren Preis (Maker-Gebühr, keine Slippage),
//    Stop-Entry löst beim Durchbruch aus (Taker-Gebühr, Slippage)
//  - Eröffnet eine Kerze jenseits eines Levels (Gap), zählt der Eröffnungskurs:
//    schlechter beim Stop, besser beim Limit/Take-Profit
//  - SL und TP in derselben Kerze berührt → SL zählt zuerst (konservativ)
//  - Funding: pauschal 0,01 % je 8 h auf den Positionswert, Long zahlt
//    (langjähriger Durchschnitt; echtes Funding schwankt — siehe Level 3)
//  - Trailing-Stop wird nach jeder Bar nachgezogen (nie innerhalb der Bar)

export const TAKER_GEBUEHR = 0.0005 // 0,05 % je Seite
export const MAKER_GEBUEHR = 0.0002 // 0,02 % — Limit-Einstieg und Take-Profit
export const SLIPPAGE = 0.0002 // 0,02 % gegen dich bei Market-Ausführungen
export const FUNDING_RATE = 0.0001 // 0,01 % je Funding-Intervall
export const FUNDING_INTERVALL = 8 * 3600 // Sekunden (00:00, 08:00, 16:00 UTC)

export interface Kosten {
  taker: number
  maker: number
  slippage: number
  /** 0 = Funding aus */
  funding: number
}

export const STANDARD_KOSTEN: Kosten = {
  taker: TAKER_GEBUEHR,
  maker: MAKER_GEBUEHR,
  slippage: SLIPPAGE,
  funding: FUNDING_RATE,
}

export interface BrokerZustand {
  kontostand: number
  offeneOrder: Order | null
  position: Position | null
  trades: Trade[]
  /** Fehlt → STANDARD_KOSTEN */
  kosten?: Kosten
}

export function neuerBroker(startKapital: number, kosten?: Kosten): BrokerZustand {
  return { kontostand: startKapital, offeneOrder: null, position: null, trades: [], kosten }
}

function kostenVon(z: BrokerZustand): Kosten {
  return z.kosten ?? STANDARD_KOSTEN
}

export function orderPlatzieren(z: BrokerZustand, order: Order): BrokerZustand {
  if (z.position || z.offeneOrder) return z
  return { ...z, offeneOrder: order }
}

export function orderStornieren(z: BrokerZustand): BrokerZustand {
  return { ...z, offeneOrder: null }
}

/** Wartende Order nachträglich ändern (Preis, SL, TP) — z.B. per Ziehen im Chart. */
export function orderAendern(
  z: BrokerZustand,
  neu: { limitPreis?: number; stopLoss?: number; takeProfit?: number },
): BrokerZustand {
  const o = z.offeneOrder
  if (!o) return z
  const order = { ...o, ...neu }
  const entry = order.limitPreis
  if (entry !== undefined) {
    const slOk = order.richtung === 'long' ? order.stopLoss < entry : order.stopLoss > entry
    const tpOk =
      order.takeProfit <= 0 ||
      (order.richtung === 'long' ? order.takeProfit > entry : order.takeProfit < entry)
    if (!slOk || !tpOk) return z
  }
  return { ...z, offeneOrder: order }
}

/** Market-Ausführungspreis inkl. Slippage — immer zu Ungunsten des Traders.
 *  kaufen=true: wir kaufen (Long-Entry oder Short-Exit) und zahlen etwas mehr. */
function mitSlippage(preis: number, kaufen: boolean, slippage: number): number {
  return preis * (kaufen ? 1 + slippage : 1 - slippage)
}

function positionAus(order: Order, fillPreis: number, time: number, entryGebuehr: number): Position {
  return {
    richtung: order.richtung,
    entryPreis: fillPreis,
    entryTime: time,
    menge: order.menge,
    stopLoss: order.stopLoss,
    takeProfit: order.takeProfit,
    trailingAbstand: order.trailingAbstand,
    extremum: fillPreis,
    risikoBetrag: Math.abs(fillPreis - order.stopLoss) * order.menge,
    fundingKosten: 0,
    strategieId: order.strategieId,
    entryGebuehr,
    risikoAbstand: Math.abs(fillPreis - order.stopLoss),
    bestPreis: fillPreis,
    schlechtestPreis: fillPreis,
    notiz: order.notiz,
  }
}

/**
 * Market-Order sofort zum aktuellen Kurs ausführen (Schlusskurs der letzten
 * sichtbaren Kerze). Kein Blick in die Zukunft: Der Kurs ist bereits bekannt.
 */
export function marketSofort(z: BrokerZustand, order: Order, preis: number, time: number): BrokerZustand {
  if (z.position || z.offeneOrder) return z
  const k = kostenVon(z)
  const fill = mitSlippage(preis, order.richtung === 'long', k.slippage)
  return { ...z, position: positionAus(order, fill, time, k.taker) }
}

/**
 * Schließt einen Anteil (0 < anteil ≤ 1) der Position und bucht den Trade.
 * Gebühren fallen auf den geschlossenen Teil an; Funding wird anteilig zugeordnet.
 * R-Multiple bezieht sich auf das URSPRÜNGLICHE Gesamtrisiko, damit sich die
 * Teil-Trades eines Einstiegs zu einem sinnvollen Gesamt-R addieren.
 */
function teilAbschliessen(
  z: BrokerZustand,
  pos: Position,
  anteil: number,
  exitPreis: number,
  exitTime: number,
  exitGrund: ExitGrund,
  szenarioId?: string,
): BrokerZustand {
  const k = kostenVon(z)
  const menge = Math.min(pos.menge, pos.menge * anteil)
  const brutto =
    pos.richtung === 'long'
      ? (exitPreis - pos.entryPreis) * menge
      : (pos.entryPreis - exitPreis) * menge
  const exitGebuehr = exitGrund === 'tp' ? k.maker : k.taker
  const gebuehren =
    pos.entryPreis * menge * (pos.entryGebuehr ?? k.taker) + exitPreis * menge * exitGebuehr
  const funding = pos.fundingKosten * (menge / pos.menge)
  const pnl = brutto - gebuehren - funding
  const rMultiple = pos.risikoBetrag > 0 ? pnl / pos.risikoBetrag : 0

  // MFE/MAE in R: wie weit lief der Kurs maximal für bzw. gegen die Position?
  let mfeR: number | undefined
  let maeR: number | undefined
  if (pos.risikoAbstand && pos.risikoAbstand > 0) {
    const long = pos.richtung === 'long'
    const best = long
      ? Math.max(pos.bestPreis ?? pos.entryPreis, exitPreis)
      : Math.min(pos.bestPreis ?? pos.entryPreis, exitPreis)
    const schlecht = long
      ? Math.min(pos.schlechtestPreis ?? pos.entryPreis, exitPreis)
      : Math.max(pos.schlechtestPreis ?? pos.entryPreis, exitPreis)
    mfeR = Math.max(0, (long ? best - pos.entryPreis : pos.entryPreis - best) / pos.risikoAbstand)
    maeR = Math.max(0, (long ? pos.entryPreis - schlecht : schlecht - pos.entryPreis) / pos.risikoAbstand)
  }

  const trade: Trade = {
    id: `${pos.entryTime}-${exitTime}-${exitGrund}-${z.trades.length}`,
    richtung: pos.richtung,
    entryPreis: pos.entryPreis,
    exitPreis,
    entryTime: pos.entryTime,
    exitTime,
    menge,
    stopLoss: pos.stopLoss,
    takeProfit: pos.takeProfit,
    pnl,
    rMultiple,
    exitGrund,
    szenarioId,
    gebuehren,
    funding,
    strategieId: pos.strategieId,
    mfeR,
    maeR,
    notiz: pos.notiz,
  }

  const rest = pos.menge - menge
  const positionRest: Position | null =
    rest > 1e-12 ? { ...pos, menge: rest, fundingKosten: pos.fundingKosten - funding } : null

  return {
    ...z,
    kontostand: z.kontostand + pnl,
    position: positionRest,
    trades: [...z.trades, trade],
  }
}

export function positionSchliessen(
  z: BrokerZustand,
  preis: number,
  time: number,
  grund: ExitGrund = 'manuell',
  szenarioId?: string,
): BrokerZustand {
  const pos = z.position
  if (!pos) return z
  const exit = mitSlippage(preis, pos.richtung === 'short', kostenVon(z).slippage)
  return teilAbschliessen(z, pos, 1, exit, time, grund, szenarioId)
}

/** Teilverkauf: schließt `anteil` (z.B. 0,5) der offenen Position zum Marktpreis. */
export function teilSchliessen(
  z: BrokerZustand,
  anteil: number,
  preis: number,
  time: number,
  szenarioId?: string,
): BrokerZustand {
  const pos = z.position
  if (!pos || anteil <= 0) return z
  if (anteil >= 1) return positionSchliessen(z, preis, time, 'manuell', szenarioId)
  const exit = mitSlippage(preis, pos.richtung === 'short', kostenVon(z).slippage)
  return teilAbschliessen(z, pos, anteil, exit, time, 'teil', szenarioId)
}

/**
 * SL und/oder TP einer offenen Position ändern. Ein SL/TP auf der falschen Seite
 * des aktuellen Kurses wird abgelehnt (würde sofort auslösen) — Zustand bleibt gleich.
 * takeProfit 0 entfernt den Take-Profit.
 */
export function stopsAendern(
  z: BrokerZustand,
  aktuellerPreis: number,
  neu: { stopLoss?: number; takeProfit?: number; trailingAbstand?: number | null },
): BrokerZustand {
  const pos = z.position
  if (!pos) return z
  let stopLoss = pos.stopLoss
  let takeProfit = pos.takeProfit
  if (neu.stopLoss !== undefined) {
    const ok = pos.richtung === 'long' ? neu.stopLoss < aktuellerPreis : neu.stopLoss > aktuellerPreis
    if (!ok) return z
    stopLoss = neu.stopLoss
  }
  if (neu.takeProfit !== undefined) {
    const ok =
      neu.takeProfit <= 0 ||
      (pos.richtung === 'long' ? neu.takeProfit > aktuellerPreis : neu.takeProfit < aktuellerPreis)
    if (!ok) return z
    takeProfit = Math.max(0, neu.takeProfit)
  }
  let trailingAbstand = pos.trailingAbstand
  if (neu.trailingAbstand === null) trailingAbstand = undefined
  else if (neu.trailingAbstand !== undefined) trailingAbstand = neu.trailingAbstand
  return { ...z, position: { ...pos, stopLoss, takeProfit, trailingAbstand } }
}

/** SL auf den Einstiegskurs ziehen („Break-even“) — der Klassiker nach +1R. */
export function breakEven(z: BrokerZustand, aktuellerPreis: number): BrokerZustand {
  const pos = z.position
  if (!pos) return z
  return stopsAendern(z, aktuellerPreis, { stopLoss: pos.entryPreis })
}

/** Prüft SL/TP einer offenen Position gegen eine Kerze (SL-zuerst-Regel, Gaps zum Open). */
function slTpPruefen(z: BrokerZustand, bar: Candle, szenarioId?: string): BrokerZustand {
  const pos = z.position
  if (!pos) return z
  const slippage = kostenVon(z).slippage
  const slGrund: ExitGrund = pos.trailingAbstand ? 'trailing' : 'sl'
  const hatTp = pos.takeProfit > 0
  if (pos.richtung === 'long') {
    if (bar.low <= pos.stopLoss) {
      const preis = mitSlippage(Math.min(pos.stopLoss, bar.open), false, slippage)
      return teilAbschliessen(z, pos, 1, preis, bar.time, slGrund, szenarioId)
    }
    if (hatTp && bar.high >= pos.takeProfit)
      return teilAbschliessen(z, pos, 1, Math.max(pos.takeProfit, bar.open), bar.time, 'tp', szenarioId)
  } else {
    if (bar.high >= pos.stopLoss) {
      const preis = mitSlippage(Math.max(pos.stopLoss, bar.open), true, slippage)
      return teilAbschliessen(z, pos, 1, preis, bar.time, slGrund, szenarioId)
    }
    if (hatTp && bar.low <= pos.takeProfit)
      return teilAbschliessen(z, pos, 1, Math.min(pos.takeProfit, bar.open), bar.time, 'tp', szenarioId)
  }
  return z
}

/** Trailing-Stop nachziehen — nur in Gewinnrichtung, nie zurück. */
function trailingNachziehen(pos: Position, bar: Candle): Position {
  if (!pos.trailingAbstand) return pos
  if (pos.richtung === 'long') {
    const extremum = Math.max(pos.extremum, bar.high)
    return { ...pos, extremum, stopLoss: Math.max(pos.stopLoss, extremum - pos.trailingAbstand) }
  }
  const extremum = Math.min(pos.extremum, bar.low)
  return { ...pos, extremum, stopLoss: Math.min(pos.stopLoss, extremum + pos.trailingAbstand) }
}

/** Bester/schlechtester Kurs seit Entry fortschreiben (Basis für MFE/MAE). */
function extremeMerken(pos: Position, bar: Candle): Position {
  const long = pos.richtung === 'long'
  const best = pos.bestPreis ?? pos.entryPreis
  const schlecht = pos.schlechtestPreis ?? pos.entryPreis
  return {
    ...pos,
    bestPreis: long ? Math.max(best, bar.high) : Math.min(best, bar.low),
    schlechtestPreis: long ? Math.min(schlecht, bar.low) : Math.max(schlecht, bar.high),
  }
}

/** Funding fällig? Alle 8 h (Kerzen-Startzeit auf dem Intervall). Long zahlt, Short kassiert. */
function fundingVerbuchen(pos: Position, bar: Candle, rate: number): Position {
  if (rate === 0 || bar.time % FUNDING_INTERVALL !== 0 || bar.time === pos.entryTime) return pos
  const betrag = pos.menge * bar.close * rate
  return { ...pos, fundingKosten: pos.fundingKosten + (pos.richtung === 'long' ? betrag : -betrag) }
}

/** Füllt die wartende Order an dieser Bar? Liefert Preis und Gebührensatz, sonst null. */
function orderFill(order: Order, bar: Candle, k: Kosten): { preis: number; gebuehr: number } | null {
  const long = order.richtung === 'long'
  if (order.typ === 'market') {
    return { preis: mitSlippage(bar.open, long, k.slippage), gebuehr: k.taker }
  }
  const level = order.limitPreis
  if (level === undefined) return null
  if (order.typ === 'limit') {
    // Kaufen bei Level oder günstiger — eröffnet die Kerze schon darunter, gilt das Open
    if (long ? bar.low <= level : bar.high >= level) {
      return { preis: long ? Math.min(level, bar.open) : Math.max(level, bar.open), gebuehr: k.maker }
    }
    return null
  }
  // Stop-Entry: Einstieg beim Durchbruch, läuft als Market
  if (long ? bar.high >= level : bar.low <= level) {
    const roh = long ? Math.max(level, bar.open) : Math.min(level, bar.open)
    return { preis: mitSlippage(roh, long, k.slippage), gebuehr: k.taker }
  }
  return null
}

/**
 * Verarbeitet eine neue Bar: erst Order-Fills, dann SL/TP der Position,
 * dann Trailing und Funding für die (noch) offene Position.
 * Wird vom Replay für jede neue sichtbare Kerze genau einmal aufgerufen.
 */
export function barVerarbeiten(
  z: BrokerZustand,
  bar: Candle,
  szenarioId?: string,
): BrokerZustand {
  let zustand = z
  const k = kostenVon(z)

  const order = zustand.offeneOrder
  let geradeGefuellt = false
  if (order && !zustand.position) {
    const fill = orderFill(order, bar, k)
    if (fill) {
      zustand = {
        ...zustand,
        offeneOrder: null,
        position: positionAus(order, fill.preis, bar.time, fill.gebuehr),
      }
      // Market füllt am Open → die ganze Kerze liegt nach dem Einstieg
      geradeGefuellt = order.typ !== 'market'
    }
  }

  zustand = slTpPruefen(zustand, bar, szenarioId)
  if (zustand.position) {
    let pos = trailingNachziehen(zustand.position, bar)
    if (!geradeGefuellt) pos = extremeMerken(pos, bar)
    pos = fundingVerbuchen(pos, bar, k.funding)
    zustand = { ...zustand, position: pos }
  }
  return zustand
}

/** Unrealisierter Gewinn/Verlust der offenen Position zum gegebenen Preis (vor Gebühren). */
export function unrealisierterPnl(z: BrokerZustand, preis: number): number {
  const pos = z.position
  if (!pos) return 0
  return pos.richtung === 'long'
    ? (preis - pos.entryPreis) * pos.menge
    : (pos.entryPreis - preis) * pos.menge
}

/** Positionsgröße aus Risiko-Betrag und SL-Abstand (Kernidee aus Level 2). */
export function mengeAusRisiko(
  risikoBetrag: number,
  entryPreis: number,
  stopLoss: number,
): number {
  const abstand = Math.abs(entryPreis - stopLoss)
  if (abstand <= 0) return 0
  return risikoBetrag / abstand
}
