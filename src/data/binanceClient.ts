import type { Candle } from '../types'

// Public Spot-Endpoints, kein API-Key nötig. api.binance.com kann je nach
// Region/Netz blocken — deshalb mehrere Hosts als Fallback.
const HOSTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
]

type RohKline = [number, string, string, string, string, string, number, ...unknown[]]

function mapKline(k: RohKline): Candle {
  return {
    time: Math.floor(k[0] / 1000), // ms → Sekunden
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }
}

async function fetchKlinesChunk(
  symbol: string,
  interval: string,
  startTimeMs: number,
  endTimeMs: number,
  limit = 1000,
): Promise<Candle[]> {
  let letzterFehler: unknown
  for (const host of HOSTS) {
    try {
      const url =
        `${host}/api/v3/klines?symbol=${symbol}&interval=${interval}` +
        `&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=${limit}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)
      const daten = (await res.json()) as RohKline[]
      return daten.map(mapKline)
    } catch (fehler) {
      letzterFehler = fehler
    }
  }
  throw letzterFehler instanceof Error
    ? letzterFehler
    : new Error('Binance nicht erreichbar')
}

/**
 * Holt alle Kerzen im Bereich [von, bis] (Unix-Sekunden), paginiert über die
 * 1000er-Grenze der API hinweg.
 */
export async function fetchKlinesRange(
  symbol: string,
  interval: string,
  von: number,
  bis: number,
): Promise<Candle[]> {
  const alle: Candle[] = []
  let cursorMs = von * 1000
  const bisMs = bis * 1000

  while (cursorMs <= bisMs) {
    const chunk = await fetchKlinesChunk(symbol, interval, cursorMs, bisMs)
    if (chunk.length === 0) break
    alle.push(...chunk)
    const letzte = chunk[chunk.length - 1]
    cursorMs = letzte.time * 1000 + 1
    if (chunk.length < 1000) break
  }
  return alle
}
