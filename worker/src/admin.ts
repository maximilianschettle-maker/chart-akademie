// Admin-Endpunkte: Einladungscodes anlegen, auflisten, sperren, löschen.
// Nur mit Admin-Code oder Dienst-Token (CLI: scripts/codes/codes.ts).
//
//   GET    /api/admin/codes                → { codes: [...] }
//   POST   /api/admin/codes {name, nutzerId?, rolle?, kiLimitTag?} → { code, eintrag }  (Code nur hier im Klartext)
//   PATCH  /api/admin/codes/:nutzerId {gesperrt?, kiLimitTag?, name?}
//   DELETE /api/admin/codes/:nutzerId      (Nutzerdaten bleiben liegen)

import { codeAusZufall } from '../../src/zugang/code'
import { HttpFehler, json, type Env } from './http'
import { ADMIN_ID, codeCacheLeeren, codeHash, codeKey, istAdmin, nutzerKey, zuletztKey, type CodeEintrag, type CodeMeta, type Zugang } from './zugang'

interface CodeZeile extends CodeMeta {
  angelegtAm?: number
  kiLimitTag?: number
  zuletzt?: number
}

function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return s || 'nutzer'
}

function zufall(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return [...bytes].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')
}

async function codeHashVon(env: Env, nutzerId: string): Promise<string | null> {
  const idx = (await env.AKTIEN_KV.get(nutzerKey(nutzerId), 'json')) as { codeHash: string } | null
  return idx?.codeHash ?? null
}

async function eintragSchreiben(env: Env, hash: string, eintrag: CodeEintrag): Promise<void> {
  const metadata: CodeMeta = { nutzerId: eintrag.nutzerId, name: eintrag.name, rolle: eintrag.rolle, gesperrt: eintrag.gesperrt }
  await env.AKTIEN_KV.put(codeKey(hash), JSON.stringify(eintrag), { metadata })
  codeCacheLeeren(hash)
}

async function liste(env: Env): Promise<CodeZeile[]> {
  const zeilen: CodeZeile[] = []
  let cursor: string | undefined
  do {
    const seite = await env.AKTIEN_KV.list<CodeMeta>({ prefix: 'code:', cursor })
    for (const k of seite.keys) {
      const meta = k.metadata
      if (!meta) continue
      const voll = (await env.AKTIEN_KV.get(k.name, 'json')) as CodeEintrag | null
      const zuletzt = (await env.AKTIEN_KV.get(zuletztKey(meta.nutzerId), 'json')) as { am: number } | null
      zeilen.push({ ...meta, angelegtAm: voll?.angelegtAm, kiLimitTag: voll?.kiLimitTag, zuletzt: zuletzt?.am })
    }
    cursor = seite.list_complete ? undefined : seite.cursor
  } while (cursor)
  return zeilen.sort((a, b) => (a.angelegtAm ?? 0) - (b.angelegtAm ?? 0))
}

export async function adminRoute(req: Request, env: Env, url: URL, zugang: Zugang): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/admin/')) return null
  if (!istAdmin(zugang)) throw new HttpFehler('Nur für Admin', 403)

  if (url.pathname === '/api/admin/codes' && req.method === 'GET') return json(req, { codes: await liste(env) })

  if (url.pathname === '/api/admin/codes' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as Partial<CodeEintrag> | null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) throw new HttpFehler('Erwartet {name}', 400)
    const rolle = body?.rolle === 'admin' ? 'admin' : 'nutzer'
    const nutzerId = typeof body?.nutzerId === 'string' && /^[a-z0-9-]{2,32}$/.test(body.nutzerId) ? body.nutzerId : `${slug(name)}-${zufall(4)}`
    if (await codeHashVon(env, nutzerId)) throw new HttpFehler(`Nutzer-Id ${nutzerId} gibt es schon`, 409)
    const kiLimitTag = typeof body?.kiLimitTag === 'number' && body.kiLimitTag >= 0 ? Math.floor(body.kiLimitTag) : undefined
    const code = codeAusZufall(crypto.getRandomValues(new Uint8Array(12)))
    const hash = await codeHash(code)
    const eintrag: CodeEintrag = { nutzerId, name, rolle, angelegtAm: Date.now(), ...(kiLimitTag !== undefined ? { kiLimitTag } : {}) }
    await eintragSchreiben(env, hash, eintrag)
    await env.AKTIEN_KV.put(nutzerKey(nutzerId), JSON.stringify({ codeHash: hash }))
    return json(req, { code, eintrag }, 201)
  }

  const m = url.pathname.match(/^\/api\/admin\/codes\/([a-z0-9-]+)$/)
  if (!m) throw new HttpFehler('Nicht gefunden', 404)
  const nutzerId = m[1]
  const hash = await codeHashVon(env, nutzerId)
  if (!hash) throw new HttpFehler('Nutzer unbekannt', 404)

  if (req.method === 'PATCH') {
    const body = (await req.json().catch(() => null)) as { gesperrt?: unknown; kiLimitTag?: unknown; name?: unknown } | null
    const alt = (await env.AKTIEN_KV.get(codeKey(hash), 'json')) as CodeEintrag | null
    if (!alt) throw new HttpFehler('Code-Eintrag fehlt', 404)
    const neu: CodeEintrag = { ...alt }
    if (typeof body?.gesperrt === 'boolean') neu.gesperrt = body.gesperrt
    if (typeof body?.name === 'string' && body.name.trim()) neu.name = body.name.trim()
    if (body?.kiLimitTag === null) delete neu.kiLimitTag
    else if (typeof body?.kiLimitTag === 'number' && body.kiLimitTag >= 0) neu.kiLimitTag = Math.floor(body.kiLimitTag)
    if (nutzerId === ADMIN_ID && neu.gesperrt) throw new HttpFehler('Der Owner kann sich nicht selbst sperren', 400)
    await eintragSchreiben(env, hash, neu)
    return json(req, { eintrag: neu })
  }

  if (req.method === 'DELETE') {
    if (nutzerId === ADMIN_ID) throw new HttpFehler('Der Owner-Code bleibt', 400)
    await env.AKTIEN_KV.delete(codeKey(hash))
    await env.AKTIEN_KV.delete(nutzerKey(nutzerId))
    codeCacheLeeren(hash)
    return json(req, { geloescht: nutzerId })
  }

  throw new HttpFehler('Nicht gefunden', 404)
}
