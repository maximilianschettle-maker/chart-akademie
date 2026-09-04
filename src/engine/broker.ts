import type { Candle, Order, Position, Trade } from '../types'

// Reiner, immutabler Broker: Jede Funktion nimmt einen Zustand und gibt einen
// neuen zurück. Bewusste didaktische Vereinfachungen:
//  - genau eine Position gleichzeitig, kein Hedging
//  - Market-Orders füllen am Open der NÄCHSTEN Bar (kein Blick in die Zukunft)
//  - SL und TP in derselben Kerze berührt → SL zählt zuerst (konservativ)

export const TAKER_GEBUEHR = 0.0005 // 0,05 % je Seite

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

function tradeAbschliessen(
  z: BrokerZustand,
  pos: Position,
  exitPreis: number,
  exitTime: number,
  exitGrund: Trade['exitGrund'],
  szenarioId?: string,
): BrokerZustand {
  const brutto =
    pos.richtung === 'long'
      ? (exitPreis - pos.entryPreis) * pos.menge
      : (pos.entryPreis - exitPreis) * pos.menge
  const gebuehr = (pos.entryPreis + exitPreis) * pos.menge * TAKER_GEBUEHR
  const pnl = brutto - gebuehr
  const risiko = Math.abs(pos.entryPreis - pos.stopLoss) * pos.menge
  const rMultiple = risiko > 0 ? pnl / risiko : 0

  const trade: Trade = {
    id: `${pos.entryTime}-${exitTime}`,
    richtung: pos.richtung,
    entryPreis: pos.entryPreis,
    exitPreis,
    entryTime: pos.entryTime,
    exitTime,
    menge: pos.menge,
    stopLoss: pos.stopLoss,
    takeProfit: pos.takeProfit,
    pnl,
    rMultiple,
    exitGrund,
    szenarioId,
  }
  return {
    ...z,
    kontostand: z.kontostand + pnl,
    position: null,
    trades: [...z.trades, trade],
  }
}

export function positionSchliessen(
  z: BrokerZustand,
  preis: number,
  time: number,
  grund: Trade['exitGrund'] = 'manuell',
  szenarioId?: string,
): BrokerZustand {
  if (!z.position) return z
  return tradeAbschliessen(z, z.position, preis, time, grund, szenarioId)
}

/** Prüft SL/TP einer offenen Position gegen eine Kerze (SL-zuerst-Regel). */
function slTpPruefen(z: BrokerZustand, bar: Candle, szenarioId?: string): BrokerZustand {
  const pos = z.position
  if (!pos) return z
  if (pos.richtung === 'long') {
    if (bar.low <= pos.stopLoss) return tradeAbschliessen(z, pos, pos.stopLoss, bar.time, 'sl', szenarioId)
    if (bar.high >= pos.takeProfit) return tradeAbschliessen(z, pos, pos.takeProfit, bar.time, 'tp', szenarioId)
  } else {
    if (bar.high >= pos.stopLoss) return tradeAbschliessen(z, pos, pos.stopLoss, bar.time, 'sl', szenarioId)
    if (bar.low <= pos.takeProfit) return tradeAbschliessen(z, pos, pos.takeProfit, bar.time, 'tp', szenarioId)
  }
  return z
}

/**
 * Verarbeitet eine neue Bar: erst Order-Fills, dann SL/TP der Position.
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
      fillPreis = bar.open
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
        },
      }
    }
  }

  return slTpPruefen(zustand, bar, szenarioId)
}

/** Unrealisierter Gewinn/Verlust der offenen Position zum gegebenen Preis. */
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
