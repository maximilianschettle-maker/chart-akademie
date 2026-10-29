// Holt Wirtschaftskalender und Geopolitik-News und schreibt public/data/kalender.json und
// public/data/news.json. Läuft in der GitHub Action (board.yml) und lokal:
//   npx tsx scripts/board/hole-board.ts
// Env: FRED_API_KEY (optional, für die US-Veröffentlichungstermine von CPI/Arbeitsmarkt/BIP),
//      GDELT=1 (optional, zusätzliche englische Meldungen über die GDELT-DOC-API, 1 Anfrage je 6 s).
// Schreibt nur bei inhaltlicher Änderung oder wenn der Stand älter als 20 h ist.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IndikatorWert, KalenderDaten, KalenderTermin, NewsDaten, NewsEintrag, NewsKategorie, QuelleStatus } from '../../src/board/types.ts'
import {
  FRED_RELEASES,
  cpiJahresrate,
  eurostatEventsUrl,
  eurostatWert,
  fredReleaseUrl,
  letzterWert,
  parseBeaTermine,
  parseEurostatEvents,
  parseEurostatWerte,
  parseFredCsv,
  parseFredReleaseDates,
  payrollsVeraenderung,
  termineBereinigen,
} from './kalender.ts'
import { parseRss } from './rss.ts'
import { eintragId, kategorisiere, markttags, sprache } from './regeln.ts'

const WURZEL = fileURLToPath(new URL('../../', import.meta.url))
const KALENDER_DATEI = join(WURZEL, 'public', 'data', 'kalender.json')
const NEWS_DATEI = join(WURZEL, 'public', 'data', 'news.json')
const UA = 'ChartAkademie-Board/1 (+https://github.com/maximilianschettle-maker/chart-akademie)'
const NEU_SCHREIBEN_NACH_MS = 20 * 3600_000
const NEWS_FENSTER_MS = 72 * 3600_000
const NEWS_MAX = 90

/** Kuratierte Feeds: deutsch und englisch, Politik/Wirtschaft/Energie */
const FEEDS: { quelle: string; url: string }[] = [
  { quelle: 'tagesschau', url: 'https://www.tagesschau.de/xml/rss2/' },
  { quelle: 'DW', url: 'https://rss.dw.com/xml/rss-de-all' },
  { quelle: 'Spiegel Wirtschaft', url: 'https://www.spiegel.de/wirtschaft/index.rss' },
  { quelle: 'FAZ Wirtschaft', url: 'https://www.faz.net/rss/aktuell/wirtschaft/' },
  { quelle: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/top-themen' },
  { quelle: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { quelle: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { quelle: 'EIA Today in Energy', url: 'https://www.eia.gov/rss/todayinenergy.xml' },
]

/** GDELT-Suchen je Kategorie (englisch, letzte 24 h) */
const GDELT: { kategorie: NewsKategorie; query: string }[] = [
  { kategorie: 'handel', query: '(tariffs OR sanctions OR "trade war" OR "export controls")' },
  { kategorie: 'konflikte', query: '(ceasefire OR airstrike OR "missile attack" OR invasion OR offensive) (Ukraine OR Gaza OR Iran OR Taiwan OR Israel)' },
  { kategorie: 'energie', query: '(OPEC OR "oil prices" OR "crude oil" OR LNG OR "natural gas prices")' },
  { kategorie: 'politik', query: '("election results" OR "snap election" OR "government collapse" OR "no-confidence vote" OR shutdown)' },
]

function log(...t: unknown[]) {
  console.log(new Date().toISOString().slice(11, 19), ...t)
}

async function hole(url: string, akzept = 'application/json,application/xml,text/html,*/*'): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: akzept }, signal: AbortSignal.timeout(30_000), redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} für ${url.replace(/api_key=[^&]+/, 'api_key=…')}`)
  return res.text()
}

function liesJson<T>(pfad: string): T | null {
  if (!existsSync(pfad)) return null
  try {
    return JSON.parse(readFileSync(pfad, 'utf8')) as T
  } catch {
    return null
  }
}

/** Schreibt, wenn sich etwas außer lastUpdated geändert hat oder der Stand alt ist */
function schreibeWennNoetig<T extends { lastUpdated: string }>(pfad: string, neu: T, alt: T | null, jetztMs: number): boolean {
  const ohneStand = (d: T) => JSON.stringify({ ...d, lastUpdated: '' })
  const altMs = alt ? Date.parse(alt.lastUpdated) : 0
  if (alt && ohneStand(alt) === ohneStand(neu) && jetztMs - altMs < NEU_SCHREIBEN_NACH_MS) return false
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, JSON.stringify(neu, null, 1) + '\n')
  return true
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Kalender ────────────────────────────────────────────────────────────────

async function kalenderHolen(jetztMs: number, alt: KalenderDaten | null): Promise<KalenderDaten> {
  const quellen: Record<string, QuelleStatus> = {}
  const termine: KalenderTermin[] = []
  const werte: IndikatorWert[] = []
  const heute = new Date(jetztMs).toISOString().slice(0, 10)

  // USA: Termine über FRED (mit Key)
  const key = process.env.FRED_API_KEY?.trim()
  if (key) {
    for (const r of FRED_RELEASES) {
      try {
        termine.push(...parseFredReleaseDates(JSON.parse(await hole(fredReleaseUrl(r.id, key, heute))), r))
        quellen[`fred-termine-${r.indikator}`] = 'live'
      } catch (e) {
        quellen[`fred-termine-${r.indikator}`] = 'fehler'
        log('FRED-Termine', r.indikator, 'fehlgeschlagen:', (e as Error).message)
      }
    }
  } else {
    quellen['fred-termine'] = 'ohne-key'
    log('FRED_API_KEY fehlt – US-Termine für CPI/Arbeitsmarkt kommen nur aus dem alten Stand')
  }
  // USA: BIP-Termine aus dem BEA-Plan (ohne Key)
  try {
    const bea = parseBeaTermine(await hole('https://www.bea.gov/news/schedule', 'text/html'), jetztMs)
    for (const t of bea) if (!termine.some((x) => x.indikator === 'bip' && x.zeitUtc.slice(0, 10) === t.zeitUtc.slice(0, 10) && x.region === 'us')) termine.push(t)
    quellen.bea = 'live'
  } catch (e) {
    quellen.bea = 'fehler'
    log('BEA fehlgeschlagen:', (e as Error).message)
  }
  // Euroraum: Eurostat-Terminkalender
  try {
    termine.push(...parseEurostatEvents(JSON.parse(await hole(eurostatEventsUrl(jetztMs - 86_400_000, jetztMs + 120 * 86_400_000)))))
    quellen['eurostat-termine'] = 'live'
  } catch (e) {
    quellen['eurostat-termine'] = 'fehler'
    log('Eurostat-Termine fehlgeschlagen:', (e as Error).message)
  }

  // Werte USA (FRED-CSV ohne Key)
  const csvAb = new Date(jetztMs - 450 * 86_400_000).toISOString().slice(0, 10)
  const fredCsv = async (serie: string) => parseFredCsv(await hole(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${serie}&cosd=${csvAb}`, 'text/csv'))
  const usWerte: [string, () => Promise<IndikatorWert | null>][] = [
    ['CPIAUCSL', async () => cpiJahresrate(await fredCsv('CPIAUCSL'))],
    ['UNRATE', async () => letzterWert(await fredCsv('UNRATE'), 'us', 'arbeitsmarkt', 'Arbeitslosenquote USA', '%', 'FRED (UNRATE)', 'https://fred.stlouisfed.org/series/UNRATE')],
    ['PAYEMS', async () => payrollsVeraenderung(await fredCsv('PAYEMS'))],
    ['A191RL1Q225SBEA', async () => letzterWert(await fredCsv('A191RL1Q225SBEA'), 'us', 'bip', 'BIP USA (real, annualisiert)', '% Q/Q ann.', 'FRED (A191RL1Q225SBEA)', 'https://fred.stlouisfed.org/series/A191RL1Q225SBEA', true)],
  ]
  for (const [name, lader] of usWerte) {
    try {
      const w = await lader()
      if (w) werte.push(w)
      quellen[`fred-${name}`] = w ? 'live' : 'fehler'
    } catch (e) {
      quellen[`fred-${name}`] = 'fehler'
      log('FRED', name, 'fehlgeschlagen:', (e as Error).message)
    }
  }
  // Werte Euroraum (Eurostat-API)
  // Euroraum-Geo-Code wandert mit jeder Erweiterung (EA20 → EA21 seit 2026); der erste Code mit Werten gewinnt
  const ES = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
  const GEOS = ['EA21', 'EA20', 'EA']
  const ezWerte: { datensatz: string; filter: string; indikator: IndikatorWert['indikator']; titel: string; einheit: string }[] = [
    { datensatz: 'prc_hicp_manr', filter: 'coicop=CP00&unit=RCH_A', indikator: 'cpi', titel: 'Inflation Euroraum (HVPI)', einheit: '% J/J' },
    { datensatz: 'une_rt_m', filter: 's_adj=SA&age=TOTAL&unit=PC_ACT&sex=T', indikator: 'arbeitsmarkt', titel: 'Arbeitslosenquote Euroraum', einheit: '%' },
    { datensatz: 'namq_10_gdp', filter: 'unit=CLV_PCH_PRE&na_item=B1GQ&s_adj=SCA', indikator: 'bip', titel: 'BIP Euroraum (real)', einheit: '% Q/Q' },
  ]
  for (const d of ezWerte) {
    try {
      let reihe: { periode: string; wert: number }[] = []
      for (const geo of GEOS) {
        reihe = parseEurostatWerte(JSON.parse(await hole(`${ES}${d.datensatz}?geo=${geo}&${d.filter}&lastTimePeriod=3&format=JSON`)))
        if (reihe.length > 0) break
      }
      const w = eurostatWert(reihe, d.indikator, d.titel, d.einheit, d.datensatz)
      if (w) werte.push(w)
      quellen[`eurostat-${d.datensatz}`] = w ? 'live' : 'fehler'
    } catch (e) {
      quellen[`eurostat-${d.datensatz}`] = 'fehler'
      log('Eurostat', d.datensatz, 'fehlgeschlagen:', (e as Error).message)
    }
  }

  // Alte Termine/Werte behalten, wo eine Quelle ausfiel
  if (alt) {
    for (const t of alt.termine) if (!termine.some((x) => x.region === t.region && x.indikator === t.indikator && x.zeitUtc.slice(0, 10) === t.zeitUtc.slice(0, 10))) termine.push(t)
    for (const w of alt.werte) if (!werte.some((x) => x.region === w.region && x.indikator === w.indikator && x.titel === w.titel)) werte.push(w)
    for (const [k, v] of Object.entries(quellen)) if (v === 'fehler' && alt.quellen[k]) quellen[k] = 'alt'
  }

  return {
    version: 1,
    lastUpdated: new Date(jetztMs).toISOString(),
    termine: termineBereinigen(termine, jetztMs),
    werte: werte.sort((a, b) => a.region.localeCompare(b.region) || a.indikator.localeCompare(b.indikator)),
    quellen,
  }
}

// ── News ─────────────────────────────────────────────────────────────────────

async function newsHolen(jetztMs: number, alt: NewsDaten | null): Promise<NewsDaten> {
  const quellen: Record<string, number | string> = {}
  const nachId = new Map<string, NewsEintrag>()
  const uebernehmen = (e: NewsEintrag) => {
    if (Date.parse(e.zeit) < jetztMs - NEWS_FENSTER_MS) return false
    if (nachId.has(e.id)) return false
    nachId.set(e.id, e)
    return true
  }

  for (const feed of FEEDS) {
    try {
      const roh = parseRss(await hole(feed.url, 'application/rss+xml,application/xml,text/xml,*/*'))
      let n = 0
      for (const r of roh) {
        const kategorie = kategorisiere(r.titel, r.text)
        if (!kategorie) continue
        const zeit = r.zeit ?? new Date(jetztMs).toISOString()
        if (uebernehmen({ id: eintragId(r.link), titel: r.titel, link: r.link, quelle: feed.quelle, zeit, kategorie, maerkte: markttags(r.titel, r.text), text: r.text.slice(0, 240) || undefined, sprache: sprache(r.titel, r.text) })) n++
      }
      quellen[feed.quelle] = n
      log(feed.quelle, roh.length, 'Einträge,', n, 'übernommen')
    } catch (e) {
      quellen[feed.quelle] = (e as Error).message.slice(0, 80)
      log(feed.quelle, 'fehlgeschlagen:', (e as Error).message)
    }
  }

  if (process.env.GDELT === '1') {
    for (const g of GDELT) {
      try {
        const p = new URLSearchParams({ query: `${g.query} sourcelang:english`, mode: 'artlist', format: 'json', timespan: '24h', maxrecords: '15', sort: 'datedesc' })
        const json = JSON.parse(await hole(`https://api.gdeltproject.org/api/v2/doc/doc?${p}`)) as { articles?: { title?: string; url?: string; seendate?: string; domain?: string }[] }
        let n = 0
        for (const a of json.articles ?? []) {
          if (!a.title || !a.url) continue
          const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(a.seendate ?? '')
          const zeit = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : new Date(jetztMs).toISOString()
          if (uebernehmen({ id: eintragId(a.url), titel: a.title, link: a.url, quelle: `GDELT · ${a.domain ?? ''}`.trim(), zeit, kategorie: g.kategorie, maerkte: markttags(a.title), sprache: 'en' })) n++
        }
        quellen[`gdelt-${g.kategorie}`] = n
        log('GDELT', g.kategorie, n, 'übernommen')
      } catch (e) {
        quellen[`gdelt-${g.kategorie}`] = (e as Error).message.slice(0, 80)
        log('GDELT', g.kategorie, 'fehlgeschlagen:', (e as Error).message)
      }
      await schlaf(6_000)
    }
  }

  // Alte Einträge im Fenster behalten (Feeds rollen schnell durch)
  if (alt) for (const e of alt.eintraege) uebernehmen(e)

  const eintraege = [...nachId.values()].sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, NEWS_MAX)
  return { version: 1, lastUpdated: new Date(jetztMs).toISOString(), eintraege, quellen }
}

// ── Hauptprogramm ────────────────────────────────────────────────────────────

const jetztMs = Date.now()
const kalenderAlt = liesJson<KalenderDaten>(KALENDER_DATEI)
const newsAlt = liesJson<NewsDaten>(NEWS_DATEI)

const kalender = await kalenderHolen(jetztMs, kalenderAlt)
log('Kalender:', kalender.termine.length, 'Termine,', kalender.werte.length, 'Werte,', JSON.stringify(kalender.quellen))
log(schreibeWennNoetig(KALENDER_DATEI, kalender, kalenderAlt, jetztMs) ? 'kalender.json geschrieben' : 'kalender.json unverändert')

const news = await newsHolen(jetztMs, newsAlt)
log('News:', news.eintraege.length, 'Einträge')
log(schreibeWennNoetig(NEWS_DATEI, news, newsAlt, jetztMs) ? 'news.json geschrieben' : 'news.json unverändert')
