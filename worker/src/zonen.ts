// Preiszonen je Nutzer (src/zonen). zonen:<nutzerId> → ZonenStand, zonenstatus:<nutzerId> → ZonenStatus
// (Alarm-Zustand je Zone + letzte Alarme; schreibt nur die Tracker-Action über /api/dienst/zonen/status).
//
//   GET /api/zonen          → ZonenStand | null
//   PUT /api/zonen          ZonenStand → bereinigter Stand (409: Server-Stand ist neuer, kommt zurück)
//   GET /api/zonen/status   → ZonenStatus (leer, solange die Action noch nichts geprüft hat)

import { LEERER_STATUS, normalisiereStatus, type ZonenStatus } from '../../src/zonen/alarm'
import { normalisiereZonen } from '../../src/zonen/engine'
import type { ZonenMarktId, ZonenStand } from '../../src/zonen/types'
import { HttpFehler, json, type Env } from './http'
import { nutzerIdsMit, nutzerLesen, nutzerSchreiben } from './nutzerDaten'
import type { Zugang } from './zugang'

export async function zonenLesen(env: Env, nutzerId: string): Promise<ZonenStand | null> {
  const e = await nutzerLesen<ZonenStand>(env, 'zonen', nutzerId)
  return e ? normalisiereZonen(e.daten) : null
}

export async function statusLesen(env: Env, nutzerId: string): Promise<ZonenStatus | null> {
  const e = await nutzerLesen<ZonenStatus>(env, 'zonenstatus', nutzerId)
  return e ? normalisiereStatus(e.daten) : null
}

/** Hat irgendein Nutzer eine Zone mit Alarm in einem dieser Märkte? (Cron: lohnt ein Lauf außerhalb der Tracker-Zeiten?) */
export async function zonenAktiv(env: Env, maerkte: readonly ZonenMarktId[]): Promise<boolean> {
  for (const nutzerId of await nutzerIdsMit(env, 'zonen')) {
    const stand = await zonenLesen(env, nutzerId)
    if (stand?.zonen.some((z) => z.alarm && maerkte.includes(z.markt))) return true
  }
  return false
}

export async function zonenRoute(req: Request, env: Env, url: URL, zugang: Zugang): Promise<Response | null> {
  if (url.pathname === '/api/zonen/status' && req.method === 'GET') {
    return json(req, (await statusLesen(env, zugang.nutzerId)) ?? LEERER_STATUS)
  }
  if (url.pathname !== '/api/zonen') return null

  if (req.method === 'GET') return json(req, await zonenLesen(env, zugang.nutzerId))

  if (req.method === 'PUT') {
    const roh = (await req.json().catch(() => null)) as Partial<ZonenStand> | null
    if (!roh || typeof roh.aktualisiertAm !== 'number' || !Array.isArray(roh.zonen)) throw new HttpFehler('Ungültiger Zonen-Stand', 400)
    const neu = normalisiereZonen(roh)
    const alt = await zonenLesen(env, zugang.nutzerId)
    if (alt && alt.aktualisiertAm > neu.aktualisiertAm) return json(req, alt, 409)
    await nutzerSchreiben(env, 'zonen', zugang.nutzerId, neu)
    return json(req, neu)
  }

  throw new HttpFehler('Nicht gefunden', 404)
}
