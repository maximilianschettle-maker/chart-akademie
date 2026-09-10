import type { Candle, CandleDatensatz } from '../types'
import { getCandles } from './candleService'

// Zufälliger historischer Marktabschnitt für Simulator und Zufalls-Übung.
// Symbol/Zeitraum werden erst nach der Session verraten (Anti-Schummel).
// Fallback ohne Netz (oder wenn Binance UND Bybit blocken): drei fest
// eingebaute Abschnitte unter public/replay/.

export const ZUFALL_SYMBOLE = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
export const ZUFALL_INTERVALLE: Record<string, number> = { '15m': 900, '1h': 3600, '4h': 14400 }

/** Eingebaute Offline-Abschnitte (scripts/hole-szenario.mjs … replay) */
export const REPLAY_FALLBACKS = ['replay-btc-1h-2022', 'replay-eth-4h-2021', 'replay-sol-15m-2023']

export interface Abschnitt {
  id: string
  candles: Candle[]
  symbol: string
  interval: string
  anzeigeName: string
  /** true, wenn der Abschnitt aus dem eingebauten Offline-Vorrat stammt */
  offline?: boolean
}

function anzeigeName(): string {
  return `Asset ${['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)]}`
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
    anzeigeName: anzeigeName(),
  }
}

/** Eingebauter Abschnitt aus public/replay/ (funktioniert offline, sobald einmal gecacht). */
export async function offlineAbschnitt(gesamtBars = 800): Promise<Abschnitt> {
  const name = REPLAY_FALLBACKS[Math.floor(Math.random() * REPLAY_FALLBACKS.length)]
  const res = await fetch(`${import.meta.env.BASE_URL}replay/${name}.json`)
  if (!res.ok) throw new Error(`Offline-Abschnitt ${name} fehlt`)
  const daten = (await res.json()) as CandleDatensatz
  // zufälliges Fenster, falls der Datensatz mehr Kerzen hat als gebraucht
  const start = Math.max(0, Math.floor(Math.random() * Math.max(1, daten.candles.length - gesamtBars)))
  return {
    id: `${name}-${start}`,
    candles: daten.candles.slice(start, start + gesamtBars),
    symbol: daten.symbol,
    interval: daten.interval,
    anzeigeName: anzeigeName(),
    offline: true,
  }
}

/**
 * Mehrere Online-Versuche (einzelne Zufallsabschnitte können Datenlücken haben),
 * danach der eingebaute Offline-Vorrat.
 */
export async function zufaelligerAbschnittMitVersuchen(gesamtBars = 800, versuche = 3): Promise<Abschnitt> {
  for (let v = 0; v < versuche; v++) {
    try {
      return await zufaelligerAbschnitt(gesamtBars)
    } catch {
      // nächster Versuch
    }
  }
  return offlineAbschnitt(gesamtBars)
}
