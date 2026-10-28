// Formatierung für den Makro-Bereich: alles in deutscher Ortszeit (Europe/Berlin),
// unabhängig von der Zeitzone des Geräts.

import type { Bank, ZinsTermin } from './types'

export const ZONE = 'Europe/Berlin'

const UHR = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' })
const TAG_KURZ = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, weekday: 'short', day: '2-digit', month: '2-digit' })
const TAG_LANG = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
const DATUM = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric' })
const DATUM_KURZ = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: '2-digit' })
const STAND = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** ISO-Datum (JJJJ-MM-TT) ohne Zeitzonenverschiebung als lokales Datum anzeigen */
function isoDatumZuDate(iso: string): Date {
  const [j, m, t] = iso.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, t, 12))
}

export function fmtUhr(iso: string): string {
  return UHR.format(new Date(iso))
}

export function fmtTagKurz(iso: string): string {
  return TAG_KURZ.format(new Date(iso))
}

export function fmtTagLang(iso: string): string {
  return TAG_LANG.format(new Date(iso))
}

/** „17.09.2026“ aus einem ISO-Datum (kein Zeitpunkt) */
export function fmtDatum(isoDatum: string): string {
  return DATUM.format(isoDatumZuDate(isoDatum))
}

export function fmtDatumKurz(isoDatum: string): string {
  return DATUM_KURZ.format(isoDatumZuDate(isoDatum))
}

/** „28.10.2026, 18:55“ aus einem UTC-Zeitpunkt */
export function fmtStand(iso: string): string {
  return STAND.format(new Date(iso))
}

export function fmtProzent(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtKorridor(unten: number, oben: number): string {
  return `${fmtProzent(unten)}–${fmtProzent(oben)} %`
}

/** „+25 Bp“ / „−25 Bp“ / „±0 Bp“ */
export function fmtBp(bp: number): string {
  if (bp === 0) return '±0 Bp'
  return `${bp > 0 ? '+' : '−'}${Math.abs(bp)} Bp`
}

export function bankName(bank: Bank): string {
  return bank === 'fed' ? 'Fed' : 'EZB'
}

export function bankLang(bank: Bank): string {
  return bank === 'fed' ? 'Federal Reserve (FOMC)' : 'Europäische Zentralbank (EZB-Rat)'
}

const MINUTE = 60_000
const STUNDE = 3_600_000
const TAG = 86_400_000

/** Restzeit bis zur Veröffentlichung, grob genug für ein Widget („in 2 Tagen 5 Std“) */
export function fmtRestzeit(zielIso: string, jetzt: number): string {
  const diff = Date.parse(zielIso) - jetzt
  if (diff <= 0) return 'jetzt'
  if (diff < STUNDE) return `in ${Math.max(1, Math.round(diff / MINUTE))} Min`
  if (diff < TAG) {
    const h = Math.floor(diff / STUNDE)
    const min = Math.round((diff - h * STUNDE) / MINUTE)
    return min > 0 ? `in ${h} Std ${min} Min` : `in ${h} Std`
  }
  const tage = Math.floor(diff / TAG)
  const h = Math.round((diff - tage * TAG) / STUNDE)
  return h > 0 ? `in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} ${h} Std` : `in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`
}

/** Erster Termin, dessen Veröffentlichung noch nicht länger als `nachlaufMs` zurückliegt */
export function naechsterTermin(termine: ZinsTermin[], jetzt: number, nachlaufMs = 3 * STUNDE): ZinsTermin | null {
  return termine.find((t) => Date.parse(t.entscheidungUtc) + nachlaufMs >= jetzt) ?? null
}

/** Datum eines Zeitpunkts in Berlin als ISO-Datum – für „heute?“-Vergleiche */
export function heuteBerlin(jetzt: number): string {
  const p: Record<string, string> = {}
  for (const t of new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(jetzt)))
    p[t.type] = t.value
  return `${p.year}-${p.month}-${p.day}`
}
