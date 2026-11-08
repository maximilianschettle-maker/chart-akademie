import type { Candle, ExitGrund, Trade } from '../types'
import type { AusstiegGrund, JournalEintrag, Zeitrahmen } from './types'
import { INSTRUMENTE } from '../tracker/engine/katalog'
import { STRATEGIEN, strategieName } from '../content/strategien'
import type { ChartBereich } from '../aktien/engine/chart'

// Reine Logik des Journals für echte Trades: Anlegen, R-Multiple, Abbildung auf den
// Simulator-Trade (damit die bestehende Auswertung läuft), Zusammenführen, Tageslimit,
// Plan-Abweichung, CSV und der Kerzen-Ausschnitt für den Snapshot. Alles ohne DOM, getestet.

/** Märkte für die Chips, eToro-Favoriten zuerst; danach der Rest des Tracker-Katalogs */
export const MARKT_FAVORITEN = ['nasdaq100', 'gold', 'oel', 'bitcoin']

export interface MarktDef {
  id: string
  name: string
  symbol: string
  waehrung: string
}

export function marktListe(): MarktDef[] {
  const alle = INSTRUMENTE.map((i) => ({ id: i.id, name: i.name, symbol: i.symbol, waehrung: i.waehrung }))
  const favoriten = MARKT_FAVORITEN.map((id) => alle.find((m) => m.id === id)).filter((m): m is MarktDef => Boolean(m))
  return [...favoriten, ...alle.filter((m) => !MARKT_FAVORITEN.includes(m.id))]
}

export const SETUP_SONSTIGES = 'sonstiges'

export function setupListe(): { id: string; name: string; kurz: string }[] {
  return [...STRATEGIEN.map((s) => ({ id: s.id, name: s.name, kurz: s.kurz })), { id: SETUP_SONSTIGES, name: 'Sonstiges (Freitext)', kurz: 'Sonstiges' }]
}

export function setupName(e: Pick<JournalEintrag, 'strategieId' | 'setupFrei'>): string {
  if (e.strategieId === SETUP_SONSTIGES) return e.setupFrei?.trim() || 'Sonstiges'
  return strategieName(e.strategieId)
}

let zaehler = 0
export function neueId(jetztMs = Date.now()): string {
  zaehler = (zaehler + 1) % 1000
  return `j-${jetztMs.toString(36)}-${zaehler.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

export type EintragEntwurf = Omit<JournalEintrag, 'id' | 'status' | 'erstelltAm' | 'geaendertAm'>

export function neuerEintrag(entwurf: EintragEntwurf, jetztMs = Date.now()): JournalEintrag {
  return { ...entwurf, id: neueId(jetztMs), status: 'offen', erstelltAm: jetztMs, geaendertAm: jetztMs }
}

/** Fehlertexte für ein Formular; leer = speicherbar */
export function pruefeEintrag(e: Partial<EintragEntwurf>): string[] {
  const fehler: string[] = []
  if (!e.markt?.trim()) fehler.push('Markt fehlt.')
  if (!e.symbol?.trim()) fehler.push('Symbol für die Kerzen fehlt.')
  if (!(e.entryPreis && e.entryPreis > 0)) fehler.push('Einstieg fehlt.')
  if (!(e.stopLoss && e.stopLoss > 0)) fehler.push('Stop fehlt. (Trades aus der Broker-Historie ohne Stop lassen sich nur über den Screenshot-Import anlegen.)')
  if (e.entryPreis && e.stopLoss && e.entryPreis > 0 && e.stopLoss > 0) {
    if (e.richtung === 'long' && e.stopLoss >= e.entryPreis) fehler.push('Long: der Stop muss unter dem Einstieg liegen.')
    if (e.richtung === 'short' && e.stopLoss <= e.entryPreis) fehler.push('Short: der Stop muss über dem Einstieg liegen.')
    if (e.takeProfit && e.takeProfit > 0) {
      if (e.richtung === 'long' && e.takeProfit <= e.entryPreis) fehler.push('Long: das Ziel muss über dem Einstieg liegen.')
      if (e.richtung === 'short' && e.takeProfit >= e.entryPreis) fehler.push('Short: das Ziel muss unter dem Einstieg liegen.')
    }
  }
  if (!(e.entryTime && e.entryTime > 0)) fehler.push('Zeitpunkt fehlt.')
  if (!e.strategieId) fehler.push('Setup fehlt.')
  return fehler
}

/** Geplantes Chance-Risiko-Verhältnis; NaN ohne Ziel */
export function geplantesCrv(e: Pick<JournalEintrag, 'entryPreis' | 'stopLoss' | 'takeProfit'>): number {
  const risiko = Math.abs(e.entryPreis - e.stopLoss)
  if (!(e.takeProfit > 0) || risiko <= 0) return NaN
  return Math.abs(e.takeProfit - e.entryPreis) / risiko
}

/** R-Multiple aus Preisen: Ausstieg relativ zum Einstieg, gemessen am Stop-Abstand. null solange offen. */
export function rMultiple(e: Pick<JournalEintrag, 'richtung' | 'entryPreis' | 'stopLoss' | 'exitPreis'>): number | null {
  if (e.exitPreis === undefined || !(e.exitPreis > 0)) return null
  // ohne Stop (z.B. Import aus der eToro-Historie) gibt es kein R – sonst käme ein Pseudo-R gegen den Nullpunkt heraus
  if (!(e.stopLoss > 0)) return null
  const risiko = Math.abs(e.entryPreis - e.stopLoss)
  if (risiko <= 0) return null
  const bewegung = e.richtung === 'long' ? e.exitPreis - e.entryPreis : e.entryPreis - e.exitPreis
  return bewegung / risiko
}

/** Ergebnis in Kontowährung: Broker-Angabe, sonst R × Risikobetrag, sonst null */
export function ergebnis(e: JournalEintrag): number | null {
  if (e.ergebnisBetrag !== undefined && Number.isFinite(e.ergebnisBetrag)) return e.ergebnisBetrag
  const r = rMultiple(e)
  if (r === null || !e.risikoBetrag) return null
  return r * e.risikoBetrag - (e.gebuehren ?? 0)
}

const EXIT_GRUND: Record<AusstiegGrund, ExitGrund> = { ziel: 'tp', stop: 'sl', manuell: 'manuell' }

/**
 * Abbildung auf den Simulator-Trade, damit `logischeTrades`, Kennzahlen, R-Verteilung und Fehlermuster
 * unverändert laufen. pnl = Ergebnis in Kontowährung (0, wenn unbekannt), rMultiple aus Preisen.
 */
export function alsTrade(e: JournalEintrag): Trade | null {
  if (e.status !== 'geschlossen' || e.exitPreis === undefined) return null
  // ohne Stop kein R → der Trade bleibt in Liste und Ergebnis-Summe, aber nicht in der R-Statistik
  const r = rMultiple(e)
  if (r === null) return null
  return {
    id: e.id,
    richtung: e.richtung,
    entryPreis: e.entryPreis,
    exitPreis: e.exitPreis,
    entryTime: e.entryTime,
    exitTime: e.exitTime ?? e.entryTime,
    menge: 0,
    stopLoss: e.stopLoss,
    takeProfit: e.takeProfit,
    pnl: ergebnis(e) ?? 0,
    rMultiple: r,
    exitGrund: EXIT_GRUND[e.exitGrund ?? 'manuell'],
    // logischeTrades nimmt szenarioId als Sitzung – so bleibt jeder Eintrag ein eigener logischer Trade
    szenarioId: e.id,
    gebuehren: e.gebuehren,
    strategieId: e.strategieId === SETUP_SONSTIGES ? undefined : e.strategieId,
    interval: e.zeitrahmen,
    symbol: e.symbol,
    notiz: e.begruendung,
  }
}

export function geschlosseneAlsTrades(eintraege: JournalEintrag[]): Trade[] {
  return eintraege.map(alsTrade).filter((t): t is Trade => t !== null)
}

/** Zusammenführen per Id; bei gleicher Id gewinnt der neuere Änderungsstand */
export function mergeEintraege(vorhanden: JournalEintrag[], neue: JournalEintrag[]): JournalEintrag[] {
  const map = new Map(vorhanden.map((e) => [e.id, e]))
  for (const e of neue) {
    const alt = map.get(e.id)
    if (!alt || e.geaendertAm > alt.geaendertAm) map.set(e.id, e)
  }
  return [...map.values()].sort((a, b) => a.entryTime - b.entryTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Tageschlüssel in Berliner Zeit (Handelstag des Nutzers) */
export function tagVon(unixSek: number): string {
  return new Date(unixSek * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/** Geschlossene Verlusttrades (R < 0) je Tag; nur Tage mit mindestens einem Verlust */
export function verlusteJeTag(eintraege: JournalEintrag[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of eintraege) {
    if (e.status !== 'geschlossen') continue
    const r = rMultiple(e)
    if (r === null || r >= 0) continue
    const tag = tagVon(e.exitTime ?? e.entryTime)
    m.set(tag, (m.get(tag) ?? 0) + 1)
  }
  return m
}

export const TAGESLIMIT_VERLUSTE = 2

/** Tageslimit erreicht? Hinweis-Text für den gegebenen Tag, sonst null */
export function tageslimitHinweis(eintraege: JournalEintrag[], tag: string): string | null {
  const n = verlusteJeTag(eintraege).get(tag) ?? 0
  if (n < TAGESLIMIT_VERLUSTE) return null
  return `${n} Verlusttrades an diesem Tag – Tageslimit erreicht, kein weiterer Trade heute.`
}

export interface PlanAbweichung {
  gesamt: number
  ausserhalb: number
  summeRAusserhalb: number
  summeRImPlan: number
}

/** Wie oft außerhalb des Plans gehandelt und was es in R gekostet hat (nur geschlossene, beantwortete) */
export function planAbweichung(eintraege: JournalEintrag[]): PlanAbweichung {
  const out: PlanAbweichung = { gesamt: 0, ausserhalb: 0, summeRAusserhalb: 0, summeRImPlan: 0 }
  for (const e of eintraege) {
    if (e.status !== 'geschlossen' || e.imPlan === null) continue
    const r = rMultiple(e)
    if (r === null) continue
    out.gesamt += 1
    if (e.imPlan) out.summeRImPlan += r
    else {
      out.ausserhalb += 1
      out.summeRAusserhalb += r
    }
  }
  return out
}

// ── Filter ───────────────────────────────────────────────────────────────────

export interface JournalFilter {
  markt?: string
  strategieId?: string
  /** Unix-Sekunden, einschließlich */
  von?: number
  bis?: number
  status?: 'offen' | 'geschlossen'
}

export function filtern(eintraege: JournalEintrag[], f: JournalFilter): JournalEintrag[] {
  return eintraege.filter(
    (e) =>
      (!f.markt || e.markt === f.markt) &&
      (!f.strategieId || e.strategieId === f.strategieId) &&
      (f.von === undefined || e.entryTime >= f.von) &&
      (f.bis === undefined || e.entryTime <= f.bis) &&
      (!f.status || e.status === f.status),
  )
}

// ── CSV ──────────────────────────────────────────────────────────────────────

const CSV_SPALTEN = ['Einstieg am', 'Markt', 'Richtung', 'Setup', 'Zeitrahmen', 'Einstieg', 'Stop', 'Ziel', 'Risiko %', 'Status', 'Ausstieg am', 'Ausstieg', 'Grund', 'R', 'Ergebnis', 'Gebühren', 'Im Plan', 'Gefühl vorher', 'Gefühl nachher', 'Begründung', 'Lehre']

function csvZelle(v: unknown): string {
  if (v === undefined || v === null) return ''
  const s = typeof v === 'number' ? v.toLocaleString('de-DE', { maximumFractionDigits: 6, useGrouping: false }) : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvZeit(unixSek?: number): string {
  if (!unixSek) return ''
  return new Date(unixSek * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Semikolon-getrennt mit BOM, damit deutsches Excel es direkt öffnet */
export function eintraegeAlsCsv(eintraege: JournalEintrag[]): string {
  const zeilen = [CSV_SPALTEN.join(';')]
  for (const e of eintraege) {
    const r = rMultiple(e)
    zeilen.push(
      [
        csvZeit(e.entryTime),
        e.markt,
        e.richtung === 'long' ? 'Long' : 'Short',
        setupName(e),
        e.zeitrahmen,
        e.entryPreis,
        e.stopLoss,
        e.takeProfit || '',
        e.risikoProzent,
        e.status,
        csvZeit(e.exitTime),
        e.exitPreis ?? '',
        e.exitGrund ?? '',
        r === null ? '' : Math.round(r * 100) / 100,
        e.ergebnisBetrag ?? '',
        e.gebuehren ?? '',
        e.imPlan === null ? '' : e.imPlan ? 'ja' : 'nein',
        e.gefuehlVorher ?? '',
        e.gefuehlNachher ?? '',
        e.begruendung ?? '',
        e.lehre ?? '',
      ]
        .map(csvZelle)
        .join(';'),
    )
  }
  return '﻿' + zeilen.join('\r\n') + '\r\n'
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

/** Welcher Worker-Bereich liefert Kerzen im passenden Intervall (Yahoo: 5m nur 3 Tage, 15m 7 Tage) */
export function bereichFuerZeitrahmen(z: Zeitrahmen): ChartBereich {
  if (z === '1m' || z === '5m') return '1T'
  if (z === '15m' || z === '1h') return '5T'
  return '6M'
}

/** Vorlauf reicht für die Setup-Erkennung (ERKENNUNG_RUECKSCHAU 420) */
export const SNAPSHOT_VOR = 450
export const SNAPSHOT_NACH = 60

/** Ausschnitt um den Einstieg; null, wenn der Einstieg vor der ersten Kerze liegt (Daten reichen nicht zurück) */
export function kerzenUmEinstieg(kerzen: Candle[], entryTime: number, vor = SNAPSHOT_VOR, nach = SNAPSHOT_NACH): Candle[] | null {
  if (kerzen.length === 0 || entryTime < kerzen[0].time) return null
  let i = kerzen.findIndex((k) => k.time > entryTime)
  if (i === -1) i = kerzen.length
  const index = Math.max(0, i - 1)
  return kerzen.slice(Math.max(0, index - vor), Math.min(kerzen.length, index + nach + 1))
}

/**
 * Erste Kerze nach dem Einstieg, die den Stop bzw. das Ziel berührt – die Zeit, zu der der Broker
 * die Position tatsächlich geschlossen hat (nicht „jetzt“). null, wenn keine Kerze den Preis erreicht.
 */
export function trefferZeit(kerzen: Candle[], entryTime: number, richtung: 'long' | 'short', preis: number, art: 'stop' | 'ziel'): number | null {
  if (!(preis > 0)) return null
  const unten = (richtung === 'long') === (art === 'stop') // Long-Stop und Short-Ziel liegen unter dem Markt
  for (const k of kerzen) {
    if (k.time < entryTime) continue
    if (unten ? k.low <= preis : k.high >= preis) return k.time
  }
  return null
}

/** Datum und Uhrzeit kurz, Berliner Zeit */
export function zeitKurz(unixSek: number): string {
  return new Date(unixSek * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/**
 * Zahl aus einer Eingabe, deutsch oder englisch geschrieben: „26.975,40“, „26975,4“, „26975.4“, „1.234.567“.
 * Punkt und Komma zusammen → Punkt ist Tausendertrenner; nur Komma → Dezimalkomma; nur ein Punkt → Dezimalpunkt;
 * mehrere Punkte → Tausenderpunkte. null, wenn keine Zahl.
 */
export function zahlAusText(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(/[€$]/g, '')
  if (!t) return null
  let norm: string
  if (t.includes(',')) norm = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1) norm = t.replace(/\./g, '')
  else norm = t
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

/** Zahl als Eingabetext (deutsches Komma, ohne Tausenderpunkte) */
export function zahlAlsText(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

/** Zeit-Helfer für datetime-local (Ortszeit des Geräts) */
export function unixAusOrtszeit(text: string): number | null {
  if (!text) return null
  const ms = new Date(text).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

export function ortszeitAusUnix(unixSek: number): string {
  const d = new Date(unixSek * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
