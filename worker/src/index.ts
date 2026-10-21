// Cloudflare Worker: Proxy + Cache für den Aktien-Bereich der ChartAkademie.
// Quellen: SEC EDGAR (XBRL) und Yahoo Finance. Kein Anbieter-Schlüssel nötig;
// der Worker selbst ist mit AKTIEN_SECRET (Bearer) geschützt.
//
//   GET  /api/status[?pruefen=1]          Version, Cache; mit pruefen: Erreichbarkeit beider Quellen
//   GET  /api/suche?q=                     Yahoo-Suche (Aktien)
//   GET  /api/yahoo/:symbol[?frisch=1]     Firma + Abschlüsse von Yahoo (KV 7 Tage)
//   GET  /api/kurs/:symbol[?frisch=1]      Kurs + Bewertung (Cache-API 15 min)
//   GET  /api/chart/:symbol?bereich=1M|6M|1J|5J|MAX[&frisch=1]   Kursverlauf als Kerzen (Cache-API 1 h – 1 Tag)
//   GET  /api/sec/:symbol?name=&waehrung=&cik=[&frisch=1]   SEC-Abschlüsse (KV 7 Tage), 204 ohne Zuordnung
//   GET  /api/zustand · PUT /api/zustand   Watchlist + DCF-Annahmen für den Geräte-Sync (KV)

import type { SyncZustand } from '../../src/aktien/types'
import { kvLesen, kvSchreiben, mitCacheApi, mitKv } from './cache'
import { HttpFehler, corsHeader, fehler, json, pruefeZugang, type Env } from './http'
import { cikIndex, secTeilLaden } from './sec'
import { chartKerzen, kurs, suche, yahooTeil } from './yahoo'
import { bereichDef } from '../../src/aktien/engine/chart'

const VERSION = '0.1.0'
const TAG_MS = 86_400_000
const FRISCHE_ABSCHLUESSE = 7 * TAG_MS
const KURS_TTL_SEK = 15 * 60
const SUCHE_TTL_SEK = 24 * 3600

function symbolAus(pfad: string, praefix: string): string {
  const s = decodeURIComponent(pfad.slice(praefix.length)).trim().toUpperCase()
  if (!/^[A-Z0-9.\-^=]{1,20}$/.test(s)) throw new HttpFehler('Ungültiges Symbol', 400)
  return s
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeader(req) })
    const url = new URL(req.url)
    const pfad = url.pathname
    const frisch = url.searchParams.get('frisch') === '1'

    try {
      if (!pfad.startsWith('/api/')) throw new HttpFehler('Nicht gefunden', 404)
      pruefeZugang(req, env)

      if (pfad === '/api/status' && req.method === 'GET') {
        const antwort: Record<string, unknown> = { version: VERSION, zeit: Date.now() }
        if (url.searchParams.get('pruefen') === '1') {
          const [y, s] = await Promise.allSettled([kurs('AAPL'), cikIndex(env)])
          antwort.yahoo = y.status === 'fulfilled' ? 'ok' : (y.reason as Error).message
          antwort.sec = s.status === 'fulfilled' ? 'ok' : (s.reason as Error).message
        }
        return json(req, antwort)
      }

      if (pfad.startsWith('/api/chart/') && req.method === 'GET') {
        const symbol = symbolAus(pfad, '/api/chart/')
        const def = bereichDef(url.searchParams.get('bereich') ?? '1J')
        if (!def) throw new HttpFehler('Ungültiger Bereich (1M, 6M, 1J, 5J, MAX)', 400)
        const r = await mitCacheApi(`chart/${symbol}/${def.bereich}`, def.ttlSek, frisch, () => chartKerzen(symbol, def))
        return json(req, r.daten)
      }

      if (pfad === '/api/suche' && req.method === 'GET') {
        const q = (url.searchParams.get('q') ?? '').trim()
        if (q.length < 1) return json(req, [])
        const r = await mitCacheApi(`suche/${encodeURIComponent(q.toLowerCase())}`, SUCHE_TTL_SEK, frisch, () => suche(q))
        return json(req, r.daten)
      }

      if (pfad.startsWith('/api/yahoo/') && req.method === 'GET') {
        const symbol = symbolAus(pfad, '/api/yahoo/')
        const r = await mitKv(env, `yahoo:${symbol}`, FRISCHE_ABSCHLUESSE, frisch, () => yahooTeil(symbol))
        return json(req, { ...r.daten, standAm: r.standAm, veraltet: r.veraltet || undefined })
      }

      if (pfad.startsWith('/api/kurs/') && req.method === 'GET') {
        const symbol = symbolAus(pfad, '/api/kurs/')
        const r = await mitCacheApi(`kurs/${symbol}`, KURS_TTL_SEK, frisch, () => kurs(symbol))
        return json(req, r.daten)
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

      throw new HttpFehler('Nicht gefunden', 404)
    } catch (e) {
      return fehler(req, e)
    }
  },
} satisfies ExportedHandler<Env>
