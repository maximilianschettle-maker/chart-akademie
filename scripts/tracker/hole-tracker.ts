// Markt-Tracker: holt Tageskerzen der konfigurierten Instrumente (Yahoo Finance, Coinbase als
// Krypto-Fallback), analysiert sie (src/tracker/engine/analyse.ts) und schreibt
// public/data/tracker.json. Läuft in der GitHub Action tracker.yml und lokal:
//   npx tsx scripts/tracker/hole-tracker.ts   (tsx, weil die Engine Code aus src/ ohne Dateiendungen importiert)
// Konfiguration: Worker-KV (/api/tracker, Env AKTIEN_WORKER_URL + AKTIEN_SECRET) → sonst
// data/tracker-config.json → sonst Standard. Gibt `changed=true|false` nach $GITHUB_OUTPUT.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Candle } from '../../src/types'
import type { Instrument, InstrumentDaten, Signal, TrackerConfig, TrackerDaten } from '../../src/tracker/types'
import { INSTRUMENT_NACH_ID, normalisiereConfig } from '../../src/tracker/engine/katalog'
import { analysiere, kerzenAusKompakt, kerzenKompakt } from '../../src/tracker/engine/analyse'

const WURZEL = fileURLToPath(new URL('../../', import.meta.url))
const AUSGABE = join(WURZEL, 'public', 'data', 'tracker.json')
const CONFIG_DATEI = join(WURZEL, 'data', 'tracker-config.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const KERZEN_IM_JSON = 520
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

function tagesanfang(sek: number): number {
  return Math.floor(sek / TAG_SEK) * TAG_SEK
}

export function kerzenAusYahoo(json: YahooChart): { kerzen: Candle[]; kurs?: number; kursZeit?: string } {
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
    const time = tagesanfang(t)
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

async function yahoo(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`
  return kerzenAusYahoo(JSON.parse(await hole(url)) as YahooChart)
}

/** Coinbase: [time, low, high, open, close, volume], neueste zuerst, max. 300 */
export function kerzenAusCoinbase(json: unknown): Candle[] {
  if (!Array.isArray(json)) throw new Error('Coinbase: unerwartete Antwort')
  const kerzen = (json as number[][])
    .filter((z) => Array.isArray(z) && z.length >= 6 && z.every((x) => typeof x === 'number'))
    .map((z) => ({ time: tagesanfang(z[0]), low: z[1], high: z[2], open: z[3], close: z[4], volume: z[5] }))
    .sort((a, b) => a.time - b.time)
  if (kerzen.length < 30) throw new Error(`Coinbase: nur ${kerzen.length} Kerzen`)
  return kerzen
}

async function coinbase(produkt: string) {
  const url = `https://api.exchange.coinbase.com/products/${produkt}/candles?granularity=86400`
  const kerzen = kerzenAusCoinbase(JSON.parse(await hole(url)))
  const letzte = kerzen[kerzen.length - 1]
  return { kerzen, kurs: letzte.close, kursZeit: new Date().toISOString() }
}

async function ladeKerzen(inst: Instrument, alt: InstrumentDaten | undefined) {
  try {
    const r = await yahoo(inst.symbol)
    return { ...r, quelle: 'yahoo' as const }
  } catch (e) {
    log(inst.name, 'Yahoo fehlgeschlagen:', (e as Error).message)
  }
  if (inst.coinbase) {
    try {
      const r = await coinbase(inst.coinbase)
      return { ...r, quelle: 'coinbase' as const }
    } catch (e) {
      log(inst.name, 'Coinbase fehlgeschlagen:', (e as Error).message)
    }
  }
  if (alt && alt.kerzen.length) {
    log(inst.name, 'nutze alten Stand')
    return { kerzen: kerzenAusKompakt(alt.kerzen), kurs: alt.analyse?.kurs, kursZeit: alt.analyse?.kursZeit, quelle: 'alt' as const, fehler: 'Kursquelle nicht erreichbar, alter Stand' }
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
  return [...m.values()].sort((a, b) => b.datum.localeCompare(a.datum) || b.zeit.localeCompare(a.zeit))
}

/** Ohne Lauf-Zeitstempel und ohne die laufend schwankenden Kursfelder */
function kern(d: TrackerDaten): string {
  return JSON.stringify({
    config: d.config,
    instrumente: d.instrumente.map((i) => ({
      ...i,
      analyse: i.analyse ? { ...i.analyse, kurs: 0, kursZeit: '', aenderungTag: 0 } : null,
      signale: i.signale.map((s) => ({ ...s, zeit: '' })),
    })),
  })
}

async function main() {
  const jetzt = new Date()
  const alt = liesJson<TrackerDaten>(AUSGABE)
  const { config, quelle } = await ladeConfig()
  log('Instrumente:', config.instrumente.join(', '), '· Muster:', Object.entries(config.muster).filter(([, an]) => an).map(([m]) => m).join(', '))

  const instrumente: InstrumentDaten[] = []
  for (const id of config.instrumente) {
    const inst = INSTRUMENT_NACH_ID[id]
    if (!inst) continue
    const vorher = alt?.instrumente.find((i) => i.id === id)
    const geladen = await ladeKerzen(inst, vorher)
    const basis: InstrumentDaten = {
      id,
      name: inst.name,
      symbol: inst.symbol,
      waehrung: inst.waehrung,
      dezimalen: inst.dezimalen,
      quelle: geladen?.quelle ?? 'alt',
      kerzen: [],
      analyse: null,
      signale: vorher?.signale ?? [],
    }
    if (!geladen) {
      instrumente.push({ ...basis, fehler: 'Keine Kursdaten' })
      continue
    }
    const live = geladen.kurs !== undefined && geladen.kursZeit ? { kurs: geladen.kurs, zeit: geladen.kursZeit } : undefined
    const ergebnis = analysiere(geladen.kerzen, id, config.muster, jetzt, live)
    const neueSignale = ergebnis?.signale ?? []
    if (neueSignale.length) log(inst.name, '→', neueSignale.map((s) => `${s.titel}${s.vorlaeufig ? ' (vorläufig)' : ''}`).join(' | '))
    instrumente.push({
      ...basis,
      kerzen: kerzenKompakt(geladen.kerzen.slice(-KERZEN_IM_JSON)),
      analyse: ergebnis?.analyse ?? null,
      signale: signaleZusammen(vorher?.signale ?? [], neueSignale, jetzt),
      ...('fehler' in geladen && geladen.fehler ? { fehler: geladen.fehler } : {}),
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
    log(kernGleich ? (kursBewegt ? 'Kurse bewegt, geschrieben' : 'Stand aufgefrischt') : 'tracker.json geschrieben', `(${instrumente.length} Instrumente)`)
  } else {
    log('Keine wesentliche Änderung, nichts geschrieben')
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${schreiben}\n`)
  if (instrumente.some((i) => i.fehler)) process.exitCode = 2
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
