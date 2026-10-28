// Holt Zinsdaten und Termine von Fed und EZB und schreibt public/data/macro.json sowie
// public/data/zinsentscheidungen.ics. Läuft in der GitHub Action (macro.yml) und lokal:
//   node scripts/macro/hole-macro.ts
// Env: FRED_API_KEY (optional, sonst CSV-Export ohne Key), VAPID_PUBLIC_KEY (optional).
// Schreibt nur, wenn sich inhaltlich etwas geändert hat oder der Stand älter als 20 h ist;
// gibt `changed=true|false` nach $GITHUB_OUTPUT.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Entscheidung, EzbDaten, FedDaten, MakroDaten, Meldung, QuellenStatus, ZinsTermin } from '../../src/makro/types.ts'
import { FED_RSS_URL, FRED_CSV, fredApiUrl, parseFedStatement, parseFredCsv, parseFredJson, parseRss, verdichteFed } from './fed.ts'
import { FOMC_KALENDER_URL, fedTermin, parseFomcKalender } from './fomc.ts'
import { EZB_DFR_URL, EZB_KALENDER_URL, EZB_RSS_URL, ezbTermin, parseEzbEntscheidung, parseEzbKalender, parseEzbZinsen } from './ezb.ts'
import { erzeugeIcs } from './ics.ts'
import { fedKorridor, fmtProzent } from './push-logik.ts'
import { datumInZone, datumPlus, istIsoDatum, ZONE_EZB, ZONE_FED } from './zeit.ts'

const WURZEL = fileURLToPath(new URL('../../', import.meta.url))
const AUSGABE = join(WURZEL, 'public', 'data', 'macro.json')
const ICS_DATEI = join(WURZEL, 'public', 'data', 'zinsentscheidungen.ics')
const FOMC_FALLBACK = join(WURZEL, 'data', 'fomc-dates.json')
const EZB_FALLBACK = join(WURZEL, 'data', 'ezb-dates.json')
const UA = 'ChartAkademie-Makro/1 (+https://github.com/maximilianschettle-maker/chart-akademie)'
const MAX_MELDUNGEN = 12
const NEU_SCHREIBEN_NACH_MS = 20 * 3600_000

function log(...t: unknown[]) {
  console.log(new Date().toISOString().slice(11, 19), ...t)
}

async function hole(url: string, akzept = 'text/html,application/xml,application/json,*/*'): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: akzept },
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} für ${url}`)
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

interface FallbackDatei {
  termine: { datum: string; beginn?: string; sep?: boolean; hinweis?: string }[]
}

function fallbackTermine(pfad: string, bank: 'fed' | 'ezb'): ZinsTermin[] {
  const datei = liesJson<FallbackDatei>(pfad)
  if (!datei || !Array.isArray(datei.termine)) throw new Error(`Fallback-Datei fehlt oder ist unlesbar: ${pfad}`)
  return datei.termine
    .filter((t) => istIsoDatum(t.datum))
    .map((t) => {
      const rest: Partial<ZinsTermin> = {}
      if (istIsoDatum(t.beginn)) rest.beginn = t.beginn
      if (bank === 'fed') rest.sep = Boolean(t.sep)
      if (t.hinweis) rest.hinweis = t.hinweis
      return bank === 'fed' ? fedTermin(t.datum, rest) : ezbTermin(t.datum, rest)
    })
    .sort((a, b) => a.datum.localeCompare(b.datum))
}

/** Termine zusammenführen: `vorrang` gewinnt bei gleichem Datum */
function vereinige(basis: ZinsTermin[], vorrang: ZinsTermin[]): ZinsTermin[] {
  const m = new Map(basis.map((t) => [t.datum, t]))
  for (const t of vorrang) m.set(t.datum, { ...m.get(t.datum), ...t })
  return [...m.values()].sort((a, b) => a.datum.localeCompare(b.datum))
}

function bpText(bp: number): string {
  return bp === 0 ? 'unverändert' : bp < 0 ? `gesenkt um ${Math.abs(bp)} Bp` : `erhöht um ${bp} Bp`
}

async function main() {
  const jetzt = new Date()
  const alt = liesJson<MakroDaten>(AUSGABE)
  const quellen: Record<string, QuellenStatus> = {}
  const apiKey = process.env.FRED_API_KEY?.trim()

  // ── Fed: Zinskorridor ──────────────────────────────────────────────────────
  let fedHistorie = alt?.fed.historie ?? []
  try {
    if (apiKey) {
      const [o, u] = await Promise.all([
        hole(fredApiUrl('DFEDTARU', apiKey), 'application/json').then((t) => parseFredJson(JSON.parse(t))),
        hole(fredApiUrl('DFEDTARL', apiKey), 'application/json').then((t) => parseFredJson(JSON.parse(t))),
      ])
      fedHistorie = verdichteFed(o, u)
      quellen.fedZins = 'live'
      log('Fed-Zins über FRED-API:', fedHistorie.length, 'Änderungen')
    } else {
      const csv = parseFredCsv(await hole(FRED_CSV, 'text/csv'))
      fedHistorie = verdichteFed(csv.oben, csv.unten)
      quellen.fedZins = 'live'
      log('Fed-Zins über FRED-CSV (kein API-Key):', fedHistorie.length, 'Änderungen')
    }
  } catch (e) {
    quellen.fedZins = fedHistorie.length ? 'alt' : 'fehler'
    log('Fed-Zins fehlgeschlagen:', (e as Error).message)
  }

  // ── Fed: FOMC-Termine ──────────────────────────────────────────────────────
  let fedTermine: ZinsTermin[] = []
  try {
    fedTermine = parseFomcKalender(await hole(FOMC_KALENDER_URL), jetzt)
    quellen.fedTermine = 'live'
    log('FOMC-Kalender:', fedTermine.length, 'Sitzungen')
  } catch (e) {
    log('FOMC-Kalender fehlgeschlagen:', (e as Error).message)
    try {
      fedTermine = fallbackTermine(FOMC_FALLBACK, 'fed')
      quellen.fedTermine = 'fallback'
    } catch (e2) {
      fedTermine = alt?.fed.termine ?? []
      quellen.fedTermine = fedTermine.length ? 'alt' : 'fehler'
      log((e2 as Error).message)
    }
  }

  // ── Fed: Pressemitteilungen ────────────────────────────────────────────────
  let fedMeldungen: Meldung[] = alt?.fed.meldungen ?? []
  try {
    fedMeldungen = parseRss(await hole(FED_RSS_URL, 'application/rss+xml,application/xml')).slice(0, MAX_MELDUNGEN)
    quellen.fedMeldungen = 'live'
  } catch (e) {
    quellen.fedMeldungen = fedMeldungen.length ? 'alt' : 'fehler'
    log('Fed-RSS fehlgeschlagen:', (e as Error).message)
  }

  const fedEntscheidung = await ermittleFedEntscheidung(fedTermine, fedMeldungen, fedHistorie, alt?.fed.letzteEntscheidung ?? null, jetzt)

  // ── EZB: Einlagezins ───────────────────────────────────────────────────────
  let ezbHistorie = alt?.ezb.historie ?? []
  try {
    ezbHistorie = parseEzbZinsen(JSON.parse(await hole(EZB_DFR_URL, 'application/json')))
    quellen.ezbZins = 'live'
    log('EZB-Einlagezins:', ezbHistorie.length, 'Änderungen')
  } catch (e) {
    quellen.ezbZins = ezbHistorie.length ? 'alt' : 'fehler'
    log('EZB-Zins fehlgeschlagen:', (e as Error).message)
  }

  // ── EZB: Ratssitzungen (live nur künftige → mit Fallback-Datei vereinigen) ─
  let ezbTermine: ZinsTermin[] = []
  try {
    ezbTermine = fallbackTermine(EZB_FALLBACK, 'ezb')
    quellen.ezbTermine = 'fallback'
  } catch (e) {
    ezbTermine = alt?.ezb.termine ?? []
    log((e as Error).message)
  }
  try {
    const live = parseEzbKalender(await hole(EZB_KALENDER_URL))
    ezbTermine = vereinige(ezbTermine, live)
    quellen.ezbTermine = 'live'
    log('EZB-Kalender:', live.length, 'künftige Sitzungen, gesamt', ezbTermine.length)
  } catch (e) {
    if (!ezbTermine.length) quellen.ezbTermine = 'fehler'
    log('EZB-Kalender fehlgeschlagen:', (e as Error).message)
  }

  // ── EZB: Pressemitteilungen (allgemeiner Feed, gefiltert auf Geldpolitik) ──
  let ezbMeldungen: Meldung[] = alt?.ezb.meldungen ?? []
  try {
    const alle = parseRss(await hole(EZB_RSS_URL, 'application/rss+xml,application/xml'))
    const geldpolitik = alle.filter((m) => /monetary policy (decisions|statement)|interest rate/i.test(m.titel))
    // Alte geldpolitische Meldungen behalten, damit der Link zur letzten Entscheidung nicht aus dem Feed fällt
    const bekannt = new Map(ezbMeldungen.map((m) => [m.link, m]))
    for (const m of geldpolitik) bekannt.set(m.link, m)
    ezbMeldungen = [...bekannt.values()].sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, MAX_MELDUNGEN)
    quellen.ezbMeldungen = 'live'
  } catch (e) {
    quellen.ezbMeldungen = ezbMeldungen.length ? 'alt' : 'fehler'
    log('EZB-RSS fehlgeschlagen:', (e as Error).message)
  }

  const ezbEntscheidung = await ermittleEzbEntscheidung(ezbTermine, ezbMeldungen, ezbHistorie, alt?.ezb.letzteEntscheidung ?? null, jetzt)

  // ── Zusammenbauen ──────────────────────────────────────────────────────────
  const fed: FedDaten = {
    zins: fedZinsAus(fedHistorie),
    historie: fedHistorie,
    termine: fedTermine,
    meldungen: fedMeldungen,
    letzteEntscheidung: fedEntscheidung,
  }
  const ezb: EzbDaten = {
    zins: ezbZinsAus(ezbHistorie),
    historie: ezbHistorie,
    termine: ezbTermine,
    meldungen: ezbMeldungen,
    letzteEntscheidung: ezbEntscheidung,
  }
  const daten: MakroDaten = {
    version: 1,
    lastUpdated: alt?.lastUpdated ?? jetzt.toISOString(),
    quellen,
    fed,
    ezb,
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  if (publicKey) daten.push = { publicKey }
  else if (alt?.push) daten.push = alt.push

  mkdirSync(dirname(AUSGABE), { recursive: true })
  const ics = erzeugeIcs([
    ...fedTermine.map((termin) => ({ bank: 'fed' as const, termin })),
    ...ezbTermine.map((termin) => ({ bank: 'ezb' as const, termin })),
  ])
  const altIcs = existsSync(ICS_DATEI) ? readFileSync(ICS_DATEI, 'utf8') : ''
  if (ics !== altIcs) writeFileSync(ICS_DATEI, ics)

  const inhaltGleich = alt !== null && JSON.stringify({ ...alt, lastUpdated: '' }) === JSON.stringify({ ...daten, lastUpdated: '' })
  const altAlter = alt ? jetzt.getTime() - Date.parse(alt.lastUpdated) : Number.POSITIVE_INFINITY
  const schreiben = !inhaltGleich || !(altAlter < NEU_SCHREIBEN_NACH_MS)
  if (schreiben) {
    daten.lastUpdated = jetzt.toISOString()
    writeFileSync(AUSGABE, JSON.stringify(daten, null, 2) + '\n')
    log(inhaltGleich ? 'Inhalt gleich, Stand aufgefrischt' : 'macro.json geschrieben', AUSGABE)
  } else {
    log('Keine Änderung, nichts geschrieben')
  }
  const geaendert = schreiben || ics !== altIcs
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${geaendert}\n`)
  log('Quellen:', JSON.stringify(quellen))
  const fehler = Object.values(quellen).filter((q) => q === 'fehler')
  if (fehler.length) process.exitCode = 2
}

function fedZinsAus(historie: FedDaten['historie']): FedDaten['zins'] {
  const n = historie.length
  if (n === 0) return null
  const akt = historie[n - 1]
  const vor = historie[n - 2]
  return {
    oben: akt.oben,
    unten: akt.unten,
    gueltigAb: akt.datum,
    letzteAenderungBp: vor ? Math.round((akt.oben - vor.oben) * 100) : 0,
    letzteAenderungAm: akt.datum,
  }
}

function ezbZinsAus(historie: EzbDaten['historie']): EzbDaten['zins'] {
  const n = historie.length
  if (n === 0) return null
  const akt = historie[n - 1]
  const vor = historie[n - 2]
  return {
    einlage: akt.einlage,
    gueltigAb: akt.datum,
    letzteAenderungBp: vor ? Math.round((akt.einlage - vor.einlage) * 100) : 0,
    letzteAenderungAm: akt.datum,
  }
}

function letzterVergangener(termine: ZinsTermin[], jetzt: Date): ZinsTermin | undefined {
  return termine.filter((t) => Date.parse(t.entscheidungUtc) <= jetzt.getTime()).at(-1)
}

const HISTORIE_NACHLAUF_TAGE = 10

/**
 * Wenn keine Pressemitteilung mehr auffindbar ist (Feed zeigt nur die letzten Wochen):
 * Ergebnis aus der Zinshistorie ableiten, sobald die Sitzung lange genug zurückliegt,
 * dass eine Änderung in Kraft getreten wäre.
 */
function entscheidungAusHistorie(
  termin: ZinsTermin,
  stand: { datum: string; wert: number }[],
  format: (wert: number) => string,
  jetzt: Date,
): Entscheidung | null {
  const T = Date.parse(termin.entscheidungUtc)
  if (jetzt.getTime() - T < HISTORIE_NACHLAUF_TAGE * 86400_000) return null
  const grenze = datumPlus(termin.datum, HISTORIE_NACHLAUF_TAGE)
  const vorher = stand.filter((h) => h.datum <= termin.datum).at(-1)
  const danach = stand.find((h) => h.datum > termin.datum && h.datum <= grenze)
  if (!vorher && !danach) return null
  const neu = danach ?? vorher!
  const bp = vorher ? Math.round((neu.wert - vorher.wert) * 100) : 0
  const text = `${bpText(bp)} ${bp === 0 ? '' : 'auf '}${format(neu.wert)}`.replace(/\s+/g, ' ').trim()
  const e: Entscheidung = { datum: termin.datum, text, aenderungBp: bp }
  if (termin.statementUrl) e.link = termin.statementUrl
  return e
}

async function ermittleFedEntscheidung(
  termine: ZinsTermin[],
  meldungen: Meldung[],
  historie: FedDaten['historie'],
  alt: Entscheidung | null,
  jetzt: Date,
): Promise<Entscheidung | null> {
  const termin = letzterVergangener(termine, jetzt)
  if (!termin) return alt
  if (alt && alt.datum === termin.datum) return alt
  const statement = meldungen.find(
    (m) => /FOMC statement/i.test(m.titel) && datumInZone(new Date(m.datum), ZONE_FED) === termin.datum,
  )
  const link = statement?.link ?? termin.statementUrl
  if (!link) {
    log('Fed: Statement für', termin.datum, 'noch nicht im Feed')
    return (
      entscheidungAusHistorie(
        termin,
        historie.map((h) => ({ datum: h.datum, wert: h.oben })),
        (oben) => {
          const p = historie.find((h) => h.oben === oben)
          return p ? fedKorridor(p.unten, p.oben) : `${fmtProzent(oben)} %`
        },
        jetzt,
      ) ?? alt
    )
  }
  try {
    const bereich = parseFedStatement(await hole(link))
    const vorher = historie.filter((h) => h.datum <= termin.datum).at(-1)
    if (!bereich) return { datum: termin.datum, link, text: 'Statement veröffentlicht' }
    const bp = vorher ? Math.round((bereich.oben - vorher.oben) * 100) : undefined
    const text = `${bp === undefined ? '' : bpText(bp) + ' '}${bp === undefined || bp === 0 ? '' : 'auf '}${fedKorridor(bereich.unten, bereich.oben)}`.trim()
    log('Fed-Entscheidung', termin.datum, text)
    return bp === undefined ? { datum: termin.datum, link, text } : { datum: termin.datum, link, text, aenderungBp: bp }
  } catch (e) {
    log('Fed-Statement nicht lesbar:', (e as Error).message)
    return alt
  }
}

async function ermittleEzbEntscheidung(
  termine: ZinsTermin[],
  meldungen: Meldung[],
  historie: EzbDaten['historie'],
  alt: Entscheidung | null,
  jetzt: Date,
): Promise<Entscheidung | null> {
  const termin = letzterVergangener(termine, jetzt)
  if (!termin) return alt
  if (alt && alt.datum === termin.datum) return alt
  const meldung = meldungen.find(
    (m) => /monetary policy decisions/i.test(m.titel) && datumInZone(new Date(m.datum), ZONE_EZB) === termin.datum,
  )
  if (!meldung) {
    log('EZB: Pressemitteilung für', termin.datum, 'nicht im Feed')
    return (
      entscheidungAusHistorie(
        termin,
        historie.map((h) => ({ datum: h.datum, wert: h.einlage })),
        (w) => `${fmtProzent(w)} %`,
        jetzt,
      ) ?? alt
    )
  }
  try {
    const ergebnis = parseEzbEntscheidung(await hole(meldung.link))
    if (!ergebnis) return { datum: termin.datum, link: meldung.link, text: 'Entscheidung veröffentlicht' }
    const vorher = historie.filter((h) => h.datum <= termin.datum).at(-1)
    const bp = vorher ? Math.round((ergebnis.einlage - vorher.einlage) * 100) : ergebnis.unveraendert ? 0 : undefined
    const text = `${bp === undefined ? '' : bpText(bp) + ' '}${bp === undefined || bp === 0 ? '' : 'auf '}${fmtProzent(ergebnis.einlage)} %`.trim()
    log('EZB-Entscheidung', termin.datum, text)
    return bp === undefined ? { datum: termin.datum, link: meldung.link, text } : { datum: termin.datum, link: meldung.link, text, aenderungBp: bp }
  } catch (e) {
    log('EZB-Pressemitteilung nicht lesbar:', (e as Error).message)
    return alt
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
