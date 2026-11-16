// Dienst-Endpunkte für die GitHub Actions (Dienst-Token oder Admin).
//
//   GET  /api/dienst/tracker          → { config: Union aller Nutzer, nutzer, quellen }
//   GET  /api/dienst/push             → { nutzer: [{ nutzerId, abos, tracker }] }
//   POST /api/dienst/push/abgelaufen  {abgelaufen: [{nutzerId, endpoint}]} → { entfernt }

import { normalisiereConfig } from '../../src/tracker/engine/katalog'
import { trackerUnion } from '../../src/tracker/engine/union'
import type { TrackerConfig } from '../../src/tracker/types'
import { HttpFehler, json, type Env } from './http'
import { nutzerIdsMit, nutzerLesen } from './nutzerDaten'
import { abosEntfernen, abosLesen, type PushAbo } from './push'
import { ADMIN_ID, istAdmin, type Zugang } from './zugang'

interface TrackerQuelle {
  nutzerId: string
  config: TrackerConfig
  aktualisiertAm: number
}

async function alleTracker(env: Env): Promise<TrackerQuelle[]> {
  const ids = new Set(await nutzerIdsMit(env, 'tracker'))
  ids.add(ADMIN_ID) // Legacy-Key „tracker“ des Owners (nutzerLesen fällt darauf zurück)
  const out: TrackerQuelle[] = []
  for (const nutzerId of ids) {
    const e = await nutzerLesen<TrackerConfig>(env, 'tracker', nutzerId)
    if (e) out.push({ nutzerId, config: normalisiereConfig(e.daten), aktualisiertAm: e.daten.aktualisiertAm })
  }
  return out
}

export async function dienstRoute(req: Request, env: Env, url: URL, zugang: Zugang): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/dienst/')) return null
  if (!istAdmin(zugang)) throw new HttpFehler('Nur für den Dienst', 403)

  if (url.pathname === '/api/dienst/tracker' && req.method === 'GET') {
    const alle = await alleTracker(env)
    return json(req, {
      config: trackerUnion(alle.map((a) => a.config)),
      nutzer: alle.length,
      quellen: alle.map(({ nutzerId, aktualisiertAm }) => ({ nutzerId, aktualisiertAm })),
    })
  }

  if (url.pathname === '/api/dienst/push' && req.method === 'GET') {
    const ids = await nutzerIdsMit(env, 'push')
    const nutzer: { nutzerId: string; abos: PushAbo[]; tracker: TrackerConfig | null }[] = []
    for (const nutzerId of ids) {
      const abos = await abosLesen(env, nutzerId)
      if (abos.length === 0) continue
      const t = await nutzerLesen<TrackerConfig>(env, 'tracker', nutzerId)
      nutzer.push({ nutzerId, abos, tracker: t ? normalisiereConfig(t.daten) : null })
    }
    return json(req, { nutzer })
  }

  if (url.pathname === '/api/dienst/push/abgelaufen' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { abgelaufen?: unknown } | null
    const liste = Array.isArray(body?.abgelaufen) ? body.abgelaufen : []
    const je = new Map<string, string[]>()
    for (const x of liste as { nutzerId?: unknown; endpoint?: unknown }[]) {
      if (typeof x?.nutzerId !== 'string' || typeof x?.endpoint !== 'string') continue
      je.set(x.nutzerId, [...(je.get(x.nutzerId) ?? []), x.endpoint])
    }
    let entfernt = 0
    for (const [nutzerId, endpoints] of je) {
      const vorher = (await abosLesen(env, nutzerId)).length
      entfernt += vorher - (await abosEntfernen(env, nutzerId, endpoints))
    }
    return json(req, { entfernt })
  }

  throw new HttpFehler('Nicht gefunden', 404)
}
