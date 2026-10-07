import type { Candle } from '../types'
import { intervalSekunden } from './aggregation'

// Intrabar-Replay: Eine Hauptkerze (z.B. 1h) wird nicht auf einmal gezeigt,
// sondern Schritt für Schritt aus ihren Unterkerzen (15m) aufgebaut. Der Broker
// prüft Fills, SL und TP je Unterkerze — „SL oder TP zuerst“ ergibt sich damit
// aus den Daten. Fehlen Unterkerzen, nähert der OHLC-Pfad die Kerze an:
// grün O→L→H→C, rot O→H→L→C (drei Teilstücke).
// Alles pur; die Hooks (useReplay, useSitzung) halten nur den Teilstand.

/** Unter-Intervall je Haupt-Intervall (Binance-Namen) */
export const UNTER_INTERVALL: Record<string, string> = { '1d': '4h', '4h': '1h', '1h': '15m', '15m': '5m', '5m': '1m' }

/** Cursor im Intrabar-Replay: Hauptkerze `cursor`, davon `teil` Unterkerzen verarbeitet (teil ≥ Anzahl → Kerze fertig). */
export interface Teilstand {
  cursor: number
  teil: number
}

export interface Teilschritt {
  stand: Teilstand
  /** Die gerade verarbeitete Unterkerze (echt oder OHLC-Teilstück) */
  sub: Candle
  /** Mit diesem Schritt ist die Hauptkerze vollständig */
  kerzeFertig: boolean
  /** Erster Schritt einer neuen Hauptkerze */
  neueKerze: boolean
}

/** OHLC-Pfad als drei Teilstücke: grün O→L→H→C, rot O→H→L→C. */
export function ohlcPfad(k: Candle, sek: number): Candle[] {
  const gruen = k.close >= k.open
  const punkte = gruen ? [k.open, k.low, k.high, k.close] : [k.open, k.high, k.low, k.close]
  const stueck = sek / 3
  return [0, 1, 2].map((i) => {
    const a = punkte[i]
    const b = punkte[i + 1]
    return { time: k.time + Math.round(i * stueck), open: a, high: Math.max(a, b), low: Math.min(a, b), close: b, volume: k.volume / 3 }
  })
}

/** Index der ersten Kerze mit time ≥ zeit (binäre Suche). */
function ersterIndexAb(candles: Candle[], zeit: number): number {
  let lo = 0
  let hi = candles.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (candles[m].time < zeit) lo = m + 1
    else hi = m
  }
  return lo
}

/** Unterkerzen einer Hauptkerze — echte aus `unter`, sonst der OHLC-Pfad. */
export function unterkerzenVon(k: Candle, sek: number, unter: Candle[] | null): Candle[] {
  if (unter && unter.length > 0) {
    const i = ersterIndexAb(unter, k.time)
    const out: Candle[] = []
    for (let j = i; j < unter.length && unter[j].time < k.time + sek; j++) out.push(unter[j])
    if (out.length > 0) return out
  }
  return ohlcPfad(k, sek)
}

/** Hauptkerze aus den ersten n Unterkerzen (n ≥ Anzahl → die echte Kerze). */
export function teilkerze(k: Candle, subs: Candle[], n: number): Candle {
  if (n >= subs.length) return k
  const s = subs.slice(0, Math.max(1, n))
  let high = -Infinity
  let low = Infinity
  let volume = 0
  for (const x of s) {
    high = Math.max(high, x.high)
    low = Math.min(low, x.low)
    volume += x.volume
  }
  return { time: k.time, open: s[0].open, high, low, close: s[s.length - 1].close, volume }
}

/** Wie viele Replay-Schritte eine Hauptkerze hat (Mittel; OHLC-Pfad: 3). */
export function schritteJeKerze(sek: number, unter: Candle[] | null): number {
  if (!unter || unter.length < 2) return 3
  return Math.max(1, Math.round(sek / intervalSekunden(unter)))
}

/** Teilstand „Kerze `cursor` vollständig“. */
export function fertigerStand(candles: Candle[], sek: number, unter: Candle[] | null, cursor: number): Teilstand {
  const k = candles[cursor]
  return { cursor, teil: k ? unterkerzenVon(k, sek, unter).length : 0 }
}

export function istKerzeFertig(candles: Candle[], sek: number, unter: Candle[] | null, stand: Teilstand): boolean {
  const k = candles[stand.cursor]
  return !k || stand.teil >= unterkerzenVon(k, sek, unter).length
}

/** Nächste Unterkerze — null am Ende der Daten. */
export function naechsterTeilschritt(candles: Candle[], sek: number, unter: Candle[] | null, stand: Teilstand): Teilschritt | null {
  let { cursor, teil } = stand
  let subs = unterkerzenVon(candles[cursor], sek, unter)
  if (teil >= subs.length) {
    if (cursor + 1 >= candles.length) return null
    cursor++
    teil = 0
    subs = unterkerzenVon(candles[cursor], sek, unter)
  }
  const sub = subs[teil]
  teil++
  return { stand: { cursor, teil }, sub, kerzeFertig: teil >= subs.length, neueKerze: teil === 1 }
}

/** Sichtbare Hauptkerzen: 0..cursor, die letzte ggf. erst teilweise aufgebaut. */
export function sichtbareKerzen(candles: Candle[], sek: number, unter: Candle[] | null, stand: Teilstand): Candle[] {
  const out = candles.slice(0, stand.cursor + 1)
  const k = candles[stand.cursor]
  if (k) out[out.length - 1] = teilkerze(k, unterkerzenVon(k, sek, unter), stand.teil)
  return out
}

/** Die aktuell sichtbare (ggf. unfertige) Hauptkerze und die Zeit der letzten verarbeiteten Unterkerze. */
export function aktuellerStand(candles: Candle[], sek: number, unter: Candle[] | null, stand: Teilstand): { kerze: Candle; zeit: number } {
  const k = candles[stand.cursor]
  const subs = unterkerzenVon(k, sek, unter)
  const kerze = teilkerze(k, subs, stand.teil)
  const zeit = stand.teil > 0 ? subs[Math.min(stand.teil, subs.length) - 1].time : k.time
  return { kerze, zeit }
}

/** Alle Unterkerzen bis zum aktuellen Schritt (für die Anzeige im Unter-Timeframe). */
export function unterkerzenBis(candles: Candle[], sek: number, unter: Candle[] | null, stand: Teilstand): Candle[] {
  const k = candles[stand.cursor]
  if (!k) return []
  if (unter && unter.length > 0) {
    // Schnell: echte Unterkerzen bis zur aktuellen Hauptkerze, plus die verarbeiteten der aktuellen
    const bisAktuelle = ersterIndexAb(unter, k.time)
    const aktuelle = unterkerzenVon(k, sek, unter)
    const echt = aktuelle[0] === unter[bisAktuelle]
    if (echt) return unter.slice(0, bisAktuelle + Math.min(stand.teil, aktuelle.length))
  }
  const out: Candle[] = []
  for (let i = 0; i < stand.cursor; i++) out.push(...unterkerzenVon(candles[i], sek, unter))
  out.push(...unterkerzenVon(k, sek, unter).slice(0, stand.teil))
  return out
}
