import type { Candle } from '../types'

/** Kerzenintervall in Sekunden — kleinster Abstand zweier aufeinanderfolgender Bars. */
export function intervalSekunden(candles: Candle[]): number {
  let min = Infinity
  for (let i = 1; i < Math.min(candles.length, 50); i++) {
    const d = candles[i].time - candles[i - 1].time
    if (d > 0 && d < min) min = d
  }
  return Number.isFinite(min) ? min : 60
}

/** Start des Buckets, in dem die Bar liegt (zeitbasiert, robust gegen Datenlücken). */
export function bucketStart(time: number, bucketSek: number): number {
  return Math.floor(time / bucketSek) * bucketSek
}

/**
 * Fasst Kerzen zu einem höheren Timeframe zusammen (z.B. 15m → 1h bei bucketSek=3600).
 * Die letzte Bucket-Kerze ist ggf. „unfertig“ — genau wie im Live-Chart.
 */
export function aggregiere(candles: Candle[], bucketSek: number): Candle[] {
  const ergebnis: Candle[] = []
  for (const c of candles) {
    const start = bucketStart(c.time, bucketSek)
    const letzte = ergebnis[ergebnis.length - 1]
    if (letzte && letzte.time === start) {
      letzte.high = Math.max(letzte.high, c.high)
      letzte.low = Math.min(letzte.low, c.low)
      letzte.close = c.close
      letzte.volume += c.volume
    } else {
      ergebnis.push({ ...c, time: start })
    }
  }
  return ergebnis
}

/** Sinnvolle höhere Timeframes je Basis-Intervall (Anzeige-Label → Sekunden). */
export const HOEHERE_TIMEFRAMES: Record<string, { label: string; sek: number }[]> = {
  '5m': [
    { label: '15m', sek: 900 },
    { label: '1h', sek: 3600 },
  ],
  '15m': [
    { label: '1h', sek: 3600 },
    { label: '4h', sek: 14400 },
  ],
  '1h': [
    { label: '4h', sek: 14400 },
    { label: '1D', sek: 86400 },
  ],
  '4h': [
    { label: '1D', sek: 86400 },
    { label: '1W', sek: 604800 },
  ],
}
