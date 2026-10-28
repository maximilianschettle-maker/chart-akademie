import type { Candle } from '../../types'
import { ema } from '../../engine/indikatoren/ema'
import { rsi } from '../../engine/indikatoren/rsi'
import { atr } from '../../engine/indikatoren/atr'
import { erkenneImFenster } from '../../engine/setupErkennung'
import { STRATEGIEN } from '../../content/strategien'
import type { Analyse, Ebene, MusterId, Richtung, Signal, Tunnel } from '../types'

// Charttechnische Analyse eines Instruments auf Kerzen einer Zeitebene (Tag oder Stunde).
// Reine Funktionen, ohne Netz. Läuft in der GitHub Action (scripts/tracker/hole-tracker.ts);
// das Frontend zeigt nur das Ergebnis. Die letzte Kerze darf unvollständig sein – Signale
// daraus sind „vorläufig“.

export interface AnalyseOptionen {
  /** Zeitebene – steckt in der Signal-Id */
  ebene: Ebene
  /** Kerzenlänge in Sekunden (Vorläufigkeit, Zeitstempel) */
  intervallSek: number
  /** Einheit für Texte, z.B. „Tage“ oder „Stunden“ */
  einheit: string
  /** Fenster für Hoch/Tief beim Breakout (ohne die aktuelle Kerze) */
  ausbruchTage: number
  tunnelMinTage: number
  tunnelMaxTage: number
  /** Tunnelhöhe höchstens Faktor × ATR 14 */
  tunnelAtrFaktor: number
  /** Randzone des Tunnels als Anteil der Höhe */
  tunnelRand: number
  /** Fenster für das „lange“ Hoch/Tief (52 Wochen auf Tagesebene) */
  langTage: number
  langName: string
}

export const STANDARD_OPTIONEN: AnalyseOptionen = {
  ebene: 'tag',
  intervallSek: 86_400,
  einheit: 'Tage',
  ausbruchTage: 20,
  tunnelMinTage: 15,
  tunnelMaxTage: 60,
  tunnelAtrFaktor: 4,
  tunnelRand: 0.2,
  langTage: 252,
  langName: '52-Wochen',
}

/** Stundenkerzen: gleiche Regeln, Fenster in Stunden; „lang“ = 20 Handelstage */
export const STUNDEN_OPTIONEN: AnalyseOptionen = {
  ...STANDARD_OPTIONEN,
  ebene: 'stunde',
  intervallSek: 3_600,
  einheit: 'Stunden',
  langTage: 140,
  langName: '20-Tage',
}

export function isoDatum(timeSek: number): string {
  return new Date(timeSek * 1000).toISOString().slice(0, 10)
}

function maxHigh(c: Candle[], von: number, bis: number): number {
  let m = Number.NEGATIVE_INFINITY
  for (let i = Math.max(0, von); i <= bis; i++) m = Math.max(m, c[i].high)
  return m
}

function minLow(c: Candle[], von: number, bis: number): number {
  let m = Number.POSITIVE_INFINITY
  for (let i = Math.max(0, von); i <= bis; i++) m = Math.min(m, c[i].low)
  return m
}

function endlich(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/**
 * Tunnel am Index i: längstes Fenster (min..max Tage) bis i, dessen Höhe ≤ Faktor × ATR ist
 * und dessen Ränder jeweils mindestens zweimal berührt wurden.
 */
/** So viele Kerzen ohne Tunnel müssen vergehen, bevor „Tunnel erkannt“ erneut gemeldet wird (Flattern am Fensterrand) */
export const TUNNEL_RUHE = 5

export function findeTunnel(c: Candle[], i: number, atrWert: number, opt: AnalyseOptionen = STANDARD_OPTIONEN): Tunnel | null {
  if (!Number.isFinite(atrWert) || atrWert <= 0) return null
  for (let n = Math.min(opt.tunnelMaxTage, i + 1); n >= opt.tunnelMinTage; n--) {
    const von = i - n + 1
    const hoch = maxHigh(c, von, i)
    const tief = minLow(c, von, i)
    const hoehe = hoch - tief
    if (hoehe <= 0 || hoehe > opt.tunnelAtrFaktor * atrWert) continue
    let obenBeruehrt = 0
    let untenBeruehrt = 0
    for (let k = von; k <= i; k++) {
      if (c[k].high >= hoch - opt.tunnelRand * hoehe) obenBeruehrt++
      if (c[k].low <= tief + opt.tunnelRand * hoehe) untenBeruehrt++
    }
    if (obenBeruehrt < 2 || untenBeruehrt < 2) continue
    const close = c[i].close
    const lage: Tunnel['lage'] = close <= tief + opt.tunnelRand * hoehe ? 'unten' : close >= hoch - opt.tunnelRand * hoehe ? 'oben' : 'mitte'
    return { tief, hoch, seitTagen: n, lage }
  }
  return null
}

export interface AnalyseErgebnis {
  analyse: Analyse
  signale: Signal[]
}

export function analysiere(
  kerzen: Candle[],
  instrumentId: string,
  muster: Record<MusterId, boolean>,
  jetzt: Date,
  kursLive?: { kurs: number; zeit: string },
  opt: AnalyseOptionen = STANDARD_OPTIONEN,
): AnalyseErgebnis | null {
  const n = kerzen.length
  if (n < 25) return null
  const i = n - 1
  const c = kerzen
  const datum = isoDatum(c[i].time)
  const kerzeZeit = new Date(c[i].time * 1000).toISOString()
  // Kerze noch offen, solange ihr Intervall nicht abgelaufen ist
  const vorlaeufig = (c[i].time + opt.intervallSek) * 1000 > jetzt.getTime()

  const ema20 = ema(c, 20)
  const ema50 = ema(c, 50)
  const ema200 = ema(c, 200)
  const rsi14 = rsi(c, 14)
  const atr14 = atr(c, 14)
  const atrI = endlich(atr14[i]) ?? endlich(atr14[i - 1]) ?? 0

  const hoch20 = maxHigh(c, i - opt.ausbruchTage, i - 1)
  const tief20 = minLow(c, i - opt.ausbruchTage, i - 1)
  const hoch52w = maxHigh(c, i - opt.langTage, i - 1)
  const tief52w = minLow(c, i - opt.langTage, i - 1)
  const tunnel = findeTunnel(c, i, atrI, opt)
  const tunnelVorher = findeTunnel(c, i - 1, endlich(atr14[i - 1]) ?? atrI, opt)
  // jüngster Tunnel der letzten TUNNEL_RUHE Kerzen: ein Tunnel, der eine Kerze lang aus dem Raster fällt, gilt nicht als neu
  let tunnelZuletzt = tunnelVorher
  for (let k = i - 2; !tunnelZuletzt && k >= i - TUNNEL_RUHE && k >= 1; k--) tunnelZuletzt = findeTunnel(c, k, endlich(atr14[k]) ?? atrI, opt)

  const e50 = endlich(ema50[i])
  const e200 = endlich(ema200[i])
  const close = c[i].close
  let trend: Analyse['trend'] = 'seitwaerts'
  if (e200 !== null && e50 !== null) {
    if (close > e200 && e50 > e200) trend = 'auf'
    else if (close < e200 && e50 < e200) trend = 'ab'
  } else if (e50 !== null) {
    trend = close > e50 ? 'auf' : 'ab'
  }

  const analyse: Analyse = {
    kurs: kursLive?.kurs ?? close,
    kursZeit: kursLive?.zeit ?? new Date(c[i].time * 1000).toISOString(),
    aenderungTag: c[i - 1].close > 0 ? (kursLive?.kurs ?? close) / c[i - 1].close - 1 : 0,
    hoch20,
    tief20,
    hoch52w,
    tief52w,
    ema20: endlich(ema20[i]),
    ema50: e50,
    ema200: e200,
    rsi14: endlich(rsi14[i]),
    atr14: atrI || null,
    tunnel,
    trend,
    vorlaeufig,
  }

  const signale: Signal[] = []
  const zeit = jetzt.toISOString()
  // Tagesebene behält die alte Id-Form (Dedupe gegen bereits gesendete Pushes)
  const idKerze = opt.ebene === 'tag' ? datum : `${opt.ebene}:${kerzeZeit.slice(0, 13)}`
  const neu = (m: MusterId, richtung: Richtung, titel: string, text: string, preis = close) => {
    signale.push({
      id: `${instrumentId}:${m}:${richtung}:${idKerze}`,
      instrument: instrumentId,
      ebene: opt.ebene,
      muster: m,
      richtung,
      datum,
      kerzeZeit,
      zeit,
      preis,
      titel,
      text,
      ...(vorlaeufig ? { vorlaeufig: true } : {}),
    })
  }
  const pz = (a: number, b: number) => `${(((a - b) / b) * 100).toFixed(1).replace('.', ',')} %`

  // ── Breakout: erster Schluss über dem Hoch / unter dem Tief der letzten N Tage ──
  if (muster.ausbruch && i >= opt.ausbruchTage + 1) {
    const hochVorher = maxHigh(c, i - 1 - opt.ausbruchTage, i - 2)
    const tiefVorher = minLow(c, i - 1 - opt.ausbruchTage, i - 2)
    const fenster = `${opt.ausbruchTage}-${opt.einheit}`
    if (close > hoch20 && c[i - 1].close <= hochVorher) {
      const ath = close > hoch52w
      neu(
        'ausbruch',
        'long',
        ath ? `Breakout auf ${opt.langName}-Hoch` : `Breakout über ${fenster}-Hoch`,
        `Schluss ${pz(close, hoch20)} über dem ${fenster}-Hoch${tunnelVorher ? ` – Ausbruch aus dem Tunnel (${tunnelVorher.seitTagen} ${opt.einheit})` : ''}.`,
      )
    } else if (close < tief20 && c[i - 1].close >= tiefVorher) {
      const atl = close < tief52w
      neu(
        'ausbruch',
        'short',
        atl ? `Bruch auf ${opt.langName}-Tief` : `Bruch unter ${fenster}-Tief`,
        `Schluss ${pz(close, tief20)} unter dem ${fenster}-Tief${tunnelVorher ? ` – Ausbruch aus dem Tunnel nach unten (${tunnelVorher.seitTagen} ${opt.einheit})` : ''}.`,
      )
    }
  }

  // ── Tunnel: neu entstanden oder Rand erreicht ──────────────────────────────
  if (muster.tunnel && tunnel) {
    const spanne = `${fmt(tunnel.tief)}–${fmt(tunnel.hoch)}`
    if (!tunnelZuletzt) {
      neu('tunnel', 'neutral', 'Tunnel erkannt', `Seit ${tunnel.seitTagen} ${opt.einheit} zwischen ${spanne} (Höhe ${pz(tunnel.hoch, tunnel.tief)}).`)
    }
    if (tunnel.lage !== 'mitte' && (!tunnelZuletzt || tunnelZuletzt.lage !== tunnel.lage)) {
      const unten = tunnel.lage === 'unten'
      neu(
        'tunnel',
        unten ? 'long' : 'short',
        unten ? 'Am unteren Tunnelrand' : 'Am oberen Tunnelrand',
        `${unten ? 'Unterkante' : 'Oberkante'} ${fmt(unten ? tunnel.tief : tunnel.hoch)} des Tunnels ${spanne} (seit ${tunnel.seitTagen} ${opt.einheit}) – Bounce oder Ausbruch?`,
      )
    }
  }

  // ── EMA-Kreuzungen ─────────────────────────────────────────────────────────
  if (muster['ema-kreuz']) {
    const kreuz = (schnell: number[], langsam: number[], name: string) => {
      const a0 = endlich(schnell[i - 1])
      const b0 = endlich(langsam[i - 1])
      const a1 = endlich(schnell[i])
      const b1 = endlich(langsam[i])
      if (a0 === null || b0 === null || a1 === null || b1 === null) return
      if (a0 <= b0 && a1 > b1) neu('ema-kreuz', 'long', `Golden Cross ${name}`, `EMA ${name.replace('/', ' kreuzt EMA ')} von unten nach oben.`)
      else if (a0 >= b0 && a1 < b1) neu('ema-kreuz', 'short', `Death Cross ${name}`, `EMA ${name.replace('/', ' kreuzt EMA ')} von oben nach unten.`)
    }
    kreuz(ema20, ema50, '20/50')
    kreuz(ema50, ema200, '50/200')
  }

  // ── RSI extrem ─────────────────────────────────────────────────────────────
  if (muster.rsi) {
    const r0 = endlich(rsi14[i - 1])
    const r1 = endlich(rsi14[i])
    if (r0 !== null && r1 !== null) {
      if (r0 <= 70 && r1 > 70) neu('rsi', 'short', 'RSI überkauft', `RSI 14 bei ${r1.toFixed(0)} – über 70.`)
      else if (r0 >= 30 && r1 < 30) neu('rsi', 'long', 'RSI überverkauft', `RSI 14 bei ${r1.toFixed(0)} – unter 30.`)
    }
  }

  // ── Lehrbuch-Setup aus der Übungs-Engine ───────────────────────────────────
  if (muster.setup) {
    const s = erkenneImFenster(c, i)
    if (s && s.signalIndex === i) {
      const name = STRATEGIEN.find((st) => st.id === s.strategieId)?.name ?? s.strategieId
      neu(
        'setup',
        s.richtung,
        `${name} (${s.richtung})`,
        `${s.lage} Entry-Zone ${fmt(s.entryZone.preisVon)}–${fmt(s.entryZone.preisBis)}, Stop ${fmt(s.idealStopLoss)}, Ziel ${fmt(s.idealTakeProfit)}.`,
        s.idealEntry,
      )
    }
  }

  return { analyse, signale }
}

/**
 * Signale der letzten `anzahl` abgeschlossenen Kerzen vor der aktuellen, rückwirkend aus der Historie.
 * Damit zeigt die Signalliste auch dann etwas, wenn die Action die Kerzen nicht live gesehen hat
 * (Erstlauf, neue Ebene, Lücken). Markiert mit `nachgetragen`, damit daraus kein Push wird.
 */
export function analysiereHistorie(
  kerzen: Candle[],
  instrumentId: string,
  muster: Record<MusterId, boolean>,
  opt: AnalyseOptionen = STANDARD_OPTIONEN,
  anzahl = 25,
): Signal[] {
  const signale: Signal[] = []
  const n = kerzen.length
  // j = Index der jeweils "letzten" Kerze; die Folgekerze gilt als Zeitpunkt der Sichtung
  for (let j = Math.max(25, n - 1 - anzahl); j <= n - 2; j++) {
    const sichtung = new Date(kerzen[j + 1].time * 1000)
    const e = analysiere(kerzen.slice(0, j + 1), instrumentId, muster, sichtung, undefined, opt)
    if (!e) continue
    for (const s of e.signale) signale.push({ ...s, nachgetragen: true })
  }
  return signale
}

function fmt(n: number): string {
  const stellen = n >= 1000 ? 0 : n >= 10 ? 2 : 4
  return n.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen })
}

/** Kerzen kompakt als Zahlenfelder (JSON) und zurück */
/** Yahoo liefert 7844.52001953125 – auf 5 Nachkommastellen runden spart ~40 % JSON (EUR/USD braucht 5) */
function r5(n: number): number {
  return Math.round(n * 1e5) / 1e5
}

export function kerzenKompakt(kerzen: Candle[]): number[][] {
  return kerzen.map((k) => [k.time, r5(k.open), r5(k.high), r5(k.low), r5(k.close), Math.round(k.volume)])
}

export function kerzenAusKompakt(felder: number[][]): Candle[] {
  return felder
    .filter((f) => Array.isArray(f) && f.length >= 5 && f.every((x) => typeof x === 'number'))
    .map((f) => ({ time: f[0], open: f[1], high: f[2], low: f[3], close: f[4], volume: f[5] ?? 0 }))
}
