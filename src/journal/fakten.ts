import type { Candle } from '../types'
import type { JournalEintrag } from './types'
import { erkenneImFenster, type ErkanntesSetup } from '../engine/setupErkennung'
import { ema } from '../engine/indikatoren/ema'
import { rsi } from '../engine/indikatoren/rsi'
import { letzterAtr } from '../engine/indikatoren/atr'
import { strategieName } from '../content/strategien'
import { geplantesCrv, rMultiple, setupName, tagVon } from './engine'
import { checklisteFakten } from './checkliste'

// Fakten für die KI-Prüfung: alles, was sich aus den Kerzen bis zum Einstieg und aus dem Journal
// berechnen lässt. Das Modell sieht keine Kerzen – es bekommt nur diese Zahlen und Aussagen und
// formuliert daraus das Urteil. Kein Blick in die Zukunft: Setup, Trend, Struktur und Stop-Maße
// nutzen ausschließlich Kerzen bis zur Einstiegskerze; „ergebnis“ kommt nur auf Wunsch dazu.

/** Zusatz für Übungs-Trades (Top-Down-Replay, Simulator): was die Übung selbst schon festgestellt hat */
export interface UebungsKontext {
  art: 'top-down' | 'simulator'
  /** Richtung des Tagescharts laut Übung */
  tagesRichtung?: 'auf' | 'ab' | 'seitwaerts' | string
  /** vorberechnete Kriterien der Übung (Richtung, Zone, Bestätigung, Stop, CRV) */
  kriterien?: { titel: string; ok: boolean; text: string }[]
  /** wichtige Zonen der Zonen-Erkennung */
  zonen?: { von: number; bis: number; text: string }[]
  /** „Kein Trade“-Entscheidung mit Bewertung der Übung */
  keinTrade?: { bewertung: string; text: string }
  /** vom Nutzer gewähltes Setup */
  setupGewaehlt?: string | null
  /** Abgleich des Simulator-Rückblicks mit der Setup-Erkennung */
  abgleich?: string
}

export interface TradeFakten {
  /** gesetzt bei Übungs-Trades */
  uebung?: UebungsKontext
  markt: string
  richtung: 'long' | 'short'
  zeitrahmen: string
  einstiegAm: string
  einstieg: number
  /** null = kein Stop gesetzt (Import aus der Historie) */
  stop: number | null
  ziel: number | null
  crv: number | null
  risikoProzent: number
  hebel: number | null
  setupBehauptet: string
  begruendung: string | null
  gefuehlVorher: string | null
  imPlan: boolean | null
  /** Antworten der Checkliste vor dem Trade (null = nicht ausgefüllt) */
  checkliste: { text: string; ok: boolean | null }[] | null
  kerzen: { intervall: string; vorEinstieg: number; nachEinstieg: number } | null
  /** Regelbasierte Erkennung an der Einstiegskerze und den 12 Kerzen davor */
  erkanntesSetup: {
    name: string
    richtung: 'long' | 'short'
    /** Kerzen zwischen Signalkerze und Einstieg (0 = Einstieg auf der Signalkerze) */
    signalVorKerzen: number
    zoneVon: number
    zoneBis: number
    idealEinstieg: number
    idealStop: number
    idealZiel: number
    merkmale: string[]
  } | null
  einstiegInZone: boolean | null
  trend: 'auf' | 'ab' | 'seitwaerts' | null
  emaLage: string | null
  rsi14: number | null
  /** Stop- und Zielabstand in ATR(14) */
  atr: number | null
  stopInAtr: number | null
  zielInAtr: number | null
  /** Nächstes Swing-Tief (Long) bzw. -Hoch (Short) vor dem Einstieg und ob der Stop dahinter liegt */
  struktur: { preis: number; stopDahinter: boolean } | null
  heute: { tradesVorher: number; verlusteVorher: number }
  ergebnis: {
    r: number | null
    exitGrund: string | null
    ausstiegAm: string | null
    mfeR: number | null
    maeR: number | null
    kerzenGehalten: number | null
  } | null
}

const SIGNAL_RUECKSCHAU = 12
const SWING_RUECKSCHAU = 40

function zeitText(unixSek: number): string {
  return new Date(unixSek * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Index der Kerze, die den Einstieg enthält (letzte mit time ≤ entryTime); -1 wenn vor der ersten Kerze */
export function einstiegsIndex(kerzen: Candle[], entryTime: number): number {
  let i = -1
  for (let k = 0; k < kerzen.length; k++) {
    if (kerzen[k].time <= entryTime) i = k
    else break
  }
  return i
}

/** Setup an der Einstiegskerze oder kurz davor (nur Kerzen bis zum Einstieg) */
export function setupVorEinstieg(bis: Candle[], index: number): { setup: ErkanntesSetup; abstand: number } | null {
  for (let j = index; j >= Math.max(0, index - SIGNAL_RUECKSCHAU); j--) {
    const s = erkenneImFenster(bis, j)
    if (s) return { setup: s, abstand: index - j }
  }
  return null
}

export function trendAus(bis: Candle[], index: number): { trend: 'auf' | 'ab' | 'seitwaerts'; lage: string } | null {
  if (index < 50) return null
  const e20 = ema(bis, 20)[index]
  const e50 = ema(bis, 50)[index]
  const e50Vorher = ema(bis, 50)[Math.max(0, index - 20)]
  if (!Number.isFinite(e20) || !Number.isFinite(e50)) return null
  const close = bis[index].close
  const steigt = Number.isFinite(e50Vorher) && e50 > e50Vorher
  const faellt = Number.isFinite(e50Vorher) && e50 < e50Vorher
  const trend = close > e20 && e20 > e50 && steigt ? 'auf' : close < e20 && e20 < e50 && faellt ? 'ab' : 'seitwaerts'
  const lage = `Kurs ${close > e20 ? 'über' : 'unter'} EMA 20, EMA 20 ${e20 > e50 ? 'über' : 'unter'} EMA 50, EMA 50 ${steigt ? 'steigend' : faellt ? 'fallend' : 'flach'}`
  return { trend, lage }
}

/** Letztes Swing-Tief (Long) bzw. -Hoch (Short) vor dem Einstieg: lokales Extrem mit zwei Kerzen je Seite */
export function swingVorEinstieg(bis: Candle[], index: number, richtung: 'long' | 'short'): number | null {
  for (let i = index - 2; i >= Math.max(2, index - SWING_RUECKSCHAU); i--) {
    if (richtung === 'long') {
      const l = bis[i].low
      if (l <= bis[i - 1].low && l <= bis[i - 2].low && l <= bis[i + 1].low && l <= bis[i + 2].low) return l
    } else {
      const h = bis[i].high
      if (h >= bis[i - 1].high && h >= bis[i - 2].high && h >= bis[i + 1].high && h >= bis[i + 2].high) return h
    }
  }
  return null
}

/** Größter Buchgewinn / -verlust in R zwischen Einstieg und Ausstieg (oder bis zur letzten Kerze) */
export function exkursion(kerzen: Candle[], index: number, e: Pick<JournalEintrag, 'richtung' | 'entryPreis' | 'stopLoss' | 'exitTime'>): { mfeR: number; maeR: number; kerzen: number } | null {
  const risiko = Math.abs(e.entryPreis - e.stopLoss)
  if (risiko <= 0 || index < 0) return null
  let best = 0
  let worst = 0
  let n = 0
  for (let i = index + 1; i < kerzen.length; i++) {
    if (e.exitTime && kerzen[i].time > e.exitTime) break
    n += 1
    const gut = e.richtung === 'long' ? kerzen[i].high - e.entryPreis : e.entryPreis - kerzen[i].low
    const schlecht = e.richtung === 'long' ? e.entryPreis - kerzen[i].low : kerzen[i].high - e.entryPreis
    best = Math.max(best, gut)
    worst = Math.max(worst, schlecht)
  }
  if (n === 0) return null
  const r = (x: number) => Math.round((x / risiko) * 100) / 100
  return { mfeR: r(best), maeR: -r(worst), kerzen: n }
}

export function heuteVorher(alle: JournalEintrag[], e: JournalEintrag): { tradesVorher: number; verlusteVorher: number } {
  const tag = tagVon(e.entryTime)
  const vorher = alle.filter((x) => x.id !== e.id && x.entryTime < e.entryTime && tagVon(x.entryTime) === tag)
  const verluste = vorher.filter((x) => x.status === 'geschlossen' && (rMultiple(x) ?? 0) < 0 && (x.exitTime ?? x.entryTime) <= e.entryTime)
  return { tradesVorher: vorher.length, verlusteVorher: verluste.length }
}

const rund = (x: number, stellen = 2) => Math.round(x * 10 ** stellen) / 10 ** stellen

export function faktenSammeln(e: JournalEintrag, kerzen: Candle[] | null, alle: JournalEintrag[], intervall: string | null, mitErgebnis: boolean): TradeFakten {
  const crv = geplantesCrv(e)
  const fakten: TradeFakten = {
    markt: e.markt,
    richtung: e.richtung,
    zeitrahmen: e.zeitrahmen,
    einstiegAm: zeitText(e.entryTime),
    einstieg: e.entryPreis,
    stop: e.stopLoss > 0 ? e.stopLoss : null,
    ziel: e.takeProfit > 0 ? e.takeProfit : null,
    crv: Number.isFinite(crv) ? rund(crv) : null,
    risikoProzent: e.risikoProzent,
    hebel: e.hebel ?? null,
    setupBehauptet: setupName(e),
    begruendung: e.begruendung ?? null,
    gefuehlVorher: e.gefuehlVorher ?? null,
    imPlan: e.imPlan,
    checkliste: e.checkliste ? checklisteFakten(e.checkliste) : null,
    kerzen: null,
    erkanntesSetup: null,
    einstiegInZone: null,
    trend: null,
    emaLage: null,
    rsi14: null,
    atr: null,
    stopInAtr: null,
    zielInAtr: null,
    struktur: null,
    heute: heuteVorher(alle, e),
    ergebnis: null,
  }

  const index = kerzen ? einstiegsIndex(kerzen, e.entryTime) : -1
  if (kerzen && index >= 0) {
    const bis = kerzen.slice(0, index + 1)
    fakten.kerzen = { intervall: intervall ?? '?', vorEinstieg: index + 1, nachEinstieg: kerzen.length - index - 1 }
    const treffer = setupVorEinstieg(bis, index)
    if (treffer) {
      const s = treffer.setup
      fakten.erkanntesSetup = {
        name: strategieName(s.strategieId),
        richtung: s.richtung,
        signalVorKerzen: treffer.abstand,
        zoneVon: s.entryZone.preisVon,
        zoneBis: s.entryZone.preisBis,
        idealEinstieg: s.idealEntry,
        idealStop: s.idealStopLoss,
        idealZiel: s.idealTakeProfit,
        merkmale: s.merkmale,
      }
      fakten.einstiegInZone = e.entryPreis >= Math.min(s.entryZone.preisVon, s.entryZone.preisBis) && e.entryPreis <= Math.max(s.entryZone.preisVon, s.entryZone.preisBis)
    }
    const t = trendAus(bis, index)
    if (t) {
      fakten.trend = t.trend
      fakten.emaLage = t.lage
    }
    const r = rsi(bis, 14)[index]
    if (Number.isFinite(r)) fakten.rsi14 = rund(r, 0)
    const atr = letzterAtr(bis, index, 14)
    if (atr > 0) {
      fakten.atr = rund(atr, 4)
      if (e.stopLoss > 0) fakten.stopInAtr = rund(Math.abs(e.entryPreis - e.stopLoss) / atr)
      if (e.takeProfit > 0) fakten.zielInAtr = rund(Math.abs(e.takeProfit - e.entryPreis) / atr)
    }
    const swing = swingVorEinstieg(bis, index, e.richtung)
    if (swing !== null && e.stopLoss > 0) fakten.struktur = { preis: swing, stopDahinter: e.richtung === 'long' ? e.stopLoss < swing : e.stopLoss > swing }
  }

  if (mitErgebnis && e.status === 'geschlossen') {
    const ex = kerzen && index >= 0 ? exkursion(kerzen, index, e) : null
    const r = rMultiple(e)
    fakten.ergebnis = {
      r: r === null ? null : rund(r),
      exitGrund: e.exitGrund ?? null,
      ausstiegAm: e.exitTime ? zeitText(e.exitTime) : null,
      mfeR: ex?.mfeR ?? null,
      maeR: ex?.maeR ?? null,
      kerzenGehalten: ex?.kerzen ?? null,
    }
  }
  return fakten
}
