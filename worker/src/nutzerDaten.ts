// Daten je Nutzer im KV: <art>:<nutzerId>. Der Owner (ADMIN_ID) hatte vor dem Umbau die
// globalen Keys „zustand“ und „tracker“; die werden bei einem Miss gelesen, damit kein
// Migrationsschritt nötig ist. Der nächste PUT schreibt unter dem neuen Key.
// Fallback entfernen, wenn der Owner einmal gespeichert hat (ab ca. 2026-12-15).

import { kvLesen, kvSchreiben, type KvEintrag } from './cache'
import type { Env } from './http'
import { ADMIN_ID } from './zugang'

export type DatenArt = 'zustand' | 'tracker' | 'journal' | 'fortschritt' | 'push'
const MIT_LEGACY: DatenArt[] = ['zustand', 'tracker']

export const nutzerKey = (art: DatenArt, nutzerId: string) => `${art}:${nutzerId}`

export async function nutzerLesen<T>(env: Env, art: DatenArt, nutzerId: string): Promise<KvEintrag<T> | null> {
  const neu = await kvLesen<T>(env, nutzerKey(art, nutzerId))
  if (neu) return neu
  if (nutzerId === ADMIN_ID && MIT_LEGACY.includes(art)) return kvLesen<T>(env, art)
  return null
}

export function nutzerSchreiben<T>(env: Env, art: DatenArt, nutzerId: string, daten: T): Promise<KvEintrag<T>> {
  return kvSchreiben(env, nutzerKey(art, nutzerId), daten)
}

/** Alle Nutzer-Ids, die zu einer Art einen Eintrag haben (KV-list; eventually consistent). */
export async function nutzerIdsMit(env: Env, art: DatenArt): Promise<string[]> {
  const praefix = `${art}:`
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const seite = await env.AKTIEN_KV.list({ prefix: praefix, cursor })
    for (const k of seite.keys) ids.push(k.name.slice(praefix.length))
    cursor = seite.list_complete ? undefined : seite.cursor
  } while (cursor)
  return ids
}
