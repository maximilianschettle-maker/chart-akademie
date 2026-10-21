// Währungsumrechnung: Kurs (Handelswährung) in die Berichtswährung der Abschlüsse bringen,
// damit kursbezogene Kennzahlen auch bei ADRs oder Hongkong-Listings (HKD vs. CNY) entstehen,
// und Beträge im Firmenvergleich auf eine gemeinsame Währung bringen.
import type { Fundamentaldaten, Kurs, Wechselkurs } from '../types'

/** Yahoo-Symbol für ein Währungspaar, z.B. HKD→CNY = 'HKDCNY=X'; null bei gleicher Währung. */
export function paarSymbol(von: string, nach: string): string | null {
  const a = von.trim().toUpperCase()
  const b = nach.trim().toUpperCase()
  if (!a || !b || a === b) return null
  return `${a}${b}=X`
}

export function paarCode(von: string, nach: string): string {
  return `${von.trim().toUpperCase()}${nach.trim().toUpperCase()}`
}

/** Alle Kurs-Beträge mit dem Wechselkurs umrechnen; Verhältnisse (KGV, KBV …) bleiben, die sind währungsfrei. */
export function kursUmrechnen(kurs: Kurs, wk: Wechselkurs): Kurs {
  if (kurs.waehrung !== wk.von || wk.kurs <= 0) return kurs
  const u = (v: number | undefined) => (v === undefined ? undefined : v * wk.kurs)
  return {
    ...kurs,
    waehrung: wk.nach,
    preis: kurs.preis * wk.kurs,
    marktkap: u(kurs.marktkap),
    enterpriseValue: u(kurs.enterpriseValue),
    kursziel: u(kurs.kursziel),
    hoch52w: u(kurs.hoch52w),
    tief52w: u(kurs.tief52w),
  }
}

/**
 * Kurs, mit dem die Kennzahlen gerechnet werden: in Berichtswährung, wenn ein Wechselkurs
 * vorliegt; sonst der Originalkurs (kennzahlen() nimmt dann nur die Yahoo-Verhältnisse).
 */
export function kursFuerKennzahlen(d: Fundamentaldaten): Kurs | null {
  if (!d.kurs) return null
  if (d.kurs.waehrung === d.firma.waehrung) return d.kurs
  if (d.wechselkurs && d.wechselkurs.von === d.kurs.waehrung && d.wechselkurs.nach === d.firma.waehrung) return kursUmrechnen(d.kurs, d.wechselkurs)
  return d.kurs
}

/** Betrag von einer Währung in eine andere; `kurse` ist nach Paarcode (z.B. 'USDEUR') abgelegt. null, wenn der Kurs fehlt. */
export function betragUmrechnen(betrag: number | null | undefined, von: string, nach: string, kurse: Record<string, number>): number | null {
  if (betrag === null || betrag === undefined || !Number.isFinite(betrag)) return null
  if (!von || !nach || von === nach) return betrag
  const direkt = kurse[paarCode(von, nach)]
  if (direkt) return betrag * direkt
  const zurueck = kurse[paarCode(nach, von)]
  if (zurueck) return betrag / zurueck
  return null
}

/** Text für den Hinweis auf der Firmenseite, z.B. "1 HKD = 0,8492 CNY". */
export function wechselkursText(wk: Wechselkurs): string {
  const stellen = wk.kurs < 0.1 ? 5 : 4
  return `1 ${wk.von} = ${wk.kurs.toLocaleString('de-DE', { maximumFractionDigits: stellen })} ${wk.nach}`
}
