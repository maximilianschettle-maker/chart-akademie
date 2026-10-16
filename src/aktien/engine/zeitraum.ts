// Hilfsfunktionen für Geschäftsjahre und Quartale. Reine Funktionen, keine Abhängigkeiten.

const TAG_MS = 86_400_000

export function tage(von: string, bis: string): number {
  return Math.round((Date.parse(bis) - Date.parse(von)) / TAG_MS)
}

export function jahrVon(iso: string): number {
  return Number(iso.slice(0, 4))
}

export function monatVon(iso: string): number {
  return Number(iso.slice(5, 7))
}

/**
 * Ordnet einen Quartals-Stichtag dem Geschäftsjahr und der Quartalsnummer zu.
 * gjEndeMonat = Monat, in dem das Geschäftsjahr endet (Apple: 9, SAP: 12).
 * Beispiel Apple: Stichtag 2024-12-28 → GJ 2025, Q1.
 */
export function fiskalQuartal(ende: string, gjEndeMonat: number): { geschaeftsjahr: number; quartal: number } {
  const monat = monatVon(ende)
  const jahr = jahrVon(ende)
  const abstand = (monat - gjEndeMonat + 12) % 12 // Monate seit dem letzten GJ-Ende
  const quartal = abstand === 0 ? 4 : Math.max(1, Math.min(3, Math.round(abstand / 3)))
  const geschaeftsjahr = monat > gjEndeMonat ? jahr + 1 : jahr
  return { geschaeftsjahr, quartal }
}

/** Häufigster Monat der Stichtage — so bestimmen wir das Geschäftsjahresende aus den Daten. */
export function gjEndeMonatAus(stichtage: string[], standard = 12): number {
  if (stichtage.length === 0) return standard
  const zaehler = new Map<number, number>()
  for (const s of stichtage) zaehler.set(monatVon(s), (zaehler.get(monatVon(s)) ?? 0) + 1)
  let best = standard
  let bestN = -1
  for (const [monat, n] of zaehler) {
    if (n > bestN) {
      best = monat
      bestN = n
    }
  }
  return best
}
