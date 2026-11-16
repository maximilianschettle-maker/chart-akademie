// Zugangsschutz: Wer ruft an? Entweder das Dienst-Token (AKTIEN_SECRET; GitHub Actions,
// Code-CLI, übergangsweise auch alte App-Stände) oder ein Einladungscode je Person.
//
// Codes liegen im KV unter code:<sha256(code)> — ein KV-Dump verrät keine Codes.
// Der Klartext existiert nur einmal: in der Antwort beim Anlegen (admin.ts).
// nutzer:<id> → { codeHash } ist der Index für Sperren/Löschen und Eindeutigkeit.

import { codeNormalisieren } from '../../src/zugang/code'
import { HttpFehler, type Env } from './http'
import { berlinTag } from './kiLimit'

export type Rolle = 'admin' | 'nutzer' | 'dienst'

export interface CodeEintrag {
  nutzerId: string
  name: string
  rolle: 'admin' | 'nutzer'
  /** KI-Aufrufe je Berliner Tag; fehlt = Standard (Nutzer) bzw. unbegrenzt (Admin) */
  kiLimitTag?: number
  angelegtAm: number
  gesperrt?: boolean
}

/** Metadaten am KV-Key, damit `list` ohne N Einzelzugriffe auskommt */
export type CodeMeta = Pick<CodeEintrag, 'nutzerId' | 'name' | 'rolle' | 'gesperrt'>

export interface Zugang {
  nutzerId: string
  name: string
  rolle: Rolle
  /** null = unbegrenzt */
  kiLimitTag: number | null
}

export const KI_LIMIT_STANDARD = 10
/** Der Owner: seine Daten hängen an den alten globalen Keys (siehe nutzerDaten.ts) */
export const ADMIN_ID = 'admin'
const CACHE_MS = 5 * 60_000

export const codeKey = (hash: string) => `code:${hash}`
export const nutzerKey = (id: string) => `nutzer:${id}`
export const zuletztKey = (id: string) => `zuletzt:${id}`

export async function codeHash(code: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function zeitkonstantGleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Erste Schicht: Map im Isolate, damit nicht jede Anfrage KV liest. Sperren greifen
// dadurch bis zu CACHE_MS verzögert; admin.ts leert den Eintrag bei Änderungen.
const cache = new Map<string, { eintrag: CodeEintrag | null; bis: number }>()

export async function codeEintragLesen(env: Env, hash: string): Promise<CodeEintrag | null> {
  const c = cache.get(hash)
  if (c && c.bis > Date.now()) return c.eintrag
  let eintrag: CodeEintrag | null = null
  try {
    eintrag = (await env.AKTIEN_KV.get(codeKey(hash), 'json')) as CodeEintrag | null
  } catch {
    eintrag = null
  }
  cache.set(hash, { eintrag, bis: Date.now() + CACHE_MS })
  return eintrag
}

export function codeCacheLeeren(hash?: string): void {
  if (hash) cache.delete(hash)
  else cache.clear()
}

export function zugangAus(eintrag: CodeEintrag): Zugang {
  return {
    nutzerId: eintrag.nutzerId,
    name: eintrag.name,
    rolle: eintrag.rolle,
    kiLimitTag: eintrag.kiLimitTag ?? (eintrag.rolle === 'admin' ? null : KI_LIMIT_STANDARD),
  }
}

export const DIENST: Zugang = { nutzerId: ADMIN_ID, name: 'Dienst', rolle: 'dienst', kiLimitTag: null }

/** Bearer-Token prüfen: Dienst-Token oder Einladungscode. Wirft 401/403. */
export async function zugangPruefen(req: Request, env: Env): Promise<Zugang> {
  if (!env.AKTIEN_SECRET) throw new HttpFehler('AKTIEN_SECRET ist im Worker nicht gesetzt', 500)
  const kopf = req.headers.get('Authorization') ?? ''
  const token = kopf.startsWith('Bearer ') ? kopf.slice(7).trim() : ''
  if (!token) throw new HttpFehler('Kein Einladungscode mitgeschickt', 401)
  if (zeitkonstantGleich(token, env.AKTIEN_SECRET)) return DIENST
  const code = codeNormalisieren(token)
  if (!code) throw new HttpFehler('Einladungscode ungültig', 401)
  const eintrag = await codeEintragLesen(env, await codeHash(code))
  if (!eintrag) throw new HttpFehler('Einladungscode ungültig', 401)
  if (eintrag.gesperrt) throw new HttpFehler('Einladungscode gesperrt', 403)
  return zugangAus(eintrag)
}

export function istAdmin(z: Zugang): boolean {
  return z.rolle === 'admin' || z.rolle === 'dienst'
}

// „Zuletzt gesehen“: höchstens ein KV-Write je Nutzer und Berliner Tag (Schreiblimit!).
const gemerkt = new Map<string, string>()

export function zuletztMerken(env: Env, ctx: ExecutionContext, zugang: Zugang): void {
  if (zugang.rolle === 'dienst') return
  const tag = berlinTag()
  if (gemerkt.get(zugang.nutzerId) === tag) return
  gemerkt.set(zugang.nutzerId, tag)
  ctx.waitUntil(
    env.AKTIEN_KV.put(zuletztKey(zugang.nutzerId), JSON.stringify({ am: Date.now(), tag }), { expirationTtl: 400 * 86_400 }).catch(() => {}),
  )
}
