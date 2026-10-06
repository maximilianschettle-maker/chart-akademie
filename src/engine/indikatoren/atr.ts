import type { Candle } from '../../types'

/**
 * Average True Range nach Wilder. Am Kerzen-Array ausgerichtet;
 * die ersten `periode` Werte sind NaN.
 */
export function atr(candles: Candle[], periode = 14): number[] {
  const ergebnis = new Array<number>(candles.length).fill(NaN)
  if (candles.length <= periode) return ergebnis

  const tr = (i: number) => {
    const c = candles[i]
    const vorher = candles[i - 1].close
    return Math.max(c.high - c.low, Math.abs(c.high - vorher), Math.abs(c.low - vorher))
  }

  let summe = 0
  for (let i = 1; i <= periode; i++) summe += tr(i)
  let wert = summe / periode
  ergebnis[periode] = wert
  for (let i = periode + 1; i < candles.length; i++) {
    wert = (wert * (periode - 1) + tr(i)) / periode
    ergebnis[i] = wert
  }
  return ergebnis
}

/** ATR der letzten Kerze eines (kurzen) Fensters — für SL-Vorschläge im Order-Ticket. */
export function letzterAtr(candles: Candle[], bisIndex: number, periode = 14): number {
  const von = Math.max(0, bisIndex - periode * 6)
  const werte = atr(candles.slice(von, bisIndex + 1), periode)
  const letzter = werte[werte.length - 1]
  return Number.isFinite(letzter) ? letzter : 0
}
