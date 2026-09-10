import type { Candle } from '../types'
import { getCandles } from './candleService'

// Zufälliger historischer Marktabschnitt für Simulator und Zufalls-Übung.
// Symbol/Zeitraum werden erst nach der Session verraten (Anti-Schummel).

export const ZUFALL_SYMBOLE = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
export const ZUFALL_INTERVALLE: Record<string, number> = { '15m': 900, '1h': 3600, '4h': 14400 }

export interface Abschnitt {
  id: string
  candles: Candle[]
  symbol: string
  interval: string
  anzeigeName: string
}

export async function zufaelligerAbschnitt(gesamtBars = 800): Promise<Abschnitt> {
  const symbol = ZUFALL_SYMBOLE[Math.floor(Math.random() * ZUFALL_SYMBOLE.length)]
  const intervalle = Object.keys(ZUFALL_INTERVALLE)
  const interval = intervalle[Math.floor(Math.random() * intervalle.length)]
  const sek = ZUFALL_INTERVALLE[interval]

  const fruehestens = 1609459200 // 2021-01-01 (alle drei Symbole liquide)
  const spaetestens = Math.floor(Date.now() / 1000) - (gesamtBars + 10) * sek
  const von = fruehestens + Math.floor(Math.random() * (spaetestens - fruehestens))
  const bis = von + (gesamtBars + 5) * sek

  const candles = await getCandles(symbol, interval, von, bis)
  if (candles.length < gesamtBars * 0.85) {
    throw new Error('Zu wenige Kerzen im Zeitraum')
  }
  return {
    id: `${symbol}-${von}-${interval}`,
    candles: candles.slice(0, gesamtBars),
    symbol,
    interval,
    anzeigeName: `Asset ${['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)]}`,
  }
}

/** Mehrere Versuche, weil einzelne Zufallsabschnitte Datenlücken haben können. */
export async function zufaelligerAbschnittMitVersuchen(gesamtBars = 800, versuche = 3): Promise<Abschnitt> {
  let letzter: unknown
  for (let v = 0; v < versuche; v++) {
    try {
      return await zufaelligerAbschnitt(gesamtBars)
    } catch (e) {
      letzter = e
    }
  }
  throw letzter instanceof Error ? letzter : new Error('Kein Abschnitt ladbar')
}
