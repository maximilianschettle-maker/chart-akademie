// Lade-Logik: IndexedDB → Worker → IndexedDB. Baut aus Yahoo-Teil, SEC-Teil und Kurs
// die Fundamentaldaten (Zusammenführen passiert hier im Browser, siehe engine/normalisierung).
import { fundamentaldatenBauen } from '../engine/normalisierung'
import { useAktienStore } from '../store'
import type { Fundamentaldaten, Kurs, KursChart, SecTeil, Suchtreffer, SyncZustand, Wechselkurs, YahooTeil } from '../types'
import { paarCode, wechselkursText } from '../engine/waehrung'
import { fmtZeitpunkt } from '../engine/format'
import { bereichDef, type ChartBereich } from '../engine/chart'
import { chartCache, firmenCache, kursCache, wechselkursCache } from './cache'
import { AktienFehler, anfrage } from './client'
import { datenStatus } from './status'

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
    try {
      daten = await vomWorker(symbol, opt.frisch ?? false)
      await firmenCache.schreiben(symbol, daten)
    } catch (e) {
      // Worker nicht erreichbar: der gespeicherte Stand ist besser als eine leere Seite
      if (!gecacht) throw e
      const grund = e instanceof Error ? e.message : String(e)
      datenStatus.veraltet(gecacht.standAm, grund)
      daten = { ...gecacht.daten, standAm: gecacht.standAm, veraltet: true, hinweise: [...gecacht.daten.hinweise, `Gespeicherter Stand vom ${fmtZeitpunkt(gecacht.standAm)} – neu laden nicht möglich: ${grund}`] }
    }
  }

  // Kurs separat (kurzlebig). Scheitert er, bleibt der alte Kurs aus den Daten.
  if (!opt.nurCache) {
    const kurs = await ladeKurs(symbol, opt.frisch ?? false)
    if (kurs) daten = { ...daten, kurs }
  }
  return mitWechselkurs(daten, opt.nurCache ?? false)
}

const WECHSELKURS_FRISCHE_MS = 60 * 60_000
const HINWEIS_OHNE_KURSBEZUG = /Kennzahlen mit Kursbezug werden nicht berechnet/

/** Bei abweichender Kurswährung den Wechselkurs holen (Cache 1 h) und den Hinweis entsprechend anpassen. */
async function mitWechselkurs(daten: Fundamentaldaten, nurCache: boolean): Promise<Fundamentaldaten> {
  const kurs = daten.kurs
  if (!kurs || kurs.waehrung === daten.firma.waehrung) return daten
  const code = paarCode(kurs.waehrung, daten.firma.waehrung)
  let wk: Wechselkurs | undefined
  try {
    wk = (await ladeWechselkurse([code], nurCache))[code]
  } catch {
    wk = undefined
  }
  if (!wk) return daten
  const hinweise = daten.hinweise.filter((h) => !HINWEIS_OHNE_KURSBEZUG.test(h))
  hinweise.push(`Kurs in ${kurs.waehrung}, Abschlüsse in ${daten.firma.waehrung}: kursbezogene Kennzahlen mit ${wechselkursText(wk)} (Yahoo) umgerechnet.`)
  return { ...daten, wechselkurs: wk, hinweise }
}

/** Wechselkurse für Paarcodes wie 'USDEUR'; aus dem Cache, wenn jünger als eine Stunde, sonst vom Worker. */
export async function ladeWechselkurse(paare: string[], nurCache = false): Promise<Record<string, Wechselkurs>> {
  const aus: Record<string, Wechselkurs> = {}
  const fehlend: string[] = []
  for (const p of paare) {
    const g = await wechselkursCache.lesen(p)
    if (g && (nurCache || Date.now() - g.standAm < WECHSELKURS_FRISCHE_MS)) aus[p] = g.daten
    else fehlend.push(p)
  }
  if (fehlend.length === 0 || nurCache) return aus
  const antwort = await anfrage<{ kurse: Record<string, Wechselkurs> }>(`/api/wechselkurse?paare=${encodeURIComponent(fehlend.join(','))}`)
  for (const p of fehlend) {
    const wk = antwort?.kurse[p]
    if (wk) {
      aus[p] = wk
      await wechselkursCache.schreiben(p, wk)
    } else {
      const g = await wechselkursCache.lesen(p)
      if (g) aus[p] = g.daten
    }
  }
  return aus
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

/** Kurs: IndexedDB (15 min) → Worker; bei Fehler der alte Stand (als veraltet gemeldet) oder null. */
export async function ladeKurs(symbol: string, frisch = false): Promise<Kurs | null> {
  const gecacht = await kursCache.lesen(symbol)
  if (gecacht && !frisch && Date.now() - gecacht.standAm < KURS_FRISCHE_MS) return gecacht.daten
  try {
    const kurs = await anfrage<Kurs>(`/api/kurs/${encodeURIComponent(symbol)}${frisch ? '?frisch=1' : ''}`)
    if (kurs?.veraltet) {
      // Der Worker hat Yahoo nicht erreicht und liefert seinen letzten Stand
      datenStatus.veraltet(kurs.standAm, 'Yahoo nicht erreichbar, Worker liefert den letzten Stand')
      if (gecacht && gecacht.standAm >= (kurs.standAm ?? 0)) return { ...gecacht.daten, veraltet: true }
    } else if (kurs) {
      await kursCache.schreiben(symbol, kurs)
    }
    return kurs ?? gecacht?.daten ?? null
  } catch (e) {
    if (gecacht) datenStatus.veraltet(gecacht.standAm, e instanceof Error ? e.message : String(e))
    return gecacht ? { ...gecacht.daten, veraltet: true } : null
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

/** Kursverlauf: IndexedDB (Frische je Bereich wie im Worker) → Worker; bei Netzfehler der alte Stand. */
export async function ladeChart(symbol: string, bereich: ChartBereich, frisch = false): Promise<KursChart> {
  const def = bereichDef(bereich)
  if (!def) throw new AktienFehler(`Unbekannter Zeitraum ${bereich}`, 400)
  const key = `${symbol}:${def.bereich}`
  const gecacht = await chartCache.lesen(key)
  if (gecacht && !frisch && Date.now() - gecacht.standAm < def.ttlSek * 1000) return gecacht.daten
  try {
    const daten = await anfrage<KursChart>(`/api/chart/${encodeURIComponent(symbol)}?bereich=${def.bereich}${frisch ? '&frisch=1' : ''}`)
    if (!daten) throw new AktienFehler(`Keine Kursdaten für ${symbol}`, 404)
    if (daten.veraltet) datenStatus.veraltet(daten.standAm, 'Yahoo nicht erreichbar, Worker liefert den letzten Stand')
    else await chartCache.schreiben(key, daten)
    return daten
  } catch (e) {
    if (gecacht) {
      datenStatus.veraltet(gecacht.standAm, e instanceof Error ? e.message : String(e))
      return { ...gecacht.daten, veraltet: true, standAm: gecacht.standAm }
    }
    throw e
  }
}
