// Cloudflare Worker der ChartAkademie: Proxy + Cache für Aktien (SEC EDGAR, Yahoo Finance),
// KI-Endpunkte, Geräte-Sync und Push-Abos je Nutzer, Admin für Einladungscodes.
// Zugang: Einladungscode je Person (zugang.ts) oder das Dienst-Token AKTIEN_SECRET (GitHub Actions, CLI).
//
//   GET  /api/status[?pruefen=1]          Version, Cron-Status; mit pruefen: Erreichbarkeit beider Quellen
//   GET  /api/ich                          Wer bin ich: Name, Rolle, KI-Verbrauch heute und Limit
//   GET  /api/suche?q=                     Yahoo-Suche (Aktien)
//   GET  /api/yahoo/:symbol[?frisch=1]     Firma + Abschlüsse von Yahoo (KV 7 Tage)
//   GET  /api/kurs/:symbol[?frisch=1]      Kurs + Bewertung (15 min; bei Yahoo-Ausfall letzter Stand, veraltet=true)
//   GET  /api/wechselkurse?paare=HKDCNY,USDEUR   Wechselkurse (1 h je Paar)
//   GET  /api/chart/:symbol?bereich=1T|5T|1M|6M|1J|5J|MAX[&frisch=1]   Kursverlauf als Kerzen (5 min – 1 Tag)
//   GET  /api/sec/:symbol?name=&waehrung=&cik=[&frisch=1]   SEC-Abschlüsse (KV 7 Tage), 204 ohne Zuordnung
//   GET  /api/zustand · PUT /api/zustand   Watchlist + DCF-Annahmen je Nutzer (409: Server-Stand ist neuer)
//   GET  /api/tracker · PUT /api/tracker   Tracker-Konfiguration je Nutzer (409 wie oben)
//   GET /api/zonen · PUT /api/zonen · GET /api/zonen/status   Preiszonen je Nutzer + Alarm-Status (zonen.ts)
//   GET/PUT /api/sync/journal|fortschritt  Journal und Lernfortschritt je Nutzer, serverseitig gemergt (sync.ts)
//   GET/PUT/DELETE /api/push/abo           Push-Abos je Nutzer (push.ts)
//   POST /api/ki/screenshot {bild, typ}    Broker-Screenshot → Positionen (Claude; Tageslimit je Nutzer)
//   POST /api/ki/pruefung {fakten}          Trade-Prüfung aus Fakten (Claude; Tageslimit je Nutzer)
//   /api/dienst/*                          GitHub Actions: Tracker-Union, alle Push-Abos (dienst.ts)
//   /api/admin/*                           Einladungscodes verwalten (admin.ts)
//
// Außerdem Cron-Trigger (wrangler.toml → src/cron.ts), die die GitHub Actions anstoßen.
// Jede Antwort trägt CORS-Header, auch Fehler; nach 25 s kommt 504 statt eines Hängers.

import type { SyncZustand } from '../../src/aktien/types'
import type { TrackerConfig } from '../../src/tracker/types'
import { kvLesen, mitCache, mitKv } from './cache'
import { CRON_STATUS_KEY, cronLauf, type CronStatus } from './cron'
import { HttpFehler, corsHeader, fehler, json, mitZeitlimit, type Env } from './http'
import { cikIndex, secTeilLaden } from './sec'
import { chartKerzen, kurs, suche, wechselkurse, yahooTeil } from './yahoo'
import { positionenAusBild, tradePruefen } from './ki'
import { BILD_TYPEN, type BildTyp } from '../../src/journal/positionTypes'
import { bereichDef } from '../../src/aktien/engine/chart'
import { zugangPruefen, zuletztMerken, type Zugang } from './zugang'
import { kiPruefen, kiVerbrauch, kiZaehlen } from './kiLimit'
import { nutzerLesen, nutzerSchreiben, type DatenArt } from './nutzerDaten'
import { adminRoute } from './admin'
import { syncRoute } from './sync'
import { pushRoute } from './push'
import { dienstRoute } from './dienst'
import { zonenRoute } from './zonen'

const VERSION = '0.5.0'
const TAG_MS = 86_400_000
const FRISCHE_ABSCHLUESSE = 7 * TAG_MS
const KURS_TTL_SEK = 15 * 60
/** Kurse höchstens alle 30 Minuten je Symbol in KV sichern (Schreiblimit 1000/Tag) */
const KURS_SCHREIB_SEK = 30 * 60
const SUCHE_TTL_SEK = 24 * 3600
const ANTWORT_LIMIT_MS = 25_000
/** KI-Aufrufe brauchen länger (Bild lesen); der Browser wartet bis 90 s */
const KI_LIMIT_MS = 60_000
/** Base64-Länge; ~4,5 MB Bild reichen für jeden Screenshot */
const BILD_MAX_ZEICHEN = 6_000_000

function symbolAus(pfad: string, praefix: string): string {
  const s = decodeURIComponent(pfad.slice(praefix.length)).trim().toUpperCase()
  if (!/^[A-Z0-9.\-^=]{1,20}$/.test(s)) throw new HttpFehler('Ungültiges Symbol', 400)
  return s
}

/** GET/PUT eines Nutzer-Stands mit „neuerer Stand gewinnt“ (409 liefert den Server-Stand). */
async function standRoute<T extends { aktualisiertAm: number }>(
  req: Request,
  env: Env,
  art: DatenArt,
  zugang: Zugang,
  pruefen: (neu: T) => boolean,
): Promise<Response> {
  if (req.method === 'GET') {
    const alt = await nutzerLesen<T>(env, art, zugang.nutzerId)
    return json(req, alt?.daten ?? null)
  }
  if (req.method === 'PUT') {
    const neu = (await req.json().catch(() => null)) as T | null
    if (!neu || typeof neu.aktualisiertAm !== 'number' || !pruefen(neu)) throw new HttpFehler(`Ungültiger ${art}-Stand`, 400)
    const alt = await nutzerLesen<T>(env, art, zugang.nutzerId)
    if (alt && alt.daten.aktualisiertAm > neu.aktualisiertAm) return json(req, alt.daten, 409)
    await nutzerSchreiben(env, art, zugang.nutzerId, neu)
    return json(req, neu)
  }
  throw new HttpFehler('Nicht gefunden', 404)
}

async function bearbeiten(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const pfad = url.pathname
  const frisch = url.searchParams.get('frisch') === '1'

  if (!pfad.startsWith('/api/')) throw new HttpFehler('Nicht gefunden', 404)
  const zugang = await zugangPruefen(req, env)
  zuletztMerken(env, ctx, zugang)

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

  if (pfad === '/api/ich' && req.method === 'GET') {
    const heute = zugang.rolle === 'dienst' ? 0 : await kiVerbrauch(env, zugang.nutzerId)
    return json(req, { nutzerId: zugang.nutzerId, name: zugang.name, rolle: zugang.rolle, ki: { heute, limit: zugang.kiLimitTag }, version: VERSION })
  }

  for (const route of [adminRoute, dienstRoute, syncRoute, pushRoute, zonenRoute]) {
    const antwort = await route(req, env, url, zugang)
    if (antwort) return antwort
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
    return standRoute<SyncZustand>(req, env, 'zustand', zugang, (neu) => Array.isArray(neu.watchlist))
  }

  if (pfad === '/api/tracker') {
    return standRoute<TrackerConfig>(req, env, 'tracker', zugang, (neu) => Array.isArray(neu.instrumente) && typeof neu.muster === 'object')
  }

  if (pfad === '/api/ki/screenshot' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { bild?: unknown; typ?: unknown } | null
    const typ = typeof body?.typ === 'string' && (BILD_TYPEN as readonly string[]).includes(body.typ) ? (body.typ as BildTyp) : null
    if (!body || typeof body.bild !== 'string' || !typ) throw new HttpFehler('Erwartet {bild: Base64, typ: image/jpeg|png|webp|gif}', 400)
    if (body.bild.length > BILD_MAX_ZEICHEN) throw new HttpFehler('Bild zu groß (max. ~4,5 MB)', 413)
    await kiPruefen(env, zugang)
    const ergebnis = await positionenAusBild(env, body.bild, typ)
    ctx.waitUntil(kiZaehlen(env, zugang.nutzerId))
    return json(req, ergebnis)
  }

  if (pfad === '/api/ki/pruefung' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { fakten?: unknown } | null
    if (!body || !body.fakten || typeof body.fakten !== 'object') throw new HttpFehler('Erwartet {fakten: {...}}', 400)
    if (JSON.stringify(body.fakten).length > 50_000) throw new HttpFehler('Fakten zu groß', 413)
    await kiPruefen(env, zugang)
    const ergebnis = await tradePruefen(env, body.fakten)
    ctx.waitUntil(kiZaehlen(env, zugang.nutzerId))
    return json(req, ergebnis)
  }

  throw new HttpFehler('Nicht gefunden', 404)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeader(req) })
    try {
      const url = new URL(req.url)
      return await mitZeitlimit(bearbeiten(req, env, url, ctx), url.pathname.startsWith('/api/ki/') ? KI_LIMIT_MS : ANTWORT_LIMIT_MS)
    } catch (e) {
      return fehler(req, e)
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(cronLauf(controller.cron, env, controller.scheduledTime))
  },
} satisfies ExportedHandler<Env>
