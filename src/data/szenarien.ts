import type { Candle, CandleDatensatz } from '../types'
import { UNTER_INTERVALL } from '../engine/intrabar'

// Lädt die statischen, ins Repo eingecheckten Szenario-Datensätze
// (public/szenarien/*.json — echte historische Binance-Kerzen).
export async function getSzenarioDaten(datensatz: string): Promise<CandleDatensatz> {
  const res = await fetch(`${import.meta.env.BASE_URL}szenarien/${datensatz}.json`)
  if (!res.ok) throw new Error(`Szenario-Datensatz ${datensatz} nicht ladbar`)
  return (await res.json()) as CandleDatensatz
}

/** Unterkerzen eines Szenarios (public/szenarien/<name>-<unterintervall>.json); null, wenn nicht vorhanden. */
export async function getSzenarioUnterkerzen(datensatz: string, interval: string): Promise<Candle[] | null> {
  const unter = UNTER_INTERVALL[interval]
  if (!unter) return null
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}szenarien/${datensatz}-${unter}.json`)
    if (!res.ok) return null
    return ((await res.json()) as CandleDatensatz).candles
  } catch {
    return null
  }
}
