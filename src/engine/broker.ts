import type { Candle, ExitGrund, Order, Position, Trade } from '../types'

// Reiner, immutabler Broker: Jede Funktion nimmt einen Zustand und gibt einen
// neuen zurück. Bewusste didaktische Vereinfachungen:
//  - genau eine Position gleichzeitig, kein Hedging
//  - Market-Orders füllen am Open der NÄCHSTEN Bar (kein Blick in die Zukunft)
//  - SL und TP in derselben Kerze berührt → SL zählt zuerst (konservativ)
//  - Slippage nur auf Market-Fills und Stop-Ausführungen (die laufen als Market),
//    nicht auf Limit-Fills und Take-Profit (die liegen als Limit im Buch)
//  - Funding: pauschal 0,01 % je 8 h auf den Positionswert, Long zahlt
//    (langjähriger Durchschnitt; echtes Funding schwankt — siehe Level 3)
//  - Trailing-Stop wird nach jeder Bar nachgezogen (nie innerhalb der Bar)

export const TAKER_GEBUEHR = 0.0005 // 0,05 % je Seite
export const SLIPPAGE = 0.0002 // 0,02 % gegen dich bei Market-Ausführungen
export const FUNDING_RATE = 0.0001 // 0,01 % je Funding-Intervall
export const FUNDING_INTERVALL = 8 * 3600 // Sekunden (00:00, 08:00, 16:00 UTC)

export interface BrokerZustand {
  kontostand: number
  offeneOrder: Order | null
  position: Position | null
  trades: Trade[]
}

export function neuerBroker(startKapital: number): BrokerZustand {
  return { kontostand: startKapital, offeneOrder: null, position: null, trades: [] }
}

export function orderPlatzieren(z: BrokerZustand, order: Order): BrokerZustand {
  if (z.position || z.offeneOrder) return z
  return { ...z, offeneOrder: order }
}

export function orderStornieren(z: BrokerZustand): BrokerZustand {
  return { ...z, offeneOrder: null }
}

/** Market-Ausführungspreis inkl. Slippage — immer zu Ungunsten des Traders.
 *  kaufen=true: wir kaufen (Long-Entry oder Short-Exit) und zahlen etwas mehr. */
function mitSlippage(preis: number, kaufen: boolean): number {
  return preis * (kaufen ? 1 + SLIPPAGE : 1 - SLIPPAGE)
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
  const menge = Math.min(pos.menge, pos.menge * anteil)
  const brutto =
    pos.richtung === 'long'
      ? (exitPreis - pos.entryPreis) * menge
      : (pos.entryPreis - exitPreis) * menge
  const gebuehren = (pos.entryPreis + exitPreis) * menge * TAKER_GEBUEHR
  const funding = pos.fundingKosten * (menge / pos.menge)
  const pnl = brutto - gebuehren - funding
  const rMultiple = pos.risikoBetrag > 0 ? pnl / pos.risikoBetrag : 0

  const trade: Trade = {
    id: `${pos.entryTime}-${exitTime}-${exitGrund}`,
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
  const exit = mitSlippage(preis, pos.richtung === 'short')
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
  const exit = mitSlippage(preis, pos.richtung === 'short')
  return teilAbschliessen(z, pos, anteil, exit, time, 'teil', szenarioId)
}

/**
 * SL und/oder TP einer offenen Position ändern. Ein SL/TP auf der falschen Seite
 * des aktuellen Kurses wird abgelehnt (würde sofort auslösen) — Zustand bleibt gleich.
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
    const ok = pos.richtung === 'long' ? neu.takeProfit > aktuellerPreis : neu.takeProfit < aktuellerPreis
    if (!ok) return z
    takeProfit = neu.takeProfit
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

/** Prüft SL/TP einer offenen Position gegen eine Kerze (SL-zuerst-Regel). */
function slTpPruefen(z: BrokerZustand, bar: Candle, szenarioId?: string): BrokerZustand {
  const pos = z.position
  if (!pos) return z
  const slGrund: ExitGrund = pos.trailingAbstand ? 'trailing' : 'sl'
  if (pos.richtung === 'long') {
    if (bar.low <= pos.stopLoss)
      return teilAbschliessen(z, pos, 1, mitSlippage(pos.stopLoss, false), bar.time, slGrund, szenarioId)
    if (bar.high >= pos.takeProfit)
      return teilAbschliessen(z, pos, 1, pos.takeProfit, bar.time, 'tp', szenarioId)
  } else {
    if (bar.high >= pos.stopLoss)
      return teilAbschliessen(z, pos, 1, mitSlippage(pos.stopLoss, true), bar.time, slGrund, szenarioId)
    if (bar.low <= pos.takeProfit)
      return teilAbschliessen(z, pos, 1, pos.takeProfit, bar.time, 'tp', szenarioId)
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

/** Funding fällig? Alle 8 h (Kerzen-Startzeit auf dem Intervall). Long zahlt, Short kassiert. */
function fundingVerbuchen(pos: Position, bar: Candle): Position {
  if (bar.time % FUNDING_INTERVALL !== 0 || bar.time === pos.entryTime) return pos
  const betrag = pos.menge * bar.close * FUNDING_RATE
  return { ...pos, fundingKosten: pos.fundingKosten + (pos.richtung === 'long' ? betrag : -betrag) }
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

  const order = zustand.offeneOrder
  if (order && !zustand.position) {
    let fillPreis: number | null = null
    if (order.typ === 'market') {
      fillPreis = mitSlippage(bar.open, order.richtung === 'long')
    } else if (
      order.limitPreis !== undefined &&
      bar.low <= order.limitPreis &&
      order.limitPreis <= bar.high
    ) {
      fillPreis = order.limitPreis
    }
    if (fillPreis !== null) {
      zustand = {
        ...zustand,
        offeneOrder: null,
        position: {
          richtung: order.richtung,
          entryPreis: fillPreis,
          entryTime: bar.time,
          menge: order.menge,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
          trailingAbstand: order.trailingAbstand,
          extremum: fillPreis,
          risikoBetrag: Math.abs(fillPreis - order.stopLoss) * order.menge,
          fundingKosten: 0,
          strategieId: order.strategieId,
        },
      }
    }
  }

  zustand = slTpPruefen(zustand, bar, szenarioId)
  if (zustand.position) {
    let pos = trailingNachziehen(zustand.position, bar)
    pos = fundingVerbuchen(pos, bar)
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
