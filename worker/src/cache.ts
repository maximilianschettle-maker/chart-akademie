// Zwei Cache-Schichten:
// - KV: langlebige, teure Daten (Abschlüsse, CIK-Index, Geräte-Zustand). Frische wird im
//   Code geprüft, der Eintrag bleibt 90 Tage liegen → bei Quellen-Ausfall gibt es den alten Stand.
// - Cache-API (caches.default): kurzlebige Daten (Kurs, Suche), ohne KV-Schreiblimit.

import type { Env } from './http'

export interface KvEintrag<T> {
  standAm: number
  daten: T
}

const LIEGEZEIT_SEK = 90 * 86_400

export async function kvLesen<T>(env: Env, key: string): Promise<KvEintrag<T> | null> {
  try {
    return (await env.AKTIEN_KV.get(key, 'json')) as KvEintrag<T> | null
  } catch {
    return null
  }
}

export async function kvSchreiben<T>(env: Env, key: string, daten: T): Promise<KvEintrag<T>> {
  const eintrag: KvEintrag<T> = { standAm: Date.now(), daten }
  await env.AKTIEN_KV.put(key, JSON.stringify(eintrag), { expirationTtl: LIEGEZEIT_SEK })
  return eintrag
}

export interface MitKvErgebnis<T> {
  daten: T
  standAm: number
  /** true, wenn die Quelle nicht erreichbar war und der alte Stand geliefert wird */
  veraltet: boolean
  ausCache: boolean
}

/**
 * Liefert den KV-Stand, wenn er frisch genug ist; sonst lädt es neu. Scheitert das Laden
 * und es gibt einen alten Stand, kommt der zurück (veraltet = true).
 */
export async function mitKv<T>(env: Env, key: string, frischeMs: number, frisch: boolean, lader: () => Promise<T>): Promise<MitKvErgebnis<T>> {
  const alt = await kvLesen<T>(env, key)
  if (alt && !frisch && Date.now() - alt.standAm < frischeMs) return { daten: alt.daten, standAm: alt.standAm, veraltet: false, ausCache: true }
  try {
    const daten = await lader()
    const neu = await kvSchreiben(env, key, daten)
    return { daten, standAm: neu.standAm, veraltet: false, ausCache: false }
  } catch (e) {
    if (alt) return { daten: alt.daten, standAm: alt.standAm, veraltet: true, ausCache: true }
    throw e
  }
}

/** Kurzlebiger Cache über die Cache-API; der Schlüssel ist eine synthetische URL. */
export async function mitCacheApi<T>(key: string, ttlSek: number, frisch: boolean, lader: () => Promise<T>): Promise<{ daten: T; ausCache: boolean }> {
  const anfrage = new Request(`https://cache.chart-akademie.local/${key}`)
  const cache = caches.default
  if (!frisch) {
    try {
      const treffer = await cache.match(anfrage)
      if (treffer) return { daten: (await treffer.json()) as T, ausCache: true }
    } catch {
      // Cache-API nicht verfügbar (z.B. lokal) → einfach laden
    }
  }
  const daten = await lader()
  try {
    await cache.put(anfrage, new Response(JSON.stringify(daten), { headers: { 'Cache-Control': `max-age=${ttlSek}`, 'Content-Type': 'application/json' } }))
  } catch {
    // nie fatal
  }
  return { daten, ausCache: false }
}
