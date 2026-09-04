import type { Candle } from '../../types'

/**
 * Relative Strength Index nach Wilder. Am Kerzen-Array ausgerichtet;
 * die ersten `periode` Werte sind NaN.
 */
export function rsi(candles: Candle[], periode = 14): number[] {
  const ergebnis = new Array<number>(candles.length).fill(NaN)
  if (candles.length <= periode) return ergebnis

  let gewinn = 0
  let verlust = 0
  for (let i = 1; i <= periode; i++) {
    const diff = candles[i].close - candles[i - 1].close
    if (diff >= 0) gewinn += diff
    else verlust -= diff
  }
  let avgGewinn = gewinn / periode
  let avgVerlust = verlust / periode
  ergebnis[periode] = avgVerlust === 0 ? 100 : 100 - 100 / (1 + avgGewinn / avgVerlust)

  for (let i = periode + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close
    avgGewinn = (avgGewinn * (periode - 1) + Math.max(0, diff)) / periode
    avgVerlust = (avgVerlust * (periode - 1) + Math.max(0, -diff)) / periode
    ergebnis[i] = avgVerlust === 0 ? 100 : 100 - 100 / (1 + avgGewinn / avgVerlust)
  }
  return ergebnis
}
