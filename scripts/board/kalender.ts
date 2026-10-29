// Wirtschaftskalender: reine Parser für die Quellen (getestet in board.test.ts).
//   USA      Termine: FRED release/dates (braucht FRED_API_KEY) · BEA-Terminplan (HTML, ohne Key, nur BIP)
//            Werte:   FRED-CSV-Export (ohne Key): CPIAUCSL, UNRATE, PAYEMS, A191RL1Q225SBEA
//   Euroraum Termine: Eurostat-Terminkalender (eventsJson, ohne Key) · Werte: Eurostat-API (JSON-stat)
// Alle Zeiten werden nach UTC umgerechnet (BLS/BEA 08:30 New York, Eurostat 11:00 Luxemburg).

import type { IndikatorId, IndikatorWert, KalenderTermin, Region } from '../../src/board/types.ts'
import { ortszeitZuUtc } from '../macro/zeit.ts'

const ZONE_US = 'America/New_York'
const MONATE_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONATE_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export const FRED_RELEASES: { id: number; indikator: IndikatorId; titel: string }[] = [
  { id: 10, indikator: 'cpi', titel: 'Verbraucherpreise (CPI)' },
  { id: 50, indikator: 'arbeitsmarkt', titel: 'Arbeitsmarktbericht (Payrolls, Arbeitslosenquote)' },
  { id: 53, indikator: 'bip', titel: 'BIP (BEA)' },
]

export function fredReleaseUrl(releaseId: number, key: string, abDatum: string): string {
  const p = new URLSearchParams({ release_id: String(releaseId), api_key: key, file_type: 'json', realtime_start: abDatum, include_release_dates_with_no_data: 'true', sort_order: 'asc', limit: '12' })
  return `https://api.stlouisfed.org/fred/release/dates?${p}`
}

/** FRED release/dates → Termine (08:30 New York) */
export function parseFredReleaseDates(json: unknown, release: { id: number; indikator: IndikatorId; titel: string }): KalenderTermin[] {
  const roh = (json as { release_dates?: { date?: string }[] } | null)?.release_dates ?? []
  const aus: KalenderTermin[] = []
  for (const r of roh) {
    if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue
    aus.push({
      id: `us:${release.indikator}:${r.date}`,
      region: 'us',
      indikator: release.indikator,
      titel: release.titel,
      zeitUtc: ortszeitZuUtc(r.date, '08:30', ZONE_US).toISOString(),
      quelle: 'FRED',
      link: `https://fred.stlouisfed.org/release?rid=${release.id}`,
    })
  }
  return aus
}

/**
 * BEA-Terminplan (bea.gov/news/schedule): Zeilen mit „release-date“ (Monat Tag), Uhrzeit und Titel.
 * Nur BIP-Schätzungen. Das Jahr steht nicht in der Zeile – es wird aus der Reihenfolge abgeleitet
 * (Plan läuft von heute vorwärts; ein Monatssprung zurück heißt: nächstes Jahr).
 */
export function parseBeaTermine(html: string, jetztMs: number): KalenderTermin[] {
  const aus: KalenderTermin[] = []
  const zeilen = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []
  const jetzt = new Date(jetztMs)
  let jahr = jetzt.getUTCFullYear()
  let letzterMonat = -1
  for (const zeile of zeilen) {
    const datum = /class="release-date">\s*([A-Za-z]+)\s+(\d{1,2})\s*</.exec(zeile)
    const titel = /class="release-title[^"]*"[^>]*>\s*([^<]+?)\s*</.exec(zeile)
    if (!datum || !titel) continue
    const monat = MONATE_EN.indexOf(datum[1].toLowerCase())
    if (monat < 0) continue
    if (letzterMonat >= 0 && monat < letzterMonat) jahr += 1
    letzterMonat = monat
    const uhr = /text-muted">\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(zeile)
    let stunde = uhr ? Number(uhr[1]) % 12 : 8
    if (uhr && uhr[3].toUpperCase() === 'PM') stunde += 12
    const minute = uhr ? uhr[2] : '30'
    const m = /^GDP \((Advance|Second|Third) Estimate\)[^,]*,\s*(\d)(?:st|nd|rd|th) Quarter (\d{4})/i.exec(titel[1])
    if (!m) continue
    const schaetzung = { advance: '1. Schätzung', second: '2. Schätzung', third: '3. Schätzung' }[m[1].toLowerCase()] ?? m[1]
    const iso = `${jahr}-${String(monat + 1).padStart(2, '0')}-${String(Number(datum[2])).padStart(2, '0')}`
    aus.push({
      id: `us:bip:${iso}`,
      region: 'us',
      indikator: 'bip',
      titel: `BIP Q${m[2]} ${m[3]} (${schaetzung})`,
      periode: `Q${m[2]} ${m[3]}`,
      zeitUtc: ortszeitZuUtc(iso, `${String(stunde).padStart(2, '0')}:${minute}`, ZONE_US).toISOString(),
      quelle: 'BEA',
      link: 'https://www.bea.gov/news/schedule',
    })
  }
  return aus
}

export function eurostatEventsUrl(vonMs: number, bisMs: number): string {
  const iso = (ms: number) => `${new Date(ms).toISOString().slice(0, 10)}T00:00:00+01:00`
  const p = new URLSearchParams({ start: iso(vonMs), end: iso(bisMs), isEuroindicator: 'true', theme: '', category: '', keywords: '', authorInclude: '', authorExclude: '', timeZone: 'Europe/Luxembourg' })
  return `https://ec.europa.eu/eurostat/o/calendars/eventsJson?${p}`
}

interface EurostatEvent {
  title?: string
  start?: string
  period?: string
  datasetCodes?: string
}

const EUROSTAT_TITEL: { muster: RegExp; indikator: IndikatorId; titel: string }[] = [
  { muster: /^Flash estimate inflation/i, indikator: 'cpi', titel: 'Inflation Euroraum (HVPI, Schnellschätzung)' },
  { muster: /^Inflation \(HICP\)/i, indikator: 'cpi', titel: 'Inflation Euroraum (HVPI, endgültig)' },
  { muster: /^Unemployment$/i, indikator: 'arbeitsmarkt', titel: 'Arbeitslosenquote Euroraum' },
  { muster: /^Preliminary flash estimate GDP/i, indikator: 'bip', titel: 'BIP Euroraum (vorläufige Schnellschätzung)' },
  { muster: /^Flash estimate GDP/i, indikator: 'bip', titel: 'BIP Euroraum (Schnellschätzung + Beschäftigung)' },
]

/** „October 2026“ → „Oktober 2026“, „Q3/2026“ → „Q3 2026“ */
export function periodeDeutsch(p: string | undefined): string | undefined {
  if (!p) return undefined
  const q = /^Q(\d)\/(\d{4})$/.exec(p)
  if (q) return `Q${q[1]} ${q[2]}`
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(p)
  if (m) {
    const i = MONATE_EN.indexOf(m[1].toLowerCase())
    if (i >= 0) return `${MONATE_DE[i]} ${m[2]}`
  }
  return p
}

export function parseEurostatEvents(json: unknown): KalenderTermin[] {
  if (!Array.isArray(json)) return []
  const aus: KalenderTermin[] = []
  for (const e of json as EurostatEvent[]) {
    if (!e.title || !e.start) continue
    const def = EUROSTAT_TITEL.find((d) => d.muster.test(e.title!.trim()))
    if (!def) continue
    // start kommt als „2026-10-30T11:00Z“ (bereits UTC)
    const ms = Date.parse(e.start)
    if (!Number.isFinite(ms)) continue
    const zeitUtc = new Date(ms).toISOString()
    aus.push({
      id: `ez:${def.indikator}:${zeitUtc.slice(0, 10)}:${def.titel.length}`,
      region: 'ez',
      indikator: def.indikator,
      titel: def.titel,
      periode: periodeDeutsch(e.period),
      zeitUtc,
      quelle: 'Eurostat',
      link: 'https://ec.europa.eu/eurostat/news/release-calendar',
    })
  }
  return aus
}

/** fredgraph.csv: observation_date,WERT – Zeilen mit „.“ (kein Wert) fallen weg */
export function parseFredCsv(csv: string): { datum: string; wert: number }[] {
  const aus: { datum: string; wert: number }[] = []
  for (const zeile of csv.split(/\r?\n/).slice(1)) {
    const [datum, roh] = zeile.split(',')
    const wert = Number(roh)
    if (/^\d{4}-\d{2}-\d{2}$/.test(datum ?? '') && Number.isFinite(wert) && roh?.trim() !== '.') aus.push({ datum, wert })
  }
  return aus
}

/** Eurostat JSON-stat (statistics API): Werte je Zeitperiode, aufsteigend */
export function parseEurostatWerte(json: unknown): { periode: string; wert: number }[] {
  const d = json as { value?: Record<string, number>; dimension?: { time?: { category?: { index?: Record<string, number> } } } } | null
  const index = d?.dimension?.time?.category?.index
  const werte = d?.value
  if (!index || !werte) return []
  const aus: { periode: string; wert: number }[] = []
  for (const [periode, i] of Object.entries(index)) {
    const w = werte[String(i)]
    if (typeof w === 'number' && Number.isFinite(w)) aus.push({ periode, wert: w })
  }
  return aus.sort((a, b) => a.periode.localeCompare(b.periode))
}

function rund(n: number, stellen: number): number {
  return Number(n.toFixed(stellen))
}

/** CPI-Index → Jahresrate in %, letzter und vorletzter Monat */
export function cpiJahresrate(reihe: { datum: string; wert: number }[]): IndikatorWert | null {
  if (reihe.length < 14) return null
  const n = reihe.length
  const jj = (i: number) => rund((reihe[i].wert / reihe[i - 12].wert - 1) * 100, 1)
  return wert('us', 'cpi', 'Inflation USA (CPI)', reihe[n - 1].datum.slice(0, 7), jj(n - 1), '% J/J', jj(n - 2), 'FRED (CPIAUCSL)', 'https://fred.stlouisfed.org/series/CPIAUCSL')
}

export function payrollsVeraenderung(reihe: { datum: string; wert: number }[]): IndikatorWert | null {
  if (reihe.length < 3) return null
  const n = reihe.length
  const d = (i: number) => rund(reihe[i].wert - reihe[i - 1].wert, 0)
  return wert('us', 'arbeitsmarkt', 'Neue Stellen USA (Payrolls)', reihe[n - 1].datum.slice(0, 7), d(n - 1), 'Tsd.', d(n - 2), 'FRED (PAYEMS)', 'https://fred.stlouisfed.org/series/PAYEMS')
}

export function letzterWert(reihe: { datum: string; wert: number }[], region: Region, indikator: IndikatorId, titel: string, einheit: string, quelle: string, link: string, quartal = false): IndikatorWert | null {
  if (reihe.length < 2) return null
  const n = reihe.length
  const periode = quartal ? quartalAus(reihe[n - 1].datum) : reihe[n - 1].datum.slice(0, 7)
  return wert(region, indikator, titel, periode, reihe[n - 1].wert, einheit, reihe[n - 2].wert, quelle, link)
}

export function eurostatWert(reihe: { periode: string; wert: number }[], indikator: IndikatorId, titel: string, einheit: string, datensatz: string): IndikatorWert | null {
  if (reihe.length === 0) return null
  const n = reihe.length
  return wert('ez', indikator, titel, reihe[n - 1].periode, reihe[n - 1].wert, einheit, n >= 2 ? reihe[n - 2].wert : null, `Eurostat (${datensatz})`, `https://ec.europa.eu/eurostat/databrowser/view/${datensatz}/default/table`)
}

function quartalAus(isoDatum: string): string {
  const m = Number(isoDatum.slice(5, 7))
  return `${isoDatum.slice(0, 4)}-Q${Math.floor((m - 1) / 3) + 1}`
}

function wert(region: Region, indikator: IndikatorId, titel: string, periode: string, w: number, einheit: string, vorher: number | null, quelle: string, link: string): IndikatorWert {
  return { region, indikator, titel, periode, wert: w, einheit, vorher, quelle, link }
}

/** Termine: Vergangenes (älter als einen Tag) raus, sortiert, doppelte ids weg */
export function termineBereinigen(termine: KalenderTermin[], jetztMs: number): KalenderTermin[] {
  const gesehen = new Set<string>()
  return termine
    .filter((t) => Date.parse(t.zeitUtc) > jetztMs - 86_400_000)
    .sort((a, b) => a.zeitUtc.localeCompare(b.zeitUtc))
    .filter((t) => (gesehen.has(t.id) ? false : (gesehen.add(t.id), true)))
}
