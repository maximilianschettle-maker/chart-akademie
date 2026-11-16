// KI-Tageslimit je Nutzer: Zähler ki:<nutzerId>:<YYYY-MM-DD> (Berliner Tag), zwei Tage Liegezeit.
// Gezählt wird nach einem erfolgreichen Aufruf; parallele Aufrufe können den Zähler um eins
// verfehlen — bei 10 am Tag unerheblich.

import { HttpFehler, type Env } from './http'
import type { Zugang } from './zugang'

export function berlinTag(ms = Date.now()): string {
  return new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

export const kiKey = (nutzerId: string, tag: string) => `ki:${nutzerId}:${tag}`

export async function kiVerbrauch(env: Env, nutzerId: string, tag = berlinTag()): Promise<number> {
  try {
    const roh = await env.AKTIEN_KV.get(kiKey(nutzerId, tag))
    const n = roh ? Number(roh) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function kiLimitText(heute: number, limit: number): string {
  return `KI-Tageslimit erreicht (${heute} von ${limit}). Morgen geht es weiter.`
}

/** Wirft 429, wenn das Tageslimit erreicht ist. */
export async function kiPruefen(env: Env, zugang: Zugang, tag = berlinTag()): Promise<void> {
  if (zugang.kiLimitTag === null) return
  const heute = await kiVerbrauch(env, zugang.nutzerId, tag)
  if (heute >= zugang.kiLimitTag) throw new HttpFehler(kiLimitText(heute, zugang.kiLimitTag), 429)
}

export async function kiZaehlen(env: Env, nutzerId: string, tag = berlinTag()): Promise<number> {
  const heute = (await kiVerbrauch(env, nutzerId, tag)) + 1
  try {
    await env.AKTIEN_KV.put(kiKey(nutzerId, tag), String(heute), { expirationTtl: 2 * 86_400 })
  } catch {
    // KV-Limit – der Aufruf war schon erfolgreich, nie fatal
  }
  return heute
}
