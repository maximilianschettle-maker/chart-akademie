// SEC EDGAR: Symbol → CIK, dann je Kennzahl kleine companyconcept-Anfragen
// (statt des 1–4 MB großen companyfacts-Dokuments — Worker haben 10 ms CPU je Aufruf).
import type { SecTeil } from '../../src/aktien/types'
import {
  SEC_FELDER,
  cikIndexBauen,
  cikSuchen,
  einheitSchluessel,
  reiheAus,
  reiheReichtAus,
  reihenVereinen,
  secJahre,
  secQuartale,
  waehrungAusKonzept,
  type CikIndex,
  type Reihe,
  type SecKonzept,
  type SecKonzepte,
  type SecTickerEintrag,
  type Taxonomie,
} from '../../src/aktien/engine/sec'
import { mitKv } from './cache'
import { HttpFehler, parallelBegrenzt, type Env } from './http'

const CIK_INDEX_FRISCHE = 30 * 86_400_000
/** Obergrenze an SEC-Anfragen je Firma (Worker: 50 Subrequests je Aufruf) */
const ANFRAGEN_BUDGET = 40
/** Einträge vor diesem Datum werden verworfen (kleinere KV-Einträge, weniger CPU) */
const AB_DATUM = '2009-01-01'

function kopf(env: Env): HeadersInit {
  if (!env.SEC_USER_AGENT) throw new HttpFehler('SEC_USER_AGENT ist im Worker nicht gesetzt', 500)
  return { 'User-Agent': env.SEC_USER_AGENT, 'Accept-Encoding': 'gzip, deflate', Accept: 'application/json' }
}

async function secAbruf(env: Env, url: string): Promise<Response> {
  const res = await fetch(url, { headers: kopf(env), signal: AbortSignal.timeout(15_000) })
  if (res.status === 429) throw new HttpFehler('SEC bremst (429) — kurz warten', 503)
  if (res.status === 403) throw new HttpFehler('SEC lehnt die Anfrage ab (403) — User-Agent prüfen oder IP gesperrt', 502)
  return res
}

export async function cikIndex(env: Env, frisch = false): Promise<CikIndex> {
  const r = await mitKv(env, 'sec:cik-index', CIK_INDEX_FRISCHE, frisch, async () => {
    const res = await secAbruf(env, 'https://www.sec.gov/files/company_tickers.json')
    if (!res.ok) throw new HttpFehler(`SEC Ticker-Liste: HTTP ${res.status}`, 502)
    const liste = (await res.json()) as Record<string, SecTickerEintrag>
    return cikIndexBauen(liste)
  })
  return r.daten
}

async function konzept(env: Env, cik: string, tax: Taxonomie, tag: string): Promise<SecKonzept | null> {
  const res = await secAbruf(env, `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${tax}/${tag}.json`)
  if (res.status === 404) return null
  if (!res.ok) throw new HttpFehler(`SEC ${tax}/${tag}: HTTP ${res.status}`, 502)
  const d = (await res.json()) as SecKonzept
  for (const einheit of Object.keys(d.units)) d.units[einheit] = d.units[einheit].filter((e) => e.end >= AB_DATUM)
  return d
}

export interface SecAbfrage {
  symbol: string
  /** Firmenname von Yahoo für den Namensabgleich */
  name?: string
  /** Berichtswährung von Yahoo (sonst aus den SEC-Einheiten geraten) */
  waehrung?: string
  /** manuell gesetzte CIK überstimmt die Suche */
  cikManuell?: string
}

export async function cikErmitteln(env: Env, a: SecAbfrage): Promise<{ cik: string; zuordnung: SecTeil['zuordnung'] } | null> {
  if (a.cikManuell) return { cik: a.cikManuell.replace(/\D/g, '').padStart(10, '0'), zuordnung: 'manuell' }
  const index = await cikIndex(env)
  return cikSuchen(index, a.symbol, a.name)
}

/** Holt alle Kennzahlen-Konzepte einer Firma mit Anfragen-Budget; null-Einträge = 404. */
export async function konzepteHolen(env: Env, cik: string, waehrungVorgabe?: string): Promise<{ konzepte: SecKonzepte; waehrung: string; anfragen: number }> {
  const konzepte: SecKonzepte = {}
  let anfragen = 0
  let taxonomie: Exclude<Taxonomie, 'dei'> | null = null
  let waehrung = waehrungVorgabe ?? ''

  // Erster Schritt: Umsatz-Konzepte bestimmen Taxonomie und Währung (sequentiell, damit
  // der Rest gezielt nur eine Taxonomie abfragt).
  const umsatz = SEC_FELDER[0]
  for (const tax of ['us-gaap', 'ifrs-full'] as const) {
    for (const tag of umsatz.kandidaten[tax] ?? []) {
      if (taxonomie && taxonomie !== tax) break
      anfragen++
      const k = await konzept(env, cik, tax, tag)
      konzepte[`${tax}:${tag}`] = k
      if (!k) continue
      taxonomie = tax
      if (!waehrung) waehrung = waehrungAusKonzept(k) ?? 'USD'
      if (reiheReichtAus(reiheAus(k, waehrung, { zeitraum: 'FY', art: 'fluss' }))) break
    }
    if (taxonomie) break
  }
  if (!taxonomie) throw new HttpFehler('Bei der SEC gibt es zu dieser CIK keine XBRL-Umsatzdaten', 404)
  const tax = taxonomie

  // Übrige Felder parallel (max. 5 gleichzeitig), je Feld Kandidaten nacheinander bis die Reihe reicht.
  const aufgaben = SEC_FELDER.slice(1).map((def) => async () => {
    const taxonomien: Taxonomie[] = def.kandidaten.dei ? ['dei'] : [tax]
    let reihe: Reihe = { werte: new Map() }
    for (const t of taxonomien) {
      for (const tag of def.kandidaten[t] ?? []) {
        if (anfragen >= ANFRAGEN_BUDGET) return
        anfragen++
        const k = await konzept(env, cik, t, tag)
        konzepte[`${t}:${tag}`] = k
        if (!k) continue
        reihe = reihenVereinen([reihe, reiheAus(k, einheitSchluessel(def.einheit, waehrung), { zeitraum: 'FY', art: def.art }, def)])
        if (reiheReichtAus(reihe)) return
      }
    }
  })
  await parallelBegrenzt(aufgaben, 5)
  return { konzepte, waehrung, anfragen }
}

export async function secTeilLaden(env: Env, a: SecAbfrage): Promise<SecTeil | null> {
  const zuordnung = await cikErmitteln(env, a)
  if (!zuordnung) return null
  const { konzepte, waehrung } = await konzepteHolen(env, zuordnung.cik, a.waehrung)
  const jahre = secJahre(konzepte, waehrung)
  if (jahre.length === 0) throw new HttpFehler(`SEC: keine Jahresabschlüsse in ${waehrung} gefunden`, 404)
  const quartale = secQuartale(konzepte, waehrung, jahre)
  const name = Object.values(konzepte).find((k) => k)?.entityName ?? a.name ?? a.symbol
  return { cik: zuordnung.cik, name, zuordnung: zuordnung.zuordnung, jahre, quartale, standAm: Date.now() }
}
