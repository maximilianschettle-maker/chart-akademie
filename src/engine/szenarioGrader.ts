import type { Candle, Scenario, SzenarioBewertung, Trade } from '../types'

export interface SzenarioResultat {
  bewertung: SzenarioBewertung
  text: string
  rMultiple: number
}

const MIN_CRV = 1.5

/**
 * Bewertet eine abgeschlossene geführte Übung anhand des ERSTEN Trades:
 *  - kein Trade                          → verpasst
 *  - falsche Richtung / außerhalb Zone   → falsch
 *  - in der Zone, SL richtig, CRV ≥ 1,5  → perfekt
 *  - in der Zone, Rest unsauber          → ok
 */
export function bewerteSzenario(
  szenario: Scenario,
  candles: Candle[],
  trades: Trade[],
): SzenarioResultat {
  const trade = trades[0]
  if (!trade) {
    return { bewertung: 'verpasst', text: szenario.feedback.verpasst, rMultiple: 0 }
  }

  const entryIndex = candles.findIndex((c) => c.time === trade.entryTime)
  const zone = szenario.entryZone
  const inZone =
    trade.richtung === szenario.richtung &&
    entryIndex >= zone.barVon &&
    entryIndex <= zone.barBis &&
    trade.entryPreis >= zone.preisVon &&
    trade.entryPreis <= zone.preisBis

  if (!inZone) {
    return { bewertung: 'falsch', text: szenario.feedback.falsch, rMultiple: trade.rMultiple }
  }

  const slRichtig =
    szenario.richtung === 'long'
      ? trade.stopLoss < trade.entryPreis
      : trade.stopLoss > trade.entryPreis
  const risiko = Math.abs(trade.entryPreis - trade.stopLoss)
  const chance = Math.abs(trade.takeProfit - trade.entryPreis)
  const crv = risiko > 0 ? chance / risiko : 0

  if (slRichtig && crv >= MIN_CRV) {
    return { bewertung: 'perfekt', text: szenario.feedback.perfekt, rMultiple: trade.rMultiple }
  }
  return { bewertung: 'ok', text: szenario.feedback.ok, rMultiple: trade.rMultiple }
}
