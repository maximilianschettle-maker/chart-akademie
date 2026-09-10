import type { ExitGrund, Richtung, Trade } from '../types'

// Journal-Auswertung: Trades zu „logischen Trades“ (ein Einstieg = ein Trade,
// Teil-Exits addiert) zusammenfassen, nach Dimensionen gruppieren und
// regelbasiert typische Fehler-Muster erkennen.

export interface LogischerTrade {
  key: string
  session: string
  richtung: Richtung
  entryPreis: number
  entryTime: number
  exitTime: number
  pnl: number
  rMultiple: number
  /** Geplantes Chance-Risiko-Verhältnis beim ersten Exit (SL/TP der Position) */
  geplantesCrv: number
  /** Risiko-Abstand relativ zum Entry (|Entry − SL| / Entry) */
  risikoProzent: number
  exitGrund: ExitGrund
  strategieId?: string
  interval?: string
  teilExits: number
}

const INTERVALL_SEK: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1D': 86400,
}

/** Session-Präfix aus der Trade-Id (Simulator: `<session>:<entry>-<exit>`). */
function sessionVon(t: Trade): string {
  const i = t.id.indexOf(':')
  return i > 0 ? t.id.slice(0, i) : (t.szenarioId ?? 'uebung')
}

export function logischeTrades(trades: Trade[]): LogischerTrade[] {
  const map = new Map<string, LogischerTrade>()
  for (const t of trades) {
    const session = sessionVon(t)
    const key = `${session}|${t.entryTime}|${t.richtung}|${t.entryPreis}`
    const vorhanden = map.get(key)
    if (vorhanden) {
      vorhanden.pnl += t.pnl
      vorhanden.rMultiple += t.rMultiple
      vorhanden.exitTime = Math.max(vorhanden.exitTime, t.exitTime)
      vorhanden.teilExits += 1
      if (t.exitTime >= vorhanden.exitTime) vorhanden.exitGrund = t.exitGrund
      continue
    }
    const risiko = Math.abs(t.entryPreis - t.stopLoss)
    const chance = Math.abs(t.takeProfit - t.entryPreis)
    map.set(key, {
      key,
      session,
      richtung: t.richtung,
      entryPreis: t.entryPreis,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      pnl: t.pnl,
      rMultiple: t.rMultiple,
      geplantesCrv: risiko > 0 ? chance / risiko : 0,
      risikoProzent: t.entryPreis > 0 ? risiko / t.entryPreis : 0,
      exitGrund: t.exitGrund,
      strategieId: t.strategieId,
      interval: t.interval,
      teilExits: 1,
    })
  }
  return [...map.values()].sort((a, b) => a.entryTime - b.entryTime)
}

// ── Equity-Kurve ─────────────────────────────────────────────────────────────

export interface EquityPunkt {
  index: number
  kontostand: number
  trade: LogischerTrade | null
}

/** Kontostand nach jedem logischen Trade, beginnend beim Startkapital (Reihenfolge = Abschlussreihenfolge). */
export function equityKurve(trades: LogischerTrade[], startKapital: number): EquityPunkt[] {
  const punkte: EquityPunkt[] = [{ index: 0, kontostand: startKapital, trade: null }]
  let stand = startKapital
  for (const [i, t] of trades.entries()) {
    stand += t.pnl
    punkte.push({ index: i + 1, kontostand: stand, trade: t })
  }
  return punkte
}

// ── Gruppierungen ────────────────────────────────────────────────────────────

export interface Gruppe {
  label: string
  anzahl: number
  trefferquote: number
  summePnl: number
  durchschnittR: number
  summeR: number
}

export function gruppiere(trades: LogischerTrade[], schluessel: (t: LogischerTrade) => string): Gruppe[] {
  const map = new Map<string, LogischerTrade[]>()
  for (const t of trades) {
    const k = schluessel(t)
    const liste = map.get(k)
    if (liste) liste.push(t)
    else map.set(k, [t])
  }
  return [...map.entries()].map(([label, liste]) => {
    const gewinner = liste.filter((t) => t.pnl > 0).length
    const summeR = liste.reduce((s, t) => s + t.rMultiple, 0)
    return {
      label,
      anzahl: liste.length,
      trefferquote: (gewinner / liste.length) * 100,
      summePnl: liste.reduce((s, t) => s + t.pnl, 0),
      durchschnittR: summeR / liste.length,
      summeR,
    }
  })
}

export const TAGESZEIT_LABELS = ['Asien (00–08 UTC)', 'Europa (08–14 UTC)', 'US (14–22 UTC)', 'Spät (22–24 UTC)']

export function tageszeit(t: LogischerTrade): string {
  const stunde = new Date(t.entryTime * 1000).getUTCHours()
  if (stunde < 8) return TAGESZEIT_LABELS[0]
  if (stunde < 14) return TAGESZEIT_LABELS[1]
  if (stunde < 22) return TAGESZEIT_LABELS[2]
  return TAGESZEIT_LABELS[3]
}

export const HALTEDAUER_LABELS = ['≤ 3 Kerzen', '4–10 Kerzen', '11–30 Kerzen', '> 30 Kerzen', 'unbekannt']

export function haltedauerBars(t: LogischerTrade): number | null {
  const sek = t.interval ? INTERVALL_SEK[t.interval] : undefined
  if (!sek) return null
  return Math.max(1, Math.round((t.exitTime - t.entryTime) / sek))
}

export function haltedauer(t: LogischerTrade): string {
  const bars = haltedauerBars(t)
  if (bars === null) return HALTEDAUER_LABELS[4]
  if (bars <= 3) return HALTEDAUER_LABELS[0]
  if (bars <= 10) return HALTEDAUER_LABELS[1]
  if (bars <= 30) return HALTEDAUER_LABELS[2]
  return HALTEDAUER_LABELS[3]
}

// ── R-Verteilung ─────────────────────────────────────────────────────────────

export interface RBin {
  label: string
  von: number
  bis: number
  anzahl: number
}

const R_GRENZEN = [-Infinity, -1, -0.5, 0, 0.5, 1, 2, 3, Infinity]

export function rVerteilung(trades: LogischerTrade[]): RBin[] {
  const bins: RBin[] = []
  for (let i = 0; i < R_GRENZEN.length - 1; i++) {
    const von = R_GRENZEN[i]
    const bis = R_GRENZEN[i + 1]
    const label = von === -Infinity ? '< −1R' : bis === Infinity ? '≥ 3R' : `${fmtR(von)}…${fmtR(bis)}`
    bins.push({ label, von, bis, anzahl: 0 })
  }
  for (const t of trades) {
    const bin = bins.find((b) => t.rMultiple >= b.von && t.rMultiple < b.bis)
    if (bin) bin.anzahl++
  }
  return bins
}

function fmtR(r: number): string {
  return `${r < 0 ? '−' : ''}${Math.abs(r).toLocaleString('de-DE')}`
}

// ── Fehler-Muster ────────────────────────────────────────────────────────────

export interface Hinweis {
  id: string
  titel: string
  text: string
  betroffen: number
  schwere: 'info' | 'warnung'
}

const ENGER_STOP = 0.004 // < 0,4 % Abstand — bei Krypto-Intraday meist Rauschen
const MIN_CRV = 1.5

export function fehlerMuster(trades: LogischerTrade[]): Hinweis[] {
  const hinweise: Hinweis[] = []
  if (trades.length < 3) return hinweise

  const slExits = trades.filter((t) => t.exitGrund === 'sl' || t.exitGrund === 'trailing')
  const enge = slExits.filter((t) => t.risikoProzent < ENGER_STOP)
  if (enge.length >= 3 && enge.length / Math.max(1, slExits.length) >= 0.5) {
    hinweise.push({
      id: 'stop-zu-eng',
      titel: 'Stop zu eng',
      text: `${enge.length} deiner Stop-Ausführungen hatten weniger als 0,4 % Abstand zum Entry. So nah am Kurs erwischt dich normales Rauschen. Lektion 2.3: Der Stop gehört an die Stelle, an der die Trade-Idee widerlegt ist — nicht dorthin, wo der Verlust „klein genug“ aussieht. Lieber weiter weg und kleinere Position (Position Sizing).`,
      betroffen: enge.length,
      schwere: 'warnung',
    })
  }

  const zuFrueh = trades.filter(
    (t) => t.exitGrund === 'manuell' && t.rMultiple > 0 && t.rMultiple < 0.5 && t.geplantesCrv >= MIN_CRV,
  )
  if (zuFrueh.length >= 2) {
    hinweise.push({
      id: 'zu-frueh-raus',
      titel: 'Zu früh raus',
      text: `${zuFrueh.length}× hast du einen Trade mit geplantem CRV ≥ 1,5 manuell unter +0,5R geschlossen. Das kappt genau die Gewinner, die deine Verlierer bezahlen sollen. Wenn du Gewinne sichern willst: Teilverkauf oder Break-even statt Komplett-Exit (Lektion 2.4).`,
      betroffen: zuFrueh.length,
      schwere: 'warnung',
    })
  }

  let rache = 0
  const sortiert = [...trades].sort((a, b) => a.entryTime - b.entryTime)
  for (let i = 1; i < sortiert.length; i++) {
    const vorher = sortiert[i - 1]
    const jetzt = sortiert[i]
    if (vorher.session !== jetzt.session || vorher.pnl >= 0) continue
    const sek = jetzt.interval ? INTERVALL_SEK[jetzt.interval] : undefined
    if (!sek) continue
    if (jetzt.entryTime - vorher.exitTime <= 2 * sek) rache++
  }
  if (rache >= 2) {
    hinweise.push({
      id: 'uebertraden-nach-verlust',
      titel: 'Übertraden nach Verlust',
      text: `${rache}× bist du innerhalb von zwei Kerzen nach einem Verlust wieder eingestiegen. Das ist das Muster „Revenge Trading“ aus Lektion 2.4: Der neue Trade soll den alten reparieren — er hat aber selten ein eigenes Setup. Regel: Nach einem Verlust mindestens fünf Kerzen nur beobachten.`,
      betroffen: rache,
      schwere: 'warnung',
    })
  }

  const crvKlein = trades.filter((t) => t.geplantesCrv < MIN_CRV)
  if (crvKlein.length >= 3 && crvKlein.length / trades.length >= 0.3) {
    hinweise.push({
      id: 'crv-zu-klein',
      titel: 'CRV unter 1,5',
      text: `${crvKlein.length} von ${trades.length} Trades hatten ein geplantes CRV unter 1,5. Bei 50 % Trefferquote brauchst du mindestens 1,5, damit Gebühren und Slippage nicht die ganze Kante fressen. Prüfe vor dem Entry: Wo ist das Ziel, wo der Stop — lohnt sich das überhaupt?`,
      betroffen: crvKlein.length,
      schwere: 'warnung',
    })
  }

  if (trades.length >= 8) {
    const longs = trades.filter((t) => t.richtung === 'long').length
    const anteil = longs / trades.length
    if (anteil >= 0.85 || anteil <= 0.15) {
      hinweise.push({
        id: 'richtungs-bias',
        titel: anteil >= 0.85 ? 'Fast nur Long' : 'Fast nur Short',
        text: `${Math.round(Math.max(anteil, 1 - anteil) * 100)} % deiner Trades gehen in dieselbe Richtung. Kann Absicht sein (Trend-Bias) — oder ein blinder Fleck. Frag dich beim nächsten Setup bewusst: Würde ich hier auch die Gegenrichtung sehen?`,
        betroffen: Math.max(longs, trades.length - longs),
        schwere: 'info',
      })
    }
  }

  const ohneTag = trades.filter((t) => !t.strategieId).length
  if (ohneTag >= 5 && ohneTag / trades.length >= 0.5) {
    hinweise.push({
      id: 'ohne-tag',
      titel: 'Setups nicht getaggt',
      text: `${ohneTag} Trades haben kein Setup-Tag. Ohne Tag kannst du nicht sehen, welches deiner Setups Geld verdient und welches nicht — die Auswertung nach Strategie bleibt leer. Der Tag sitzt im Order-Ticket unter „Mehr Optionen“.`,
      betroffen: ohneTag,
      schwere: 'info',
    })
  }

  return hinweise
}
