// Web-Push-Abos je Nutzer (mehrere Geräte). push:<nutzerId> → PushAbo[]
//
//   GET    /api/push/abo            → { abos: [{endpoint, geraet, angelegtAm}] }  (ohne Schlüssel)
//   PUT    /api/push/abo  {endpoint, keys, expirationTime?, geraet?} → { anzahl }  (Upsert je endpoint)
//   DELETE /api/push/abo  {endpoint} → { anzahl }

import { HttpFehler, json, type Env } from './http'
import { nutzerLesen, nutzerSchreiben } from './nutzerDaten'
import type { Zugang } from './zugang'

export interface PushAbo {
  endpoint: string
  keys: { p256dh: string; auth: string }
  expirationTime?: number | null
  geraet?: string
  angelegtAm: number
}

const ABOS_MAX = 10

export async function abosLesen(env: Env, nutzerId: string): Promise<PushAbo[]> {
  const e = await nutzerLesen<PushAbo[]>(env, 'push', nutzerId)
  return Array.isArray(e?.daten) ? e.daten.filter((a) => a && typeof a.endpoint === 'string' && a.keys?.p256dh && a.keys?.auth) : []
}

export async function abosEntfernen(env: Env, nutzerId: string, endpoints: string[]): Promise<number> {
  const alt = await abosLesen(env, nutzerId)
  const neu = alt.filter((a) => !endpoints.includes(a.endpoint))
  if (neu.length !== alt.length) await nutzerSchreiben(env, 'push', nutzerId, neu)
  return neu.length
}

export async function pushRoute(req: Request, env: Env, url: URL, zugang: Zugang): Promise<Response | null> {
  if (url.pathname !== '/api/push/abo') return null
  if (zugang.rolle === 'dienst') throw new HttpFehler('Push-Abos gehören zu einem Einladungscode', 403)
  const id = zugang.nutzerId

  if (req.method === 'GET') {
    const abos = await abosLesen(env, id)
    return json(req, { abos: abos.map(({ endpoint, geraet, angelegtAm }) => ({ endpoint, geraet, angelegtAm })) })
  }

  if (req.method === 'PUT') {
    const body = (await req.json().catch(() => null)) as Partial<PushAbo> | null
    if (!body || typeof body.endpoint !== 'string' || !body.endpoint.startsWith('https://') || !body.keys?.p256dh || !body.keys?.auth)
      throw new HttpFehler('Erwartet eine Push-Subscription {endpoint, keys: {p256dh, auth}}', 400)
    const alt = await abosLesen(env, id)
    const vorhanden = alt.find((a) => a.endpoint === body.endpoint)
    const abo: PushAbo = {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      expirationTime: typeof body.expirationTime === 'number' ? body.expirationTime : null,
      geraet: typeof body.geraet === 'string' ? body.geraet.slice(0, 60) : vorhanden?.geraet,
      angelegtAm: vorhanden?.angelegtAm ?? Date.now(),
    }
    const neu = [...alt.filter((a) => a.endpoint !== abo.endpoint), abo].sort((a, b) => a.angelegtAm - b.angelegtAm).slice(-ABOS_MAX)
    const gleich = vorhanden && JSON.stringify(vorhanden) === JSON.stringify(abo) && neu.length === alt.length
    if (!gleich) await nutzerSchreiben(env, 'push', id, neu)
    return json(req, { anzahl: neu.length })
  }

  if (req.method === 'DELETE') {
    const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null
    if (!body || typeof body.endpoint !== 'string') throw new HttpFehler('Erwartet {endpoint}', 400)
    return json(req, { anzahl: await abosEntfernen(env, id, [body.endpoint]) })
  }

  throw new HttpFehler('Nicht gefunden', 404)
}
