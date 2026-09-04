import type { Candle } from '../types'

// Fallback-Exchange, falls Binance nicht erreichbar ist (Geo-Blocking etc.).
// Bybit v5 Spot-Klines; Antwort-Liste kommt NEUESTE zuerst.

const INTERVAL_MAP: Record<string, string> = {
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
}

type BybitKline = [string, string, string, string, string, string, string]

export async function fetchBybitKlinesRange(
  symbol: string,
  interval: string,
  von: number,
  bis: number,
): Promise<Candle[]> {
  const bybitInterval = INTERVAL_MAP[interval]
  if (!bybitInterval) throw new Error(`Intervall ${interval} nicht gemappt`)

  const alle: Candle[] = []
  let cursorMs = von * 1000
  const bisMs = bis * 1000

  while (cursorMs <= bisMs) {
    const url =
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}` +
      `&interval=${bybitInterval}&start=${cursorMs}&end=${bisMs}&limit=1000`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`)
    const daten = (await res.json()) as { retCode: number; result?: { list?: BybitKline[] } }
    if (daten.retCode !== 0 || !daten.result?.list) throw new Error('Bybit-Antwort ungültig')

    const chunk = daten.result.list
      .map(
        (k): Candle => ({
          time: Math.floor(parseInt(k[0], 10) / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }),
      )
      .reverse() // älteste zuerst

    if (chunk.length === 0) break
    alle.push(...chunk)
    cursorMs = chunk[chunk.length - 1].time * 1000 + 1
    if (chunk.length < 1000) break
  }
  return alle
}
