// Lade-Logik: IndexedDB → Worker → IndexedDB. Baut aus Yahoo-Teil, SEC-Teil und Kurs
// die Fundamentaldaten (Zusammenführen passiert hier im Browser, siehe engine/normalisierung).
import { fundamentaldatenBauen } from '../engine/normalisierung'
import { useAktienStore } from '../store'
import type { Fundamentaldaten, Kurs, SecTeil, Suchtreffer, SyncZustand, YahooTeil } from '../types'
import { firmenCache, kursCache } from './cache'
import { AktienFehler, anfrage } from './client'

const TAG_MS = 86_400_000
export const FIRMA_FRISCHE_MS = 7 * TAG_MS
const KURS_FRISCHE_MS = 15 * 60_000

export interface LadeOptionen {
  /** Cache übergehen und beim Worker neu laden (der wiederum seine Quellen neu fragt) */
  frisch?: boolean
  /** nur aus dem lokalen Cache, nie Netz (Watchlist-Übersicht) */
  nurCache?: boolean
}

export async function ladeFirma(symbol: string, opt: LadeOptionen = {}): Promise<Fundamentaldaten | null> {
  const gecacht = await firmenCache.lesen(symbol)
  const frischGenug = gecacht && Date.now() - gecacht.standAm < FIRMA_FRISCHE_MS
  let daten: Fundamentaldaten | null = null

  if (gecacht && (opt.nurCache || (frischGenug && !opt.frisch))) {
    daten = gecacht.daten
  } else if (opt.nurCache) {
    return null
  } else {
    daten = await vomWorker(symbol, opt.frisch ?? false)
    await firmenCache.schreiben(symbol, daten)
  }

  // Kurs separat (kurzlebig). Scheitert er, bleibt der alte Kurs aus den Daten.
  if (!opt.nurCache) {
    const kurs = await ladeKurs(symbol, opt.frisch ?? false)
    if (kurs) daten = { ...daten, kurs }
  }
  return daten
}

async function vomWorker(symbol: string, frisch: boolean): Promise<Fundamentaldaten> {
  const q = frisch ? '?frisch=1' : ''
  const yahoo = await anfrage<YahooTeil>(`/api/yahoo/${encodeURIComponent(symbol)}${q}`)
  const hinweise: string[] = []
  let sec: SecTeil | null = null
  try {
    const p = new URLSearchParams()
    if (yahoo?.firma.name) p.set('name', yahoo.firma.name)
    if (yahoo?.firma.waehrung) p.set('waehrung', yahoo.firma.waehrung)
    const cik = useAktienStore.getState().cikManuell[symbol]
    if (cik) p.set('cik', cik)
    if (frisch) p.set('frisch', '1')
    sec = await anfrage<SecTeil>(`/api/sec/${encodeURIComponent(symbol)}?${p.toString()}`)
  } catch (e) {
    if (!yahoo) throw e
    hinweise.push(`SEC-Daten nicht geladen: ${e instanceof Error ? e.message : String(e)}`)
  }
  const daten = fundamentaldatenBauen(yahoo, sec, null, Date.now(), Boolean(yahoo?.veraltet || sec?.veraltet))
  if (!daten) throw new AktienFehler(`Keine Daten für ${symbol}`, 404)
  daten.hinweise.push(...hinweise)
  return daten
}

export async function ladeKurs(symbol: string, frisch = false): Promise<Kurs | null> {
  const gecacht = await kursCache.lesen(symbol)
  if (gecacht && !frisch && Date.now() - gecacht.standAm < KURS_FRISCHE_MS) return gecacht.daten
  try {
    const kurs = await anfrage<Kurs>(`/api/kurs/${encodeURIComponent(symbol)}${frisch ? '?frisch=1' : ''}`)
    if (kurs) await kursCache.schreiben(symbol, kurs)
    return kurs ?? gecacht?.daten ?? null
  } catch {
    return gecacht?.daten ?? null
  }
}

export async function suche(begriff: string): Promise<Suchtreffer[]> {
  const t = begriff.trim()
  if (t.length < 2) return []
  return (await anfrage<Suchtreffer[]>(`/api/suche?q=${encodeURIComponent(t)}`)) ?? []
}

export async function statusPruefen(): Promise<{ version: string; yahoo?: string; sec?: string }> {
  const s = await anfrage<{ version: string; yahoo?: string; sec?: string }>('/api/status?pruefen=1')
  if (!s) throw new AktienFehler('Leere Antwort', 0)
  return s
}

export async function zustandHolen(): Promise<SyncZustand | null> {
  return anfrage<SyncZustand | null>('/api/zustand')
}

/** Schreibt den Zustand; bei 409 kommt der neuere ferne Stand zurück. */
export async function zustandSchreiben(z: SyncZustand): Promise<{ ok: true } | { ok: false; fern: SyncZustand }> {
  try {
    await anfrage<SyncZustand>('/api/zustand', { method: 'PUT', body: JSON.stringify(z) })
    return { ok: true }
  } catch (e) {
    if (e instanceof AktienFehler && e.status === 409) {
      const fern = await zustandHolen()
      if (fern) return { ok: false, fern }
    }
    throw e
  }
}
