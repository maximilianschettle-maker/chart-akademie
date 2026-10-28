// FOMC-Kalender: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
// Struktur (Stand 2026-10): je Jahr ein Panel „<Jahr> FOMC Meetings“, darin Zeilen
//   <div class="fomc-meeting__month …"><strong>March</strong></div>
//   <div class="fomc-meeting__date …">17-18*</div>
// Sternchen = Sitzung mit Projektionen (SEP). Sonderfälle: „Apr/May“ + „30-1“
// (Monatswechsel), „22 (notation vote)“ (eintägig, mit Hinweis). Im Zeilenblock
// steht nach der Sitzung der Statement-Link /newsevents/pressreleases/monetaryJJJJMMTTa.htm.

import type { ZinsTermin } from '../../src/makro/types.ts'
import { ortszeitZuUtc, UHRZEIT_FED, ZONE_FED } from './zeit.ts'

const MONATE: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const FED_BASIS = 'https://www.federalreserve.gov'
export const FOMC_KALENDER_URL = `${FED_BASIS}/monetarypolicy/fomccalendars.htm`

function iso(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

export function fedTermin(datum: string, rest: Partial<ZinsTermin> = {}): ZinsTermin {
  return {
    datum,
    entscheidungUtc: ortszeitZuUtc(datum, UHRZEIT_FED, ZONE_FED).toISOString(),
    ...rest,
  }
}

/** Standard-Link des FOMC-Statements zu einem Entscheidungstag */
export function fedStatementUrl(datum: string): string {
  return `${FED_BASIS}/newsevents/pressreleases/monetary${datum.replace(/-/g, '')}a.htm`
}

/** Eine Zeile „March“ + „17-18*“ in einem Jahr → Termin; null, wenn unlesbar */
export function parseFomcZeile(monatText: string, datumText: string, jahr: number): ZinsTermin | null {
  const monate = monatText.split('/').map((m) => MONATE[m.trim().toLowerCase().replace(/\.$/, '')])
  if (monate.length === 0 || monate.some((m) => !m)) return null

  const sep = datumText.includes('*')
  const hinweisTreffer = /\(([^)]+)\)/.exec(datumText)
  const hinweis = hinweisTreffer ? hinweisTreffer[1].trim() : undefined
  const zahlen = datumText
    .replace(/\([^)]*\)/g, '')
    .replace(/\*/g, '')
    .split(/[-–]/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
  if (zahlen.length === 0) return null

  const beginnTag = zahlen[0]
  const endeTag = zahlen[zahlen.length - 1]
  const beginnMonat = monate[0]
  // Bei „Apr/May 30-1“ gehört der letzte Tag zum zweiten Monat
  const endeMonat = monate.length > 1 ? monate[monate.length - 1] : beginnMonat
  const datum = iso(jahr, endeMonat, endeTag)
  const beginn = zahlen.length > 1 ? iso(jahr, beginnMonat, beginnTag) : undefined

  const t = fedTermin(datum, { sep })
  if (beginn) t.beginn = beginn
  if (hinweis) t.hinweis = hinweis
  return t
}

/** Alle Sitzungen aller Jahres-Panels, nach Datum sortiert. Wirft, wenn die Seite nicht mehr passt. */
export function parseFomcKalender(html: string, heute = new Date()): ZinsTermin[] {
  const panels: { jahr: number; start: number }[] = []
  for (const m of html.matchAll(/(\d{4}) FOMC Meetings/g)) panels.push({ jahr: Number(m[1]), start: m.index ?? 0 })
  if (panels.length === 0) throw new Error('FOMC-Kalender: keine Jahres-Panels gefunden')

  const zeileRe =
    /fomc-meeting__month[^>]*>\s*<strong>([^<]+)<\/strong>\s*<\/div>\s*<div class="fomc-meeting__date[^>]*>([^<]+)</g
  const starts = panels.map((p) => p.start).sort((a, b) => a - b)
  const termine: ZinsTermin[] = []
  for (const panel of panels) {
    // Panels stehen nicht chronologisch (2026, 2025, …, 2027) → Blockende = nächster Panel-Beginn in der Datei
    const ende = starts.find((s) => s > panel.start) ?? html.length
    const block = html.slice(panel.start, ende)
    const zeilen = [...block.matchAll(zeileRe)]
    for (let z = 0; z < zeilen.length; z++) {
      const termin = parseFomcZeile(zeilen[z][1], zeilen[z][2], panel.jahr)
      if (!termin) continue
      const zeileBlock = block.slice(zeilen[z].index ?? 0, zeilen[z + 1]?.index ?? block.length)
      const link = /href="(\/newsevents\/pressreleases\/monetary\d{8}a\.htm)"/.exec(zeileBlock)
      if (link) termin.statementUrl = FED_BASIS + link[1]
      termine.push(termin)
    }
  }
  termine.sort((a, b) => a.datum.localeCompare(b.datum))
  // Plausibilität: ein normales Jahr hat acht Sitzungen
  const jahr = String(heute.getUTCFullYear())
  const dieses = termine.filter((t) => t.datum.startsWith(jahr))
  if (dieses.length < 6) throw new Error(`FOMC-Kalender: nur ${dieses.length} Sitzungen für ${jahr} erkannt`)
  return termine
}
