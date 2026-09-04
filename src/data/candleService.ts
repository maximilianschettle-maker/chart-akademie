import type { Candle } from '../types'
import { fetchKlinesRange } from './binanceClient'
import { ausCache, inCache, cacheKey } from './candleCache'

/**
 * Zentrale Einstiegsfunktion für Kursdaten.
 * Fallback-Kette: IndexedDB-Cache → Binance (mehrere Hosts).
 * (Bybit-Fallback und statische Szenario-Daten folgen in späteren Phasen.)
 */
export async function getCandles(
  symbol: string,
  interval: string,
  von: number,
  bis: number,
): Promise<Candle[]> {
  const key = cacheKey(symbol, interval, von, bis)

  const gecacht = await ausCache(key)
  if (gecacht && gecacht.length > 0) return gecacht

  const candles = await fetchKlinesRange(symbol, interval, von, bis)
  if (candles.length > 0) await inCache(key, candles)
  return candles
}
