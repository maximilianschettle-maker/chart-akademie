// Geräte-Sync für Journal und Lernfortschritt je Nutzer.
//
//   GET /api/sync/journal | /api/sync/fortschritt   → Stand + standAm, oder null
//   PUT …                                            → alt ⊕ neu (serverseitig gemergt) → gemergter Stand
//
// Kein 409: die Merge-Regeln (src/engine/mergen.ts) sind kommutativ und idempotent.
// Geschrieben wird nur, wenn der gemergte Stand vom gespeicherten abweicht (KV-Schreiblimit).

import { syncStandLeer, syncStandLesen, syncStandMergen, syncStandText, type SyncStandW, type SyncTeilW } from '../../src/engine/mergen'
import { HttpFehler, json, type Env } from './http'
import { nutzerLesen, nutzerSchreiben } from './nutzerDaten'
import type { Zugang } from './zugang'

const BODY_MAX = 2_000_000

export async function syncRoute(req: Request, env: Env, url: URL, zugang: Zugang): Promise<Response | null> {
  const m = url.pathname.match(/^\/api\/sync\/(journal|fortschritt)$/)
  if (!m) return null
  const teil = m[1] as SyncTeilW

  if (req.method === 'GET') {
    const alt = await nutzerLesen<SyncStandW[typeof teil]>(env, teil, zugang.nutzerId)
    if (!alt) return json(req, null)
    return json(req, { ...syncStandLesen(teil, alt.daten), standAm: alt.standAm })
  }

  if (req.method === 'PUT') {
    const text = await req.text()
    if (text.length > BODY_MAX) throw new HttpFehler('Stand zu groß (max. 2 MB)', 413)
    let roh: unknown
    try {
      roh = JSON.parse(text)
    } catch {
      throw new HttpFehler('Kein gültiges JSON', 400)
    }
    const neu = syncStandLesen(teil, roh)
    if (!neu) throw new HttpFehler(`Erwartet einen ${teil}-Stand`, 400)
    const altEintrag = await nutzerLesen<SyncStandW[typeof teil]>(env, teil, zugang.nutzerId)
    const alt = altEintrag ? (syncStandLesen(teil, altEintrag.daten) ?? syncStandLeer(teil)) : syncStandLeer(teil)
    const gemergt = syncStandMergen(teil, alt, neu)
    let standAm = altEintrag?.standAm ?? 0
    if (!altEintrag || syncStandText(teil, gemergt) !== syncStandText(teil, alt)) {
      standAm = (await nutzerSchreiben(env, teil, zugang.nutzerId, gemergt)).standAm
    }
    return json(req, { ...gemergt, standAm })
  }

  throw new HttpFehler('Nicht gefunden', 404)
}
