// Cache-Schichten des Workers:
// - KV (mitKv): langlebige, teure Daten (Abschlüsse, CIK-Index, Geräte-Zustand). Frische wird im
//   Code geprüft, der Eintrag bleibt 90 Tage liegen → bei Quellen-Ausfall gibt es den alten Stand.
// - Speicher + KV (mitCache): kurzlebige Daten (Kurs, Suche, Chart, Wechselkurs). Erste Schicht ist
//   eine Map im Isolate (kein I/O, überlebt Anfragen desselben Isolates), zweite Schicht KV als
//   „letzter guter Stand“. KV-Schreibvorgänge sind auf dem Free-Plan knapp (1000/Tag), deshalb wird
//   je Schlüssel höchstens einmal je Schreibintervall geschrieben.
//
// Früher lief die zweite Schicht über die Cache-API (caches.default); die ist auf *.workers.dev
// wirkungslos, also hatte der Worker dort faktisch keinen Kurs-Cache.

import type { Env } from './http'

export interface KvEintrag<T> {
  standAm: number
  daten: T
}

const LIEGEZEIT_SEK = 90 * 86_400
const LIEGEZEIT_KURZ_SEK = 30 * 86_400

export async function kvLesen<T>(env: Env, key: string): Promise<KvEintrag<T> | null> {
  try {
    return (await env.AKTIEN_KV.get(key, 'json')) as KvEintrag<T> | null
  } catch {
    return null
  }
}

export async function kvSchreiben<T>(env: Env, key: string, daten: T, liegezeitSek = LIEGEZEIT_SEK): Promise<KvEintrag<T>> {
  const eintrag: KvEintrag<T> = { standAm: Date.now(), daten }
  await env.AKTIEN_KV.put(key, JSON.stringify(eintrag), { expirationTtl: liegezeitSek })
  return eintrag
}

export interface CacheErgebnis<T> {
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
export async function mitKv<T>(env: Env, key: string, frischeMs: number, frisch: boolean, lader: () => Promise<T>): Promise<CacheErgebnis<T>> {
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

// Erste Schicht: Map im Isolate. Begrenzt, damit Suchbegriffe sie nicht endlos füllen.
const speicher = new Map<string, KvEintrag<unknown>>()
const SPEICHER_MAX = 400

function speicherSetzen(key: string, eintrag: KvEintrag<unknown>): void {
  if (speicher.size >= SPEICHER_MAX) {
    const aeltester = speicher.keys().next().value
    if (aeltester !== undefined) speicher.delete(aeltester)
  }
  speicher.delete(key)
  speicher.set(key, eintrag)
}

/**
 * Kurzlebiger Cache: Speicher → KV → Quelle. Nach dem Laden wird KV nur geschrieben, wenn der
 * dortige Stand älter als `schreibIntervallSek` ist (Schonung des Tageslimits). Scheitert die Quelle,
 * kommt der letzte Stand aus Speicher oder KV zurück (veraltet = true), egal wie alt.
 */
export async function mitCache<T>(
  env: Env,
  key: string,
  ttlSek: number,
  frisch: boolean,
  lader: () => Promise<T>,
  schreibIntervallSek = ttlSek,
): Promise<CacheErgebnis<T>> {
  const kvKey = `c:${key}`
  const jetzt = Date.now()
  const imSpeicher = speicher.get(key) as KvEintrag<T> | undefined
  if (imSpeicher && !frisch && jetzt - imSpeicher.standAm < ttlSek * 1000) return { daten: imSpeicher.daten, standAm: imSpeicher.standAm, veraltet: false, ausCache: true }

  const imKv = await kvLesen<T>(env, kvKey)
  if (imKv && !frisch && jetzt - imKv.standAm < ttlSek * 1000) {
    speicherSetzen(key, imKv)
    return { daten: imKv.daten, standAm: imKv.standAm, veraltet: false, ausCache: true }
  }

  try {
    const daten = await lader()
    const eintrag: KvEintrag<T> = { standAm: Date.now(), daten }
    speicherSetzen(key, eintrag)
    if (!imKv || eintrag.standAm - imKv.standAm >= schreibIntervallSek * 1000) {
      try {
        await env.AKTIEN_KV.put(kvKey, JSON.stringify(eintrag), { expirationTtl: LIEGEZEIT_KURZ_SEK })
      } catch {
        // KV-Limit erreicht o.ä. – der Speicher hat den Stand, nie fatal
      }
    }
    return { daten, standAm: eintrag.standAm, veraltet: false, ausCache: false }
  } catch (e) {
    const alt = [imSpeicher, imKv].filter((x): x is KvEintrag<T> => Boolean(x)).sort((a, b) => b.standAm - a.standAm)[0]
    if (alt) return { daten: alt.daten, standAm: alt.standAm, veraltet: true, ausCache: true }
    throw e
  }
}
