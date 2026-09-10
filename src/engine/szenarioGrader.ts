import type { Candle, Scenario, SzenarioBewertung, Trade } from '../types'

export interface SzenarioResultat {
  bewertung: SzenarioBewertung
  text: string
  rMultiple: number
}

const MIN_CRV = 1.5

/** Gesamt-R des ersten Einstiegs (Teilverkäufe desselben Entries werden addiert). */
function gesamtR(trades: Trade[]): number {
  const erster = trades[0]
  if (!erster) return 0
  return trades
    .filter((t) => t.entryTime === erster.entryTime && t.richtung === erster.richtung)
    .reduce((s, t) => s + t.rMultiple, 0)
}

/**
 * Bewertet eine abgeschlossene geführte Übung anhand des ERSTEN Einstiegs:
 *
 * Setup-Szenario (richtung long/short):
 *  - kein Trade                          → verpasst
 *  - falsche Richtung / außerhalb Zone   → falsch
 *  - in der Zone, SL richtig, CRV ≥ 1,5  → perfekt
 *  - in der Zone, Rest unsauber          → ok
 *
 * Kein-Trade-Szenario (richtung 'keiner'):
 *  - kein Trade                          → perfekt
 *  - Trade in alternativRichtung         → ok
 *  - jeder andere Trade                  → falsch
 */
export function bewerteSzenario(
  szenario: Scenario,
  candles: Candle[],
  trades: Trade[],
): SzenarioResultat {
  const trade = trades[0]
  const r = gesamtR(trades)

  if (szenario.richtung === 'keiner') {
    if (!trade) return { bewertung: 'perfekt', text: szenario.feedback.perfekt, rMultiple: 0 }
    if (szenario.alternativRichtung && trade.richtung === szenario.alternativRichtung) {
      return { bewertung: 'ok', text: szenario.feedback.ok, rMultiple: r }
    }
    return { bewertung: 'falsch', text: szenario.feedback.falsch, rMultiple: r }
  }

  if (!trade) {
    return { bewertung: 'verpasst', text: szenario.feedback.verpasst, rMultiple: 0 }
  }

  const zone = szenario.entryZone
  const entryIndex = candles.findIndex((c) => c.time === trade.entryTime)
  const inZone =
    !!zone &&
    trade.richtung === szenario.richtung &&
    entryIndex >= zone.barVon &&
    entryIndex <= zone.barBis &&
    trade.entryPreis >= zone.preisVon &&
    trade.entryPreis <= zone.preisBis

  if (!inZone) {
    return { bewertung: 'falsch', text: szenario.feedback.falsch, rMultiple: r }
  }

  const slRichtig =
    szenario.richtung === 'long'
      ? trade.stopLoss < trade.entryPreis
      : trade.stopLoss > trade.entryPreis
  const risiko = Math.abs(trade.entryPreis - trade.stopLoss)
  const chance = Math.abs(trade.takeProfit - trade.entryPreis)
  const crv = risiko > 0 ? chance / risiko : 0

  if (slRichtig && crv >= MIN_CRV) {
    return { bewertung: 'perfekt', text: szenario.feedback.perfekt, rMultiple: r }
  }
  return { bewertung: 'ok', text: szenario.feedback.ok, rMultiple: r }
}
