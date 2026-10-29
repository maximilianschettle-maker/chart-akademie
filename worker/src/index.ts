// Cloudflare Worker: Proxy + Cache für den Aktien-Bereich der ChartAkademie.
// Quellen: SEC EDGAR (XBRL) und Yahoo Finance. Kein Anbieter-Schlüssel nötig;
// der Worker selbst ist mit AKTIEN_SECRET (Bearer) geschützt.
//
//   GET  /api/status[?pruefen=1]          Version, Cron-Status; mit pruefen: Erreichbarkeit beider Quellen
//   GET  /api/suche?q=                     Yahoo-Suche (Aktien)
//   GET  /api/yahoo/:symbol[?frisch=1]     Firma + Abschlüsse von Yahoo (KV 7 Tage)
//   GET  /api/kurs/:symbol[?frisch=1]      Kurs + Bewertung (15 min; bei Yahoo-Ausfall letzter Stand, veraltet=true)
//   GET  /api/wechselkurse?paare=HKDCNY,USDEUR   Wechselkurse (1 h je Paar)
//   GET  /api/chart/:symbol?bereich=1T|5T|1M|6M|1J|5J|MAX[&frisch=1]   Kursverlauf als Kerzen (5 min – 1 Tag)
//   GET  /api/sec/:symbol?name=&waehrung=&cik=[&frisch=1]   SEC-Abschlüsse (KV 7 Tage), 204 ohne Zuordnung
//   GET  /api/zustand · PUT /api/zustand   Watchlist + DCF-Annahmen für den Geräte-Sync (KV)
//   GET  /api/tracker · PUT /api/tracker   Konfiguration des Markt-Trackers (KV); liest auch die GitHub Action
//
// Außerdem Cron-Trigger (wrangler.toml → src/cron.ts), die die GitHub Actions anstoßen.
// Jede Antwort trägt CORS-Header, auch Fehler; nach 25 s kommt 504 statt eines Hängers.

import type { SyncZustand } from '../../src/aktien/types'
import type { TrackerConfig } from '../../src/tracker/types'
import { kvLesen, kvSchreiben, mitCache, mitKv } from './cache'
import { CRON_STATUS_KEY, cronLauf, type CronStatus } from './cron'
import { HttpFehler, corsHeader, fehler, json, mitZeitlimit, pruefeZugang, type Env } from './http'
import { cikIndex, secTeilLaden } from './sec'
import { chartKerzen, kurs, suche, wechselkurse, yahooTeil } from './yahoo'
import { bereichDef } from '../../src/aktien/engine/chart'

const VERSION = '0.2.0'
const TAG_MS = 86_400_000
const FRISCHE_ABSCHLUESSE = 7 * TAG_MS
const KURS_TTL_SEK = 15 * 60
/** Kurse höchstens alle 30 Minuten je Symbol in KV sichern (Schreiblimit 1000/Tag) */
const KURS_SCHREIB_SEK = 30 * 60
const SUCHE_TTL_SEK = 24 * 3600
const ANTWORT_LIMIT_MS = 25_000

function symbolAus(pfad: string, praefix: string): string {
  const s = decodeURIComponent(pfad.slice(praefix.length)).trim().toUpperCase()
  if (!/^[A-Z0-9.\-^=]{1,20}$/.test(s)) throw new HttpFehler('Ungültiges Symbol', 400)
  return s
}

async function bearbeiten(req: Request, env: Env, url: URL): Promise<Response> {
  const pfad = url.pathname
  const frisch = url.searchParams.get('frisch') === '1'

  if (!pfad.startsWith('/api/')) throw new HttpFehler('Nicht gefunden', 404)
  pruefeZugang(req, env)

  if (pfad === '/api/status' && req.method === 'GET') {
    const antwort: Record<string, unknown> = { version: VERSION, zeit: Date.now() }
    const cron = await kvLesen<CronStatus>(env, CRON_STATUS_KEY)
    // tokenLaenge hilft bei der Diagnose: ein leer eingegebenes Secret (z.B. ohne Terminal-Eingabe) hat Länge 0
    const token = env.GITHUB_DISPATCH_TOKEN ?? ''
    antwort.cron = { ...(cron?.daten ?? { zuletzt: {}, laeufe: 0 }), tokenGesetzt: token.length > 0, tokenLaenge: token.length }
    if (url.searchParams.get('pruefen') === '1') {
      const [y, s] = await Promise.allSettled([kurs('AAPL'), cikIndex(env)])
      antwort.yahoo = y.status === 'fulfilled' ? 'ok' : (y.reason as Error).message
      antwort.sec = s.status === 'fulfilled' ? 'ok' : (s.reason as Error).message
    }
    return json(req, antwort)
  }

  if (pfad === '/api/wechselkurse' && req.method === 'GET') {
    const paare = [...new Set((url.searchParams.get('paare') ?? '').toUpperCase().split(',').map((p) => p.trim()).filter(Boolean))]
    if (paare.length === 0 || paare.length > 12 || paare.some((p) => !/^[A-Z]{6}$/.test(p))) throw new HttpFehler('paare: 1–12 Codes wie HKDCNY', 400)
    const kurse: Record<string, unknown> = {}
    const fehlend: string[] = []
    for (const p of paare) {
      const r = await mitCache(env, `wechselkurs/${p}`, 3600, frisch, async () => (await wechselkurse([p]))[p] ?? null)
      if (r.daten) kurse[p] = r.daten
      else fehlend.push(p)
    }
    return json(req, { kurse, fehlend })
  }

  if (pfad.startsWith('/api/chart/') && req.method === 'GET') {
    const symbol = symbolAus(pfad, '/api/chart/')
    const def = bereichDef(url.searchParams.get('bereich') ?? '1J')
    if (!def) throw new HttpFehler('Ungültiger Bereich (1T, 5T, 1M, 6M, 1J, 5J, MAX)', 400)
    const r = await mitCache(env, `chart/${symbol}/${def.bereich}`, def.ttlSek, frisch, () => chartKerzen(symbol, def))
    return json(req, { ...r.daten, standAm: r.standAm, veraltet: r.veraltet || undefined })
  }

  if (pfad === '/api/suche' && req.method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').trim()
    if (q.length < 1) return json(req, [])
    const r = await mitCache(env, `suche/${encodeURIComponent(q.toLowerCase())}`, SUCHE_TTL_SEK, frisch, () => suche(q))
    return json(req, r.daten)
  }

  if (pfad.startsWith('/api/yahoo/') && req.method === 'GET') {
    const symbol = symbolAus(pfad, '/api/yahoo/')
    const r = await mitKv(env, `yahoo:${symbol}`, FRISCHE_ABSCHLUESSE, frisch, () => yahooTeil(symbol))
    return json(req, { ...r.daten, standAm: r.standAm, veraltet: r.veraltet || undefined })
  }

  if (pfad.startsWith('/api/kurs/') && req.method === 'GET') {
    const symbol = symbolAus(pfad, '/api/kurs/')
    const r = await mitCache(env, `kurs/${symbol}`, KURS_TTL_SEK, frisch, () => kurs(symbol), KURS_SCHREIB_SEK)
    return json(req, { ...r.daten, standAm: r.standAm, veraltet: r.veraltet || undefined })
  }

  if (pfad.startsWith('/api/sec/') && req.method === 'GET') {
    const symbol = symbolAus(pfad, '/api/sec/')
    const abfrage = {
      symbol,
      name: url.searchParams.get('name') ?? undefined,
      waehrung: url.searchParams.get('waehrung')?.toUpperCase() || undefined,
      cikManuell: url.searchParams.get('cik') || undefined,
    }
    const key = `sec:${symbol}:${abfrage.cikManuell ?? 'auto'}:${abfrage.waehrung ?? ''}`
    const r = await mitKv(env, key, FRISCHE_ABSCHLUESSE, frisch, () => secTeilLaden(env, abfrage))
    if (!r.daten) return new Response(null, { status: 204, headers: corsHeader(req) })
    return json(req, { ...r.daten, standAm: r.standAm, veraltet: r.veraltet || undefined })
  }

  if (pfad === '/api/zustand') {
    if (req.method === 'GET') {
      const alt = await kvLesen<SyncZustand>(env, 'zustand')
      return json(req, alt?.daten ?? null)
    }
    if (req.method === 'PUT') {
      const neu = (await req.json()) as SyncZustand
      if (!neu || !Array.isArray(neu.watchlist) || typeof neu.aktualisiertAm !== 'number') throw new HttpFehler('Ungültiger Zustand', 400)
      const alt = await kvLesen<SyncZustand>(env, 'zustand')
      if (alt && alt.daten.aktualisiertAm > neu.aktualisiertAm) return json(req, alt.daten, 409)
      await kvSchreiben(env, 'zustand', neu)
      return json(req, neu)
    }
  }

  if (pfad === '/api/tracker') {
    if (req.method === 'GET') {
      const alt = await kvLesen<TrackerConfig>(env, 'tracker')
      return json(req, alt?.daten ?? null)
    }
    if (req.method === 'PUT') {
      const neu = (await req.json()) as TrackerConfig
      if (!neu || !Array.isArray(neu.instrumente) || typeof neu.aktualisiertAm !== 'number' || typeof neu.muster !== 'object')
        throw new HttpFehler('Ungültige Tracker-Konfiguration', 400)
      const alt = await kvLesen<TrackerConfig>(env, 'tracker')
      if (alt && alt.daten.aktualisiertAm > neu.aktualisiertAm) return json(req, alt.daten, 409)
      await kvSchreiben(env, 'tracker', neu)
      return json(req, neu)
    }
  }

  throw new HttpFehler('Nicht gefunden', 404)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeader(req) })
    try {
      return await mitZeitlimit(bearbeiten(req, env, new URL(req.url)), ANTWORT_LIMIT_MS)
    } catch (e) {
      return fehler(req, e)
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(cronLauf(controller.cron, env))
  },
} satisfies ExportedHandler<Env>
