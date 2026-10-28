// Fed: Leitzins-Korridor aus FRED (DFEDTARU = Obergrenze, DFEDTARL = Untergrenze),
// Pressemitteilungen aus dem RSS-Feed „Monetary Policy“, Ergebnis aus dem Statement-Text.

import type { FedZinsPunkt, Meldung } from '../../src/makro/types.ts'

export const FRED_API = 'https://api.stlouisfed.org/fred/series/observations'
/** Ohne API-Key: der CSV-Export hinter den FRED-Grafiken (mehrere Serien in einer Datei) */
export const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARU,DFEDTARL&cosd=2008-12-16'
export const FED_RSS_URL = 'https://www.federalreserve.gov/feeds/press_monetary.xml'

export interface Beobachtung {
  datum: string
  wert: number
}

export function fredApiUrl(serie: string, apiKey: string): string {
  const p = new URLSearchParams({
    series_id: serie,
    api_key: apiKey,
    file_type: 'json',
    observation_start: '2008-12-16',
  })
  return `${FRED_API}?${p}`
}

export function parseFredJson(json: unknown): Beobachtung[] {
  const obs = (json as { observations?: { date: string; value: string }[] })?.observations
  if (!Array.isArray(obs)) throw new Error('FRED: keine observations')
  return obs
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => ({ datum: o.date, wert: Number(o.value) }))
    .filter((o) => Number.isFinite(o.wert))
}

/** fredgraph.csv: observation_date,DFEDTARU,DFEDTARL — leere Zellen = kein Wert */
export function parseFredCsv(csv: string): { oben: Beobachtung[]; unten: Beobachtung[] } {
  const zeilen = csv.trim().split(/\r?\n/)
  const kopf = zeilen[0].split(',').map((s) => s.trim())
  const iO = kopf.indexOf('DFEDTARU')
  const iU = kopf.indexOf('DFEDTARL')
  if (iO < 0 || iU < 0) throw new Error('FRED-CSV: Spalten DFEDTARU/DFEDTARL fehlen')
  const oben: Beobachtung[] = []
  const unten: Beobachtung[] = []
  for (const z of zeilen.slice(1)) {
    const t = z.split(',')
    const datum = t[0]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue
    const o = Number(t[iO])
    const u = Number(t[iU])
    if (t[iO] !== '' && Number.isFinite(o)) oben.push({ datum, wert: o })
    if (t[iU] !== '' && Number.isFinite(u)) unten.push({ datum, wert: u })
  }
  return { oben, unten }
}

/** Zwei Tagesreihen → Korridor-Historie, nur Tage, an denen sich etwas geändert hat */
export function verdichteFed(oben: Beobachtung[], unten: Beobachtung[]): FedZinsPunkt[] {
  const untenNachDatum = new Map(unten.map((u) => [u.datum, u.wert]))
  const punkte: FedZinsPunkt[] = []
  for (const o of oben) {
    const u = untenNachDatum.get(o.datum)
    if (u === undefined) continue
    const letzter = punkte[punkte.length - 1]
    if (letzter && letzter.oben === o.wert && letzter.unten === u) continue
    punkte.push({ datum: o.datum, oben: o.wert, unten: u })
  }
  if (punkte.length === 0) throw new Error('FRED: keine gemeinsamen Beobachtungen')
  return punkte
}

function entCdata(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function feld(item: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(item)
  return m ? entCdata(m[1]) : ''
}

/** RSS 2.0 (Fed) und RSS 1.0/RDF (EZB): Titel, Datum (UTC-ISO), Link */
export function parseRss(xml: string): Meldung[] {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map((m) => m[0])
  const meldungen: Meldung[] = []
  for (const item of items) {
    const titel = feld(item, 'title').replace(/\s+/g, ' ')
    const link = feld(item, 'link')
    const roh = feld(item, 'pubDate') || feld(item, 'dc:date')
    const zeit = Date.parse(roh)
    if (!titel || !link || !Number.isFinite(zeit)) continue
    meldungen.push({ titel, datum: new Date(zeit).toISOString(), link })
  }
  meldungen.sort((a, b) => b.datum.localeCompare(a.datum))
  return meldungen
}

/** „4-1/4“ → 4,25 · „1/4“ → 0,25 · „4“ → 4 */
export function fedBruch(s: string): number {
  const m = /^(\d+)?(?:-?(\d)\/(\d))?$/.exec(s.trim())
  if (!m) return Number.NaN
  const ganz = m[1] ? Number(m[1]) : 0
  const bruch = m[2] && m[3] ? Number(m[2]) / Number(m[3]) : 0
  return ganz + bruch
}

/** Zielkorridor aus dem Statement-HTML („… target range for the federal funds rate at 4-1/4 to 4-1/2 percent“) */
export function parseFedStatement(html: string): { unten: number; oben: number } | null {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
  const re =
    /target range for the federal funds rate[^.]*?(?:at|to|of) (\d+(?:-\d\/\d)?|\d\/\d) to (\d+(?:-\d\/\d)?|\d\/\d) percent/i
  const m = re.exec(text)
  if (!m) return null
  const unten = fedBruch(m[1])
  const oben = fedBruch(m[2])
  if (!Number.isFinite(unten) || !Number.isFinite(oben) || oben <= unten) return null
  return { unten, oben }
}
