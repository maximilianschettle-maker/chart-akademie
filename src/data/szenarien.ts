import type { CandleDatensatz } from '../types'

// Lädt die statischen, ins Repo eingecheckten Szenario-Datensätze
// (public/szenarien/*.json — echte historische Binance-Kerzen).
export async function getSzenarioDaten(datensatz: string): Promise<CandleDatensatz> {
  const res = await fetch(`${import.meta.env.BASE_URL}szenarien/${datensatz}.json`)
  if (!res.ok) throw new Error(`Szenario-Datensatz ${datensatz} nicht ladbar`)
  return (await res.json()) as CandleDatensatz
}
