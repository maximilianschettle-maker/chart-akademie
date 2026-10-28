// EZB: Einlagezins über das ECB Data Portal (SDMX-JSON) und Ratssitzungen aus der
// Kalenderseite https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
// Struktur (Stand 2026-10): <dt>29/10/2026</dt><dd>Governing Council of the ECB:
// monetary policy meeting in Frankfurt (Day 2), followed by press conference</dd>.
// Die Seite listet nur künftige Termine; Vergangenes kommt aus data/ezb-dates.json.

import type { EzbZinsPunkt, ZinsTermin } from '../../src/makro/types.ts'
import { ortszeitZuUtc, UHRZEIT_EZB, ZONE_EZB } from './zeit.ts'

/** Einlagesatz, nur Änderungstage (Gültigkeitsdatum) */
export const EZB_DFR_URL =
  'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?format=jsondata&startPeriod=1999-01-01'
export const EZB_KALENDER_URL = 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'
export const EZB_RSS_URL = 'https://www.ecb.europa.eu/rss/press.html'

export function ezbTermin(datum: string, rest: Partial<ZinsTermin> = {}): ZinsTermin {
  return {
    datum,
    entscheidungUtc: ortszeitZuUtc(datum, UHRZEIT_EZB, ZONE_EZB).toISOString(),
    ...rest,
  }
}

interface SdmxJson {
  dataSets: { series: Record<string, { observations: Record<string, (number | null)[]> }> }[]
  structure: { dimensions: { observation: { id: string; values: { id: string }[] }[] } }
}

export function parseEzbZinsen(json: unknown): EzbZinsPunkt[] {
  const j = json as SdmxJson
  const beobachtung = j?.structure?.dimensions?.observation
  const zeit = beobachtung?.find((d) => d.id === 'TIME_PERIOD') ?? beobachtung?.[0]
  const serie = j?.dataSets?.[0]?.series ? Object.values(j.dataSets[0].series)[0] : undefined
  if (!zeit || !serie) throw new Error('EZB-Zinsen: unerwartetes SDMX-JSON')
  const punkte: EzbZinsPunkt[] = []
  for (const [idx, werte] of Object.entries(serie.observations)) {
    const datum = zeit.values[Number(idx)]?.id
    const wert = werte[0]
    if (!datum || typeof wert !== 'number') continue
    punkte.push({ datum, einlage: wert })
  }
  punkte.sort((a, b) => a.datum.localeCompare(b.datum))
  if (punkte.length < 5) throw new Error(`EZB-Zinsen: nur ${punkte.length} Beobachtungen`)
  // nur echte Änderungen behalten
  return punkte.filter((p, i) => i === 0 || p.einlage !== punkte[i - 1].einlage)
}

function ttmmjjjjZuIso(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

/** Geldpolitische Sitzungen (Day 2 = Entscheidung), Day 1 als `beginn` */
export function parseEzbKalender(html: string): ZinsTermin[] {
  const re = /<dt>\s*([^<]+?)\s*<\/dt>\s*<dd>\s*([\s\S]*?)<\/dd>/g
  const eintraege: { datum: string; tag2: boolean; tag1: boolean }[] = []
  for (const m of html.matchAll(re)) {
    const datum = ttmmjjjjZuIso(m[1])
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!datum || !/monetary policy meeting/i.test(text) || /non-monetary/i.test(text)) continue
    eintraege.push({ datum, tag2: /day 2/i.test(text), tag1: /day 1/i.test(text) })
  }
  if (eintraege.length === 0) throw new Error('EZB-Kalender: keine geldpolitischen Sitzungen gefunden')
  eintraege.sort((a, b) => a.datum.localeCompare(b.datum))

  const termine: ZinsTermin[] = []
  for (let i = 0; i < eintraege.length; i++) {
    const e = eintraege[i]
    const folgend = eintraege[i + 1]
    // Erster Sitzungstag: ausdrücklich „Day 1“ oder ein Eintrag ohne „Day 2“, auf den am
    // nächsten Tag ein „Day 2“ folgt (manche Einträge tragen keine Tageskennung)
    if (e.tag1 || (!e.tag2 && folgend?.tag2 && tageZwischen(e.datum, folgend.datum) <= 1)) continue
    const vorher = eintraege[i - 1]
    const t = ezbTermin(e.datum)
    if (vorher && !vorher.tag2 && tageZwischen(vorher.datum, e.datum) <= 2) t.beginn = vorher.datum
    termine.push(t)
  }
  const einmalig = new Map(termine.map((t) => [t.datum, t]))
  return [...einmalig.values()].sort((a, b) => a.datum.localeCompare(b.datum))
}

/** Einlagezins aus der Pressemitteilung „Monetary policy decisions“ (HTML) */
export function parseEzbEntscheidung(html: string): { einlage: number; unveraendert: boolean } | null {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
  const m = /deposit facility[^.]*?(\d+\.\d{2})\s?%/i.exec(text)
  if (!m) return null
  return { einlage: Number(m[1]), unveraendert: /unchanged/i.test(m[0]) }
}
