import type { Bank, MakroDaten } from '../makro/types'

// Leitzins als Treppenlinie fürs Investor-Chart: Fed-Korridor (Mitte) für USD-Werte, EZB-Einlagesatz
// für EUR-Werte. Punkte liegen im Zeitfenster des Charts; der Wert vor dem Fenster wird an den Anfang gesetzt,
// der letzte bis zum Ende verlängert, damit die Linie den ganzen Chart überspannt.

export interface LeitzinsPunkt {
  /** Unix-Sekunden */
  time: number
  value: number
}

export function bankFuerWaehrung(waehrung: string): Bank {
  return waehrung === 'EUR' ? 'ezb' : 'fed'
}

const tag = (iso: string) => Math.floor(Date.parse(iso) / 1000 / 86_400) * 86_400

export function leitzinsPunkte(daten: MakroDaten | null, bank: Bank, vonSek: number, bisSek: number): LeitzinsPunkt[] {
  if (!daten || !(bisSek > vonSek)) return []
  const roh: LeitzinsPunkt[] = (
    bank === 'fed' ? daten.fed.historie.map((p) => ({ time: tag(p.datum), value: (p.oben + p.unten) / 2 })) : daten.ezb.historie.map((p) => ({ time: tag(p.datum), value: p.einlage }))
  )
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time)
  const davor = roh.filter((p) => p.time <= vonSek).at(-1)
  const drin = roh.filter((p) => p.time > vonSek && p.time <= bisSek)
  const punkte = davor ? [{ time: vonSek, value: davor.value }, ...drin] : drin
  if (punkte.length === 0) return []
  const letzter = punkte[punkte.length - 1]
  if (letzter.time < bisSek) punkte.push({ time: bisSek, value: letzter.value })
  // gleiche Zeiten: der spätere Eintrag gewinnt
  const nachZeit = new Map<number, LeitzinsPunkt>()
  for (const p of punkte) nachZeit.set(p.time, p)
  return [...nachZeit.values()].sort((a, b) => a.time - b.time)
}

export function leitzinsTitel(bank: Bank): string {
  return bank === 'fed' ? 'Fed Funds (Mitte)' : 'EZB-Einlagesatz'
}
