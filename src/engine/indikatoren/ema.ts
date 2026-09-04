import type { Candle } from '../../types'

/**
 * Exponentieller gleitender Durchschnitt über die Schlusskurse.
 * Ergebnis ist am Kerzen-Array ausgerichtet; die ersten (periode-1) Werte sind NaN.
 */
export function ema(candles: Candle[], periode: number): number[] {
  const ergebnis = new Array<number>(candles.length).fill(NaN)
  if (candles.length < periode) return ergebnis

  let summe = 0
  for (let i = 0; i < periode; i++) summe += candles[i].close
  let wert = summe / periode
  ergebnis[periode - 1] = wert

  const k = 2 / (periode + 1)
  for (let i = periode; i < candles.length; i++) {
    wert = candles[i].close * k + wert * (1 - k)
    ergebnis[i] = wert
  }
  return ergebnis
}
