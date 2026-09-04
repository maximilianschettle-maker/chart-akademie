import type { Candle } from '../types'
import { fetchKlinesRange } from './binanceClient'
import { fetchBybitKlinesRange } from './bybitClient'
import { ausCache, inCache, cacheKey } from './candleCache'

/**
 * Zentrale Einstiegsfunktion für Kursdaten.
 * Fallback-Kette: IndexedDB-Cache → Binance (mehrere Hosts) → Bybit.
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

  let candles: Candle[]
  try {
    candles = await fetchKlinesRange(symbol, interval, von, bis)
  } catch (binanceFehler) {
    try {
      candles = await fetchBybitKlinesRange(symbol, interval, von, bis)
    } catch {
      throw binanceFehler
    }
  }
  if (candles.length > 0) await inCache(key, candles)
  return candles
}
