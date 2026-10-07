import type { Candle, ExitGrund, Order, Richtung, Scenario, SzenarioBewertung, Trade } from '../types'
import { fmtR, preisStellen } from './format'

// Gemeinsame Bewertung aller geführten Übungen. Zone, Zeitfenster, Trigger,
// Stop-Regel und Ideal-Trade kommen ausschließlich aus der Szenario-Config
// (content/szenarien); Aufgabentext und Feedback nutzen dieselben Werte über
// Platzhalter ({zone}, {fenster}, {trigger}).
//
// Jedes Kriterium wird einzeln mit ok / warnung / fehler bewertet und liefert
// einen eigenen Satz mit Zahlen. Die Struktur (`kriterien`) ist so gebaut, dass
// später optional ein LLM daraus Fließtext formulieren kann — die Bewertung
// selbst bleibt regelbasiert.

/** Zentrale Standardwerte aus dem Lernpfad (Level 5): CRV ≥ 1,5; 1 % Toleranz um die Entry-Zone;
 *  Auto-Pause 0,5 % vor der Zone; „verpasst“ erst ab 2 erreichbaren Kerzen. */
export const KRITERIEN = { minCrv: 1.5, toleranz: 0.01, pauseAbstand: 0.005, minErreichbareKerzen: 2 } as const

/** Rang für „bester Versuch“ (Lernpfad-Anzeige, Import, Git-Sync). */
export const BEWERTUNG_RANG: Record<SzenarioBewertung, number> = { falsch: 0, verpasst: 1, ok: 2, gut: 3, perfekt: 4 }

/** Liefert das bessere von zwei Ergebnissen; bei gleichem Rang das neue (aktuelleres R). */
export function besseresErgebnis<T extends { bewertung: SzenarioBewertung }>(alt: T | undefined, neu: T): T {
  if (!alt) return neu
  return BEWERTUNG_RANG[neu.bewertung] >= BEWERTUNG_RANG[alt.bewertung] ? neu : alt
}

export type KriteriumStatus = 'ok' | 'warnung' | 'fehler'
export type KriteriumId = 'richtung' | 'trigger' | 'entryZeit' | 'entryPreis' | 'stop' | 'crv'

export interface KriteriumErgebnis {
  id: KriteriumId
  titel: string
  status: KriteriumStatus
  /** Was verlangt war (für die Tabelle) */
  soll: string
  /** Was der Trade tatsächlich hatte */
  ist: string
  /** Feedback-Satz mit konkreten Zahlen */
  text: string
}

/** Welche einzelne Bedingung die Bewertung bestimmt hat (erster Fehler, sonst erste Warnung). */
export type PruefGrund =
  | 'keinTrade' // weder Trade noch Order
  | 'nurLimit' // kein Trade, aber die Zone war nur in einer einzelnen Kerze erreichbar — fair
  | 'orderNichtGefuellt' // Order platziert, aber der Kurs hat sie nie erreicht
  | 'richtung'
  | 'trigger'
  | 'zuFrueh'
  | 'zuSpaet'
  | 'preiszone'
  | 'stopSeite'
  | 'stopRegel'
  | 'crv'
  | 'alleKriterien'
  | 'keinTradeRichtig' // Kein-Trade-Szenario: richtig abgewartet
  | 'alternativRichtung' // Kein-Trade-Szenario: tolerierte Richtung gehandelt
  | 'tradeStattWarten' // Kein-Trade-Szenario: trotzdem gehandelt

/** Was der Checker tatsächlich verwendet hat — für Tests und Logging. */
export interface PruefDetails {
  erwarteteRichtung: Richtung | 'keiner'
  zone?: NonNullable<Scenario['entryZone']>
  triggerBar?: number
  richtung?: Richtung
  entryPreis?: number
  entryIndex?: number
  entryTime?: number
  stopLoss?: number
  takeProfit?: number
  crv?: number
  orderTyp?: Order['typ']
  orderPreis?: number
}

/** Der Ideal-Trade des Szenarios, an den Kerzen durchgespielt (Entry als Limit ab dem Trigger). */
export interface IdealTrade {
  entryIndex: number
  entryTime: number
  entry: number
  stopLoss: number
  takeProfit: number
  exitIndex: number | null
  exitTime: number | null
  exitGrund: 'sl' | 'tp' | 'offen'
  crv: number
}

export interface Bilanz {
  /** Prozess-Urteil als Wort: perfekt / gut / fehlerhaft / kein Trade */
  prozess: string
  /** Ergebnis in R plus Exit-Grund, leer ohne Trade */
  ergebnis: string
  /** Pech/Glück-Einordnung von Prozess gegen Ergebnis */
  fazit: string
}

export interface SzenarioResultat {
  /** Prozess-Bewertung: perfekt · gut · falsch · verpasst */
  bewertung: SzenarioBewertung
  /** Lehrtext des Szenarios zum Ergebnis (Platzhalter gefüllt) */
  text: string
  rMultiple: number
  grund: PruefGrund
  details: PruefDetails
  kriterien: KriteriumErgebnis[]
  bilanz: Bilanz
  ideal: IdealTrade | null
}

// ── Formatierung (Zahlen und Daten aus den Kerzen, UTC wie die Chart-Achse) ──

function preis(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: preisStellen(n) })
}

function prozent(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

function zwei(n: number): string {
  return String(n).padStart(2, '0')
}

export function datumText(time: number): string {
  const d = new Date(time * 1000)
  return `${zwei(d.getUTCDate())}.${zwei(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
}

export function datumZeitText(time: number): string {
  const d = new Date(time * 1000)
  return `${datumText(time)}, ${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}`
}

export function zoneText(szenario: Scenario): string {
  const z = szenario.entryZone
  return z ? `${preis(z.preisVon)}–${preis(z.preisBis)} $` : ''
}

/** Zeitraum des Entry-Fensters aus den Kerzendaten, z.B. „22.02.2024–26.02.2024“. */
export function fensterText(szenario: Scenario, candles: Candle[]): string {
  const z = szenario.entryZone
  if (!z) return ''
  const von = candles[z.barVon]
  const bis = candles[z.barBis]
  if (!von || !bis) return ''
  const a = datumText(von.time)
  const b = datumText(bis.time)
  return a === b ? a : `${a}–${b}`
}

/** Zeitpunkt des Triggers aus den Kerzendaten. */
export function triggerText(szenario: Scenario, candles: Candle[]): string {
  const t = szenario.kriterien?.trigger
  const kerze = t ? candles[t.bar] : undefined
  return kerze ? datumZeitText(kerze.time) : ''
}

/** Platzhalter in Aufgaben-/Feedback-Texten füllen: {zone}, {fenster}, {trigger}. */
export function textFuellen(text: string, szenario: Scenario, candles: Candle[] = []): string {
  return text
    .replaceAll('{zone}', zoneText(szenario))
    .replaceAll('{fenster}', fensterText(szenario, candles))
    .replaceAll('{trigger}', triggerText(szenario, candles))
}

const richtungWort = (r: Richtung) => (r === 'long' ? 'Long' : 'Short')

const EXIT_TEXT: Record<ExitGrund, string> = {
  sl: 'Stop getroffen',
  tp: 'Ziel erreicht',
  manuell: 'manuell geschlossen',
  szenarioEnde: 'am Ende glattgestellt',
  teil: 'Teilverkauf',
  trailing: 'Trailing-Stop',
}

/** Index der Hauptkerze, die den Zeitpunkt enthält (Fills kommen aus Unterkerzen); −1 vor der ersten Kerze. */
export function kerzenIndex(candles: Candle[], zeit: number): number {
  if (candles.length === 0 || zeit < candles[0].time) return -1
  let lo = 0
  let hi = candles.length - 1
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1
    if (candles[m].time <= zeit) lo = m
    else hi = m - 1
  }
  return lo
}

/** Gesamt-R des ersten Einstiegs (Teilverkäufe desselben Entries werden addiert). */
function gesamtR(trades: Trade[]): number {
  const erster = trades[0]
  if (!erster) return 0
  return trades
    .filter((t) => t.entryTime === erster.entryTime && t.richtung === erster.richtung)
    .reduce((s, t) => s + t.rMultiple, 0)
}

/** Wie weit kam der Kurs nach dem Platzieren an eine nie gefüllte Order heran? */
function orderNichtGefuelltText(order: Order, candles: Candle[]): string {
  const level = order.limitPreis ?? 0
  const typ = order.typ === 'stop' ? 'Stop' : 'Limit'
  const nach = candles.slice(order.erstelltBarIndex + 1)
  const platziert = candles[order.erstelltBarIndex]
  // Long-Limit und Short-Stop warten auf fallende Kurse, die beiden anderen auf steigende
  const wartetAufFallen = order.richtung === 'long' ? order.typ !== 'stop' : order.typ === 'stop'
  const extrem = nach.length
    ? wartetAufFallen
      ? Math.min(...nach.map((c) => c.low))
      : Math.max(...nach.map((c) => c.high))
    : undefined
  const wann = platziert ? ` (${datumZeitText(platziert.time)})` : ''
  const bisWohin =
    extrem !== undefined
      ? ` Nach dem Platzieren${wann} ${wartetAufFallen ? 'fiel' : 'stieg'} der Kurs nur bis ${preis(extrem)} $.`
      : ''
  return `Deine ${typ}-Order bei ${preis(level)} $ wurde nie gefüllt.${bisWohin}`
}

/**
 * Ideal-Trade des Szenarios an den Kerzen durchspielen: Entry als Limit an der
 * ersten Kerze ab Trigger bzw. Fensterbeginn, die den Ideal-Entry berührt; danach
 * SL-zuerst-Regel wie im Broker. Liefert null, wenn der Entry nie berührt wird.
 */
export function idealTrade(szenario: Scenario, candles: Candle[]): IdealTrade | null {
  const z = szenario.entryZone
  const entry = szenario.idealEntry
  const stopLoss = szenario.idealStopLoss
  const takeProfit = szenario.idealTakeProfit
  if (!z || szenario.richtung === 'keiner' || !entry || !stopLoss || !takeProfit) return null
  const long = szenario.richtung === 'long'
  const ab = Math.max(z.barVon, szenario.kriterien?.trigger?.bar ?? 0)
  let entryIndex = -1
  for (let i = ab; i <= Math.min(z.barBis, candles.length - 1); i++) {
    if (candles[i].low <= entry && candles[i].high >= entry) {
      entryIndex = i
      break
    }
  }
  if (entryIndex < 0) return null
  let exitIndex: number | null = null
  let exitGrund: IdealTrade['exitGrund'] = 'offen'
  for (let i = entryIndex + 1; i < candles.length; i++) {
    const k = candles[i]
    if (long ? k.low <= stopLoss : k.high >= stopLoss) {
      exitIndex = i
      exitGrund = 'sl'
      break
    }
    if (long ? k.high >= takeProfit : k.low <= takeProfit) {
      exitIndex = i
      exitGrund = 'tp'
      break
    }
  }
  return {
    entryIndex,
    entryTime: candles[entryIndex].time,
    entry,
    stopLoss,
    takeProfit,
    exitIndex,
    exitTime: exitIndex === null ? null : candles[exitIndex].time,
    exitGrund,
    crv: Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss),
  }
}

/**
 * Kerzenindizes im Entry-Fenster (ab Trigger), deren Spanne die Preiszone berührt —
 * also die Kerzen, in denen ein Entry in der Zone überhaupt möglich war.
 */
export function erreichbareKerzen(szenario: Scenario, candles: Candle[]): number[] {
  const z = szenario.entryZone
  if (!z) return []
  const ab = Math.max(z.barVon, szenario.kriterien?.trigger?.bar ?? 0)
  const out: number[] = []
  for (let i = ab; i <= Math.min(z.barBis, candles.length - 1); i++) {
    if (candles[i].low <= z.preisBis && candles[i].high >= z.preisVon) out.push(i)
  }
  return out
}

/** Prozess-Wort und Pech/Glück-Einordnung. */
function bilanzAus(bewertung: SzenarioBewertung, trade: Trade | undefined, r: number): Bilanz {
  if (!trade) return { prozess: 'kein Trade', ergebnis: '', fazit: '' }
  const prozess =
    bewertung === 'perfekt' ? 'perfekt' : bewertung === 'gut' || bewertung === 'ok' ? 'gut' : bewertung === 'falsch' ? 'fehlerhaft' : 'kein Trade'
  const ergebnis = `${fmtR(r)} (${EXIT_TEXT[trade.exitGrund]})`
  const gut = bewertung === 'perfekt' || bewertung === 'gut' || bewertung === 'ok'
  let fazit: string
  if (gut && r < 0) {
    fazit = 'Richtig gehandelt, Pech gehabt: Ein sauberer Prozess verliert auch mal — über viele Trades zahlt er sich aus.'
  } else if (gut) {
    fazit = 'Prozess und Ergebnis passen zusammen.'
  } else if (r > 0) {
    fazit = 'Glück gehabt: Der Gewinn kam trotz des Prozessfehlers, nicht wegen deiner Regel — so etwas wiederholt sich nicht zuverlässig.'
  } else {
    fazit = 'Prozessfehler und Verlust: genau das soll die Regel verhindern.'
  }
  return { prozess, ergebnis, fazit }
}

/**
 * Bewertet eine abgeschlossene geführte Übung anhand des ERSTEN Einstiegs.
 *
 * Setup-Szenario (richtung long/short), Kriterien je ok / warnung / fehler:
 *  - Richtung       fehler bei Gegenrichtung
 *  - Trigger        fehler, wenn der Entry vor dem Trigger-Ereignis lag
 *  - Entry-Zeit     warnung außerhalb des Fensters (zu früh / zu spät)
 *  - Entry-Preis    warnung außerhalb Zone + Toleranz (mit CRV-Folge gegen den Ideal-Entry)
 *  - Stop           fehler auf der falschen Seite, warnung bei verletzter Stop-Regel
 *  - CRV            warnung unter minCrv oder ohne Ziel
 *  Gesamt: ein Fehler → falsch · nur Warnungen → gut · alles ok → perfekt ·
 *  kein Trade / Order nie gefüllt → verpasst.
 *
 * Kein-Trade-Szenario (richtung 'keiner'):
 *  - kein Trade → perfekt · Trade in alternativRichtung → gut · sonst falsch
 */
export function bewerteSzenario(
  szenario: Scenario,
  candles: Candle[],
  trades: Trade[],
  offeneOrder: Order | null = null,
): SzenarioResultat {
  const trade = trades[0]
  const r = gesamtR(trades)
  const fb = szenario.feedback
  const krit = szenario.kriterien ?? {}
  const fuellen = (t: string) => textFuellen(t, szenario, candles)
  const ideal = idealTrade(szenario, candles)
  const details: PruefDetails = {
    erwarteteRichtung: szenario.richtung,
    zone: szenario.entryZone,
    triggerBar: krit.trigger?.bar,
  }
  const res = (
    bewertung: SzenarioBewertung,
    grund: PruefGrund,
    text: string,
    kriterien: KriteriumErgebnis[] = [],
  ): SzenarioResultat => ({
    bewertung,
    grund,
    text,
    rMultiple: trade ? r : 0,
    details,
    kriterien,
    bilanz: bilanzAus(bewertung, trade, r),
    ideal,
  })

  if (trade) {
    details.richtung = trade.richtung
    details.entryPreis = trade.entryPreis
    details.entryTime = trade.entryTime
    details.entryIndex = kerzenIndex(candles, trade.entryTime)
    details.stopLoss = trade.stopLoss
    details.takeProfit = trade.takeProfit
  }

  if (szenario.richtung === 'keiner') {
    if (!trade) return res('perfekt', 'keinTradeRichtig', fuellen(fb.perfekt))
    if (szenario.alternativRichtung && trade.richtung === szenario.alternativRichtung) {
      return res('gut', 'alternativRichtung', fuellen(fb.gut))
    }
    return res('falsch', 'tradeStattWarten', fuellen(fb.falsch), [
      {
        id: 'richtung',
        titel: 'Setup',
        status: 'fehler',
        soll: 'kein Trade',
        ist: richtungWort(trade.richtung),
        text: 'Hier gab es kein regelkonformes Setup — die richtige Antwort war: abwarten.',
      },
    ])
  }

  if (!trade) {
    if (offeneOrder) {
      details.orderTyp = offeneOrder.typ
      details.orderPreis = offeneOrder.limitPreis
      return res('verpasst', 'orderNichtGefuellt', `${orderNichtGefuelltText(offeneOrder, candles)} ${fuellen(fb.verpasst)}`)
    }
    // Fair bleiben: Lief der Kurs nur in einer einzelnen Kerze durch die Zone, konnte
    // niemand per Market reagieren — das ist kein „verpasst“.
    const erreichbar = erreichbareKerzen(szenario, candles)
    const minKerzen = krit.minErreichbareKerzen ?? KRITERIEN.minErreichbareKerzen
    if (erreichbar.length > 0 && erreichbar.length < minKerzen) {
      const wann = erreichbar.map((i) => datumZeitText(candles[i].time)).join(', ')
      const anzahl = erreichbar.length === 1 ? 'eine einzige Kerze' : `nur ${erreichbar.length} Kerzen`
      return res(
        'gut',
        'nurLimit',
        `Kein Entry — und das geht in Ordnung: ${anzahl} (${wann}) hat die Entry-Zone (${zoneText(szenario)}) durchlaufen. Hier hätte nur eine vorab platzierte Limit-Order gegriffen. Beim nächsten Mal: sobald der Trigger erfüllt ist, die Limit-Order in die Zone legen und den Markt kommen lassen.`,
      )
    }
    return res('verpasst', 'keinTrade', fuellen(fb.verpasst))
  }

  const long = szenario.richtung === 'long'
  const zone = szenario.entryZone
  const entryIndex = details.entryIndex ?? -1
  const wann = datumZeitText(trade.entryTime)
  const kriterien: KriteriumErgebnis[] = []

  // 1. Richtung
  const richtungOk = trade.richtung === szenario.richtung
  kriterien.push({
    id: 'richtung',
    titel: 'Richtung',
    status: richtungOk ? 'ok' : 'fehler',
    soll: richtungWort(szenario.richtung),
    ist: richtungWort(trade.richtung),
    text: richtungOk
      ? `Richtung stimmt: ${richtungWort(trade.richtung)}.`
      : `Falsche Richtung: Du bist ${richtungWort(trade.richtung)} gegangen, das Setup verlangte ${richtungWort(szenario.richtung)}.`,
  })

  // 2. Trigger (Ereignis, das abgewartet werden muss)
  let triggerFehler = false
  const trigger = krit.trigger
  const triggerKerze = trigger ? candles[trigger.bar] : undefined
  if (trigger && triggerKerze && entryIndex >= 0) {
    const triggerWann = datumZeitText(triggerKerze.time)
    const abgewartet = entryIndex >= trigger.bar
    triggerFehler = !abgewartet
    kriterien.push({
      id: 'trigger',
      titel: 'Trigger',
      status: abgewartet ? 'ok' : 'fehler',
      soll: `${trigger.beschreibung} — ab ${triggerWann}`,
      ist: `Entry ${wann}`,
      text: abgewartet
        ? `Trigger abgewartet: ${trigger.beschreibung} (${triggerWann}), dein Entry kam danach (${wann}).`
        : `Trigger nicht abgewartet: ${trigger.beschreibung} kam erst am ${triggerWann}, dein Entry war schon am ${wann} — ${trigger.bar - entryIndex} Kerzen zu früh.`,
    })
  }

  // 3. Entry-Zeit (Fenster)
  let zeitGrund: PruefGrund | null = null
  if (zone && entryIndex >= 0) {
    const fenster = fensterText(szenario, candles)
    if (entryIndex < zone.barVon) {
      zeitGrund = 'zuFrueh'
      kriterien.push({
        id: 'entryZeit',
        titel: 'Entry-Zeit',
        status: triggerFehler ? 'fehler' : 'warnung',
        soll: fenster,
        ist: wann,
        text: `Zu früh: Dein Entry am ${wann} lag vor dem Entry-Fenster (${fenster}).`,
      })
    } else if (entryIndex > zone.barBis) {
      zeitGrund = 'zuSpaet'
      kriterien.push({
        id: 'entryZeit',
        titel: 'Entry-Zeit',
        status: 'warnung',
        soll: fenster,
        ist: wann,
        text: `Zu spät: Dein Entry am ${wann} lag nach dem Entry-Fenster (${fenster}). Die Gelegenheit war da schon vorbei.`,
      })
    } else {
      kriterien.push({ id: 'entryZeit', titel: 'Entry-Zeit', status: 'ok', soll: fenster, ist: wann, text: `Entry im Fenster (${fenster}).` })
    }
  }

  // 4. Entry-Preis (Zone + Toleranz, mit CRV-Folge gegen den Ideal-Entry)
  const risiko = Math.abs(trade.entryPreis - trade.stopLoss)
  const chance = Math.abs(trade.takeProfit - trade.entryPreis)
  const crv = risiko > 0 && trade.takeProfit > 0 ? chance / risiko : 0
  details.crv = crv
  if (zone) {
    const ueber = trade.entryPreis > zone.preisBis
    const unter = trade.entryPreis < zone.preisVon
    const kante = ueber ? zone.preisBis : zone.preisVon
    const abstand = ueber ? trade.entryPreis - zone.preisBis : unter ? zone.preisVon - trade.entryPreis : 0
    const anteil = kante > 0 ? abstand / kante : 0
    const toleranz = krit.toleranz ?? KRITERIEN.toleranz
    const lage = `${preis(abstand)} $ (${prozent(anteil * 100)} %) ${ueber ? 'über' : 'unter'} der Zone`
    if (!ueber && !unter) {
      kriterien.push({ id: 'entryPreis', titel: 'Entry-Preis', status: 'ok', soll: zoneText(szenario), ist: `${preis(trade.entryPreis)} $`, text: `Entry in der Zone: ${preis(trade.entryPreis)} $.` })
    } else if (anteil <= toleranz) {
      kriterien.push({
        id: 'entryPreis',
        titel: 'Entry-Preis',
        status: 'ok',
        soll: zoneText(szenario),
        ist: `${preis(trade.entryPreis)} $`,
        text: `Entry knapp außerhalb der Zone — ${lage}, innerhalb der Toleranz von ${prozent(toleranz * 100)} %.`,
      })
    } else {
      // CRV, das derselbe SL/TP am Ideal-Entry ergeben hätte
      const idealEntry = szenario.idealEntry
      const idealRisiko = idealEntry ? Math.abs(idealEntry - trade.stopLoss) : 0
      const crvIdeal = idealEntry && idealRisiko > 0 && trade.takeProfit > 0 ? Math.abs(trade.takeProfit - idealEntry) / idealRisiko : 0
      const folge =
        crv > 0 && crvIdeal > 0
          ? ` — dadurch CRV ${crv.toLocaleString('de-DE', { maximumFractionDigits: 1 })} statt ~${crvIdeal.toLocaleString('de-DE', { maximumFractionDigits: 1 })} am Ideal-Entry (${preis(idealEntry!)} $).`
          : '.'
      kriterien.push({
        id: 'entryPreis',
        titel: 'Entry-Preis',
        status: 'warnung',
        soll: zoneText(szenario),
        ist: `${preis(trade.entryPreis)} $`,
        text: `Entry ${lage} (${zoneText(szenario)})${folge}`,
      })
    }
  }

  // 5. Stop: richtige Seite (Pflicht), Stop-Regel (jenseits des Struktur-Levels)
  const slRichtig = long ? trade.stopLoss < trade.entryPreis : trade.stopLoss > trade.entryPreis
  const regel = krit.stopRegel
  const regelOk = !regel || (long ? trade.stopLoss < regel.level : trade.stopLoss > regel.level)
  const seite = long ? 'unter' : 'über'
  kriterien.push({
    id: 'stop',
    titel: 'Stop',
    status: !slRichtig ? 'fehler' : regelOk ? 'ok' : 'warnung',
    soll: regel ? `${regel.beschreibung} (${seite} ${preis(regel.level)} $)` : `${seite} dem Entry`,
    ist: `${preis(trade.stopLoss)} $`,
    text: !slRichtig
      ? `Stop auf der falschen Seite: SL ${preis(trade.stopLoss)} $ liegt ${long ? 'über' : 'unter'} deinem Entry (${preis(trade.entryPreis)} $).`
      : regelOk
        ? regel
          ? `Stop richtig: ${preis(trade.stopLoss)} $ liegt ${regel.beschreibung} (${preis(regel.level)} $).`
          : `Stop ${seite} dem Entry: ${preis(trade.stopLoss)} $.`
        : `Stop ohne Struktur: SL ${preis(trade.stopLoss)} $ liegt ${long ? 'über' : 'unter'} ${preis(regel!.level)} $ (${regel!.beschreibung}) — ein normaler Docht holt ihn, bevor das Setup widerlegt ist.`,
  })

  // 6. CRV
  const minCrv = krit.minCrv ?? KRITERIEN.minCrv
  const minText = minCrv.toLocaleString('de-DE')
  const crvText = crv.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  kriterien.push({
    id: 'crv',
    titel: 'CRV',
    status: trade.takeProfit <= 0 || crv < minCrv ? 'warnung' : 'ok',
    soll: `≥ ${minText}`,
    ist: trade.takeProfit > 0 ? crvText : 'kein Ziel',
    text:
      trade.takeProfit <= 0
        ? `Kein Take-Profit gesetzt — ohne Ziel lässt sich kein CRV (mindestens ${minText}) prüfen.`
        : crv < minCrv
          ? `CRV ${crvText} statt mindestens ${minText}: Risiko ${preis(risiko)} $ (Entry ${preis(trade.entryPreis)} → SL ${preis(trade.stopLoss)}) gegen Chance ${preis(chance)} $ (→ TP ${preis(trade.takeProfit)}).`
          : `CRV ${crvText}: Risiko ${preis(risiko)} $ gegen Chance ${preis(chance)} $.`,
  })

  // Gesamt: ein Fehler → falsch, eine Warnung → gut, sonst perfekt
  const grundVon = (k: KriteriumErgebnis): PruefGrund => {
    switch (k.id) {
      case 'richtung':
        return 'richtung'
      case 'trigger':
        return 'trigger'
      case 'entryZeit':
        return zeitGrund ?? 'zuFrueh'
      case 'entryPreis':
        return 'preiszone'
      case 'stop':
        return k.status === 'fehler' ? 'stopSeite' : 'stopRegel'
      case 'crv':
        return 'crv'
    }
  }
  const fehler = kriterien.find((k) => k.status === 'fehler')
  if (fehler) {
    const lehrtext = fehler.id === 'richtung' ? (fb.falscheRichtung ?? fb.falsch) : fb.falsch
    return res('falsch', grundVon(fehler), fuellen(lehrtext), kriterien)
  }
  const warnung = kriterien.find((k) => k.status === 'warnung')
  if (warnung) return res('gut', grundVon(warnung), fuellen(fb.gut), kriterien)
  return res('perfekt', 'alleKriterien', fuellen(fb.perfekt), kriterien)
}
