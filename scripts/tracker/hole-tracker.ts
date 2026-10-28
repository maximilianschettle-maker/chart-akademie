// Markt-Tracker: holt Tages- und Stundenkerzen der konfigurierten Instrumente (Yahoo Finance,
// Coinbase als Krypto-Fallback), analysiert beide Ebenen (src/tracker/engine/analyse.ts) und
// schreibt public/data/tracker.json. Läuft in der GitHub Action tracker.yml und lokal:
//   npx tsx scripts/tracker/hole-tracker.ts   (tsx, weil die Engine Code aus src/ ohne Dateiendungen importiert)
// Konfiguration: Worker-KV (/api/tracker, Env AKTIEN_WORKER_URL + AKTIEN_SECRET) → sonst
// data/tracker-config.json → sonst Standard. Gibt `changed=true|false` nach $GITHUB_OUTPUT.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Candle } from '../../src/types'
import type { Ebene, EbeneDaten, Instrument, InstrumentDaten, Signal, TrackerConfig, TrackerDaten } from '../../src/tracker/types'
import { INSTRUMENT_NACH_ID, normalisiereConfig } from '../../src/tracker/engine/katalog'
import { analysiere, analysiereHistorie, kerzenAusKompakt, kerzenKompakt, STANDARD_OPTIONEN, STUNDEN_OPTIONEN } from '../../src/tracker/engine/analyse'

const WURZEL = fileURLToPath(new URL('../../', import.meta.url))
const AUSGABE = join(WURZEL, 'public', 'data', 'tracker.json')
const CONFIG_DATEI = join(WURZEL, 'data', 'tracker-config.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const KERZEN_IM_JSON: Record<Ebene, number> = { tag: 520, stunde: 400 }
/** Für die Analyse (Setup-Erkennung braucht bis zu 420 Kerzen Rückschau) */
const KERZEN_ANALYSE = 600
/** so viele abgeschlossene Kerzen vor der aktuellen werden rückwirkend auf Signale geprüft */
const KERZEN_HISTORIE: Record<Ebene, number> = { tag: 25, stunde: 200 }
const SIGNAL_TAGE = 30
const NEU_SCHREIBEN_NACH_MS = 20 * 3600_000
/** Kursbewegung, ab der ein Lauf trotz sonst gleicher Daten schreibt (Live-Kurse zeigt die App über den Worker) */
const KURS_SCHWELLE = 0.01
const TAG_SEK = 86_400

function log(...t: unknown[]) {
  console.log(new Date().toISOString().slice(11, 19), ...t)
}

async function hole(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,*/*', ...headers }, signal: AbortSignal.timeout(30_000) })
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

// ── Konfiguration ─────────────────────────────────────────────────────────────

async function ladeConfig(): Promise<{ config: TrackerConfig; quelle: TrackerDaten['configQuelle'] }> {
  const url = process.env.AKTIEN_WORKER_URL?.trim().replace(/\/+$/, '')
  const secret = process.env.AKTIEN_SECRET?.trim()
  if (url && secret) {
    try {
      const text = await hole(`${url}/api/tracker`, { Authorization: `Bearer ${secret}` })
      const roh: unknown = text ? JSON.parse(text) : null
      if (roh && typeof roh === 'object' && Array.isArray((roh as TrackerConfig).instrumente)) {
        log('Konfiguration aus dem Worker-KV')
        return { config: normalisiereConfig(roh), quelle: 'worker' }
      }
      log('Worker-KV hat noch keine Tracker-Konfiguration')
    } catch (e) {
      log('Worker nicht erreichbar:', (e as Error).message)
    }
  } else {
    log('AKTIEN_WORKER_URL/AKTIEN_SECRET nicht gesetzt – Konfiguration aus der Datei')
  }
  const datei = liesJson<unknown>(CONFIG_DATEI)
  if (datei) return { config: normalisiereConfig(datei), quelle: 'datei' }
  return { config: normalisiereConfig(null), quelle: 'standard' }
}

// ── Kurse ─────────────────────────────────────────────────────────────────────

interface YahooChart {
  chart?: {
    result?: {
      meta?: { currency?: string; regularMarketPrice?: number; regularMarketTime?: number }
      timestamp?: number[]
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] }
    }[]
    error?: { description?: string } | null
  }
}

interface Geladen {
  kerzen: Candle[]
  kurs?: number
  kursZeit?: string
  quelle: EbeneDaten['quelle']
  fehler?: string
}

function tagesanfang(sek: number): number {
  return Math.floor(sek / TAG_SEK) * TAG_SEK
}

/** Tageskerzen auf den UTC-Tagesanfang normieren (Börsen liefern die Eröffnungszeit), Stundenkerzen bleiben */
export function kerzenAusYahoo(json: YahooChart, ebene: Ebene): { kerzen: Candle[]; kurs?: number; kursZeit?: string } {
  const r = json.chart?.result?.[0]
  if (!r?.timestamp || !r.indicators?.quote?.[0]) throw new Error(json.chart?.error?.description ?? 'Yahoo: leere Antwort')
  const q = r.indicators.quote[0]
  const nachZeit = new Map<number, Candle>()
  r.timestamp.forEach((t, i) => {
    const o = q.open?.[i]
    const h = q.high?.[i]
    const l = q.low?.[i]
    const c = q.close?.[i]
    if (![o, h, l, c].every((x) => typeof x === 'number' && Number.isFinite(x))) return
    const time = ebene === 'tag' ? tagesanfang(t) : t
    nachZeit.set(time, { time, open: o!, high: h!, low: l!, close: c!, volume: typeof q.volume?.[i] === 'number' ? q.volume![i]! : 0 })
  })
  const kerzen = [...nachZeit.values()].sort((a, b) => a.time - b.time)
  if (kerzen.length < 30) throw new Error(`Yahoo: nur ${kerzen.length} Kerzen`)
  const kurs = r.meta?.regularMarketPrice
  const zeit = r.meta?.regularMarketTime
  return {
    kerzen,
    kurs: typeof kurs === 'number' ? kurs : undefined,
    kursZeit: typeof zeit === 'number' ? new Date(zeit * 1000).toISOString() : undefined,
  }
}

async function yahoo(symbol: string, ebene: Ebene) {
  const bereich = ebene === 'tag' ? 'range=2y&interval=1d' : 'range=730d&interval=1h'
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${bereich}`
  return kerzenAusYahoo(JSON.parse(await hole(url)) as YahooChart, ebene)
}

/** Coinbase: [time, low, high, open, close, volume], neueste zuerst, max. 300 */
export function kerzenAusCoinbase(json: unknown, ebene: Ebene): Candle[] {
  if (!Array.isArray(json)) throw new Error('Coinbase: unerwartete Antwort')
  const kerzen = (json as number[][])
    .filter((z) => Array.isArray(z) && z.length >= 6 && z.every((x) => typeof x === 'number'))
    .map((z) => ({ time: ebene === 'tag' ? tagesanfang(z[0]) : z[0], low: z[1], high: z[2], open: z[3], close: z[4], volume: z[5] }))
    .sort((a, b) => a.time - b.time)
  if (kerzen.length < 30) throw new Error(`Coinbase: nur ${kerzen.length} Kerzen`)
  return kerzen
}

async function coinbase(produkt: string, ebene: Ebene) {
  const url = `https://api.exchange.coinbase.com/products/${produkt}/candles?granularity=${ebene === 'tag' ? 86400 : 3600}`
  const kerzen = kerzenAusCoinbase(JSON.parse(await hole(url)), ebene)
  const letzte = kerzen[kerzen.length - 1]
  return { kerzen, kurs: letzte.close, kursZeit: new Date().toISOString() }
}

async function ladeKerzen(inst: Instrument, ebene: Ebene, alt: EbeneDaten | undefined): Promise<Geladen | null> {
  try {
    return { ...(await yahoo(inst.symbol, ebene)), quelle: 'yahoo' }
  } catch (e) {
    log(inst.name, ebene, 'Yahoo fehlgeschlagen:', (e as Error).message)
  }
  if (inst.coinbase) {
    try {
      return { ...(await coinbase(inst.coinbase, ebene)), quelle: 'coinbase' }
    } catch (e) {
      log(inst.name, ebene, 'Coinbase fehlgeschlagen:', (e as Error).message)
    }
  }
  if (alt && alt.kerzen.length) {
    log(inst.name, ebene, 'nutze alten Stand')
    return { kerzen: kerzenAusKompakt(alt.kerzen), kurs: alt.analyse?.kurs, kursZeit: alt.analyse?.kursZeit, quelle: 'alt', fehler: 'Kursquelle nicht erreichbar, alter Stand' }
  }
  return null
}

// ── Lauf ──────────────────────────────────────────────────────────────────────

function signaleZusammen(alt: Signal[], neu: Signal[], jetzt: Date): Signal[] {
  const grenze = new Date(jetzt.getTime() - SIGNAL_TAGE * 86_400_000).toISOString().slice(0, 10)
  const m = new Map<string, Signal>()
  for (const s of alt) if (s.datum >= grenze) m.set(s.id, s)
  for (const s of neu) {
    const vorhanden = m.get(s.id)
    // Erstsichtung behalten, Text/Vorläufigkeit aktualisieren
    m.set(s.id, vorhanden ? { ...s, zeit: vorhanden.zeit } : s)
  }
  return [...m.values()].sort((a, b) => (b.kerzeZeit ?? b.datum).localeCompare(a.kerzeZeit ?? a.datum) || b.zeit.localeCompare(a.zeit))
}

async function ebeneLaden(inst: Instrument, ebene: Ebene, alt: EbeneDaten | undefined, muster: TrackerConfig['muster'], jetzt: Date): Promise<EbeneDaten> {
  const geladen = await ladeKerzen(inst, ebene, alt)
  if (!geladen) return { quelle: 'alt', kerzen: [], analyse: null, signale: alt?.signale ?? [], fehler: 'Keine Kursdaten' }
  const live = geladen.kurs !== undefined && geladen.kursZeit ? { kurs: geladen.kurs, zeit: geladen.kursZeit } : undefined
  const opt = ebene === 'tag' ? STANDARD_OPTIONEN : STUNDEN_OPTIONEN
  const ergebnis = analysiere(geladen.kerzen.slice(-KERZEN_ANALYSE), inst.id, muster, jetzt, live, opt)
  const neueSignale = ergebnis?.signale ?? []
  if (neueSignale.length) log(inst.name, ebene, '→', neueSignale.map((s) => `${s.titel}${s.vorlaeufig ? ' (vorläufig)' : ''}`).join(' | '))
  // Historie nachtragen: nur Ids, die noch kein Lauf gesehen hat (signaleZusammen behält Vorhandenes)
  const bekannt = new Set((alt?.signale ?? []).map((s) => s.id))
  const historie = analysiereHistorie(geladen.kerzen.slice(-KERZEN_ANALYSE), inst.id, muster, opt, KERZEN_HISTORIE[ebene]).filter((s) => !bekannt.has(s.id))
  if (historie.length) log(inst.name, ebene, 'nachgetragen:', historie.length)
  return {
    quelle: geladen.quelle,
    kerzen: kerzenKompakt(geladen.kerzen.slice(-KERZEN_IM_JSON[ebene])),
    analyse: ergebnis?.analyse ?? null,
    signale: signaleZusammen([...(alt?.signale ?? []), ...historie], neueSignale, jetzt),
    ...(geladen.fehler ? { fehler: geladen.fehler } : {}),
  }
}

/** Ohne Lauf-Zeitstempel, ohne schwankende Kursfelder und ohne die jeweils offene letzte Kerze */
function kern(d: TrackerDaten): string {
  const ebeneKern = (e: EbeneDaten | undefined) =>
    e && {
      quelle: e.quelle,
      kerzen: e.kerzen.slice(0, -1),
      analyse: e.analyse ? { ...e.analyse, kurs: 0, kursZeit: '', aenderungTag: 0 } : null,
      signale: e.signale.map((s) => ({ ...s, zeit: '' })),
      fehler: e.fehler,
    }
  return JSON.stringify({
    config: d.config,
    instrumente: d.instrumente.map((i) => ({
      id: i.id,
      tag: ebeneKern({ quelle: i.quelle, kerzen: i.kerzen, analyse: i.analyse, signale: i.signale, fehler: i.fehler }),
      stunde: ebeneKern(i.stunde),
    })),
  })
}

async function main() {
  const jetzt = new Date()
  const alt = liesJson<TrackerDaten>(AUSGABE)
  const { config, quelle } = await ladeConfig()
  const an = (m: TrackerConfig['muster']) => Object.entries(m).filter(([, x]) => x).map(([k]) => k).join(', ') || 'keine'
  log('Instrumente:', config.instrumente.join(', '), '· Muster Tag:', an(config.muster), '· Muster Stunde:', an(config.musterStunde))

  const instrumente: InstrumentDaten[] = []
  for (const id of config.instrumente) {
    const inst = INSTRUMENT_NACH_ID[id]
    if (!inst) continue
    const vorher = alt?.instrumente.find((i) => i.id === id)
    const altTag: EbeneDaten | undefined = vorher ? { quelle: vorher.quelle, kerzen: vorher.kerzen, analyse: vorher.analyse, signale: vorher.signale } : undefined
    const tag = await ebeneLaden(inst, 'tag', altTag, config.muster, jetzt)
    const stunde = await ebeneLaden(inst, 'stunde', vorher?.stunde, config.musterStunde, jetzt)
    instrumente.push({
      id,
      name: inst.name,
      symbol: inst.symbol,
      waehrung: inst.waehrung,
      dezimalen: inst.dezimalen,
      quelle: tag.quelle,
      kerzen: tag.kerzen,
      analyse: tag.analyse,
      signale: tag.signale,
      ...(tag.fehler ? { fehler: tag.fehler } : {}),
      stunde,
    })
  }

  const daten: TrackerDaten = { version: 1, lastUpdated: alt?.lastUpdated ?? jetzt.toISOString(), config, configQuelle: quelle, instrumente }
  mkdirSync(dirname(AUSGABE), { recursive: true })

  const kernGleich = alt !== null && kern(alt) === kern(daten)
  const kursBewegt = instrumente.some((i) => {
    const a = alt?.instrumente.find((x) => x.id === i.id)?.analyse?.kurs
    return i.analyse && a ? Math.abs(i.analyse.kurs / a - 1) >= KURS_SCHWELLE : false
  })
  const altAlter = alt ? jetzt.getTime() - Date.parse(alt.lastUpdated) : Number.POSITIVE_INFINITY
  const schreiben = !kernGleich || kursBewegt || !(altAlter < NEU_SCHREIBEN_NACH_MS)
  if (schreiben) {
    daten.lastUpdated = jetzt.toISOString()
    writeFileSync(AUSGABE, JSON.stringify(daten) + '\n')
    log(kernGleich ? (kursBewegt ? 'Kurse bewegt, geschrieben' : 'Stand aufgefrischt') : 'tracker.json geschrieben', `(${instrumente.length} Instrumente, ${Math.round(JSON.stringify(daten).length / 1024)} KB)`)
  } else {
    log('Keine wesentliche Änderung, nichts geschrieben')
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${schreiben}\n`)
  if (instrumente.some((i) => i.fehler || i.stunde?.fehler)) process.exitCode = 2
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
