import type { Candle, Richtung } from '../types'
import type { Zone } from '../engine/zonen'
import type { Richtung3 } from '../engine/richtung'
import { erkenneImFenster } from '../engine/setupErkennung'
import { strategieName } from '../content/strategien'

// Top-Down, Teil 2 (4b): Replay an einer Zone. Reine Logik: Trade-Simulation (Fill, Stop/Ziel, R)
// und die Bewertung der Entscheidung – Trade mit fünf Kriterien, „Kein Trade“ gegen die Setup-Erkennung.

export interface TradeWahl {
  richtung: Richtung
  entry: number
  stop: number
  ziel: number
}

export interface Simulation {
  gefuellt: boolean
  fillIndex: number | null
  ausgang: 'ziel' | 'stop' | 'offen' | 'nicht gefüllt'
  exitIndex: number | null
  exitPreis: number | null
  r: number | null
}

/** Limit-Fill ab der Kerze nach der Entscheidung, danach Stop vor Ziel bei Berührung in derselben Kerze */
export function simuliereTrade(kerzen: Candle[], abIndex: number, t: TradeWahl): Simulation {
  const risiko = Math.abs(t.entry - t.stop)
  if (risiko <= 0) return { gefuellt: false, fillIndex: null, ausgang: 'nicht gefüllt', exitIndex: null, exitPreis: null, r: null }
  const long = t.richtung === 'long'
  let fillIndex: number | null = null
  let fillPreis = t.entry
  for (let i = abIndex + 1; i < kerzen.length; i++) {
    const k = kerzen[i]
    // Markt läuft schon durch den Einstieg → Fill am Open der nächsten Kerze
    if (i === abIndex + 1 && (long ? k.open <= t.entry : k.open >= t.entry)) {
      fillIndex = i
      fillPreis = k.open
      break
    }
    if (k.low <= t.entry && k.high >= t.entry) {
      fillIndex = i
      break
    }
  }
  if (fillIndex === null) return { gefuellt: false, fillIndex: null, ausgang: 'nicht gefüllt', exitIndex: null, exitPreis: null, r: null }
  const rVon = (preis: number) => Math.round(((long ? preis - fillPreis : fillPreis - preis) / risiko) * 100) / 100
  for (let i = fillIndex; i < kerzen.length; i++) {
    const k = kerzen[i]
    const stopHit = long ? k.low <= t.stop : k.high >= t.stop
    const zielHit = t.ziel > 0 && (long ? k.high >= t.ziel : k.low <= t.ziel)
    if (stopHit) return { gefuellt: true, fillIndex, ausgang: 'stop', exitIndex: i, exitPreis: t.stop, r: rVon(t.stop) }
    if (zielHit) return { gefuellt: true, fillIndex, ausgang: 'ziel', exitIndex: i, exitPreis: t.ziel, r: rVon(t.ziel) }
  }
  const letzte = kerzen[kerzen.length - 1]
  return { gefuellt: true, fillIndex, ausgang: 'offen', exitIndex: kerzen.length - 1, exitPreis: letzte.close, r: rVon(letzte.close) }
}

export interface Kriterium {
  id: 'richtung' | 'zone' | 'bestaetigung' | 'stop' | 'crv'
  titel: string
  ok: boolean
  text: string
}

export type ReplayBewertung = 'sauber' | 'mit Abstrichen' | 'falsch' | 'richtig' | 'verpasst'

export interface Entscheidungsbewertung {
  bewertung: ReplayBewertung
  kriterien: Kriterium[]
  /** bei Kein Trade: das übersehene Setup */
  verpasst?: { index: number; name: string; richtung: Richtung; zone: Zone | null }
  text: string
}

const fmt = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: x >= 1000 ? 0 : 2 })

/** Zone, an der ein Preis liegt (mit Toleranz) */
export function zoneBei(zonen: Zone[], preis: number, toleranz: number): Zone | null {
  let beste: Zone | null = null
  let abstand = Infinity
  for (const z of zonen) {
    const d = preis < z.von ? z.von - preis : preis > z.bis ? preis - z.bis : 0
    if (d <= toleranz && d < abstand) {
      abstand = d
      beste = z
    }
  }
  return beste
}

export interface BewertungsKontext {
  richtungTag: Richtung3
  /** nur wichtige Zonen */
  zonen: Zone[]
  kerzen: Candle[]
  /** Index der ersten Replay-Kerze (Zeitpunkt T) */
  startIndex: number
  entscheidungIndex: number
  atr: number
}

export function bewerteTrade(ctx: BewertungsKontext, t: TradeWahl): Entscheidungsbewertung {
  const long = t.richtung === 'long'
  const k = ctx.kerzen[Math.min(ctx.entscheidungIndex, ctx.kerzen.length - 1)]
  const zone = zoneBei(ctx.zonen, t.entry, 0.3 * ctx.atr)
  const risiko = Math.abs(t.entry - t.stop)
  const crv = t.ziel > 0 && risiko > 0 ? Math.abs(t.ziel - t.entry) / risiko : 0

  const richtungOk = ctx.richtungTag === 'seitwaerts' || (long && ctx.richtungTag === 'auf') || (!long && ctx.richtungTag === 'ab')
  const bestaetigt = long ? k.close > k.open && (!zone || k.close > zone.von) : k.close < k.open && (!zone || k.close < zone.bis)
  const stopHinterZone = zone ? (long ? t.stop < zone.von : t.stop > zone.bis) : true
  const stopAtr = risiko / ctx.atr
  const stopOk = stopHinterZone && stopAtr >= 0.8 && stopAtr <= 4

  const kriterien: Kriterium[] = [
    {
      id: 'richtung',
      titel: 'Richtung',
      ok: richtungOk,
      text: richtungOk ? `${long ? 'Long' : 'Short'} passt zum Tageschart (${ctx.richtungTag === 'auf' ? 'Aufwärtstrend' : ctx.richtungTag === 'ab' ? 'Abwärtstrend' : 'seitwärts, beide Seiten erlaubt'}).` : `${long ? 'Long' : 'Short'} gegen den Tagestrend (${ctx.richtungTag === 'auf' ? 'Aufwärtstrend' : 'Abwärtstrend'}).`,
    },
    {
      id: 'zone',
      titel: 'Zone',
      ok: zone !== null,
      text: zone ? `Einstieg ${fmt(t.entry)} liegt an der Zone ${fmt(zone.von)} – ${fmt(zone.bis)} (${zone.text}).` : `Einstieg ${fmt(t.entry)} liegt an keiner wichtigen Zone.`,
    },
    {
      id: 'bestaetigung',
      titel: 'Bestätigung',
      ok: bestaetigt,
      text: bestaetigt ? `Die Entscheidungskerze schließt in Trade-Richtung${zone ? ' und außerhalb der Zone' : ''}.` : `Zu früh: Die Kerze schließt ${long ? 'nicht bullisch' : 'nicht bärisch'}${zone ? ' oder noch in der Zone' : ''} – Bestätigung fehlt.`,
    },
    {
      id: 'stop',
      titel: 'Stop',
      ok: stopOk,
      text: !stopHinterZone ? `Stop ${fmt(t.stop)} liegt vor der Zone – wird leicht abgeholt.` : stopAtr < 0.8 ? `Stop ${fmt(t.stop)} nur ${stopAtr.toFixed(1).replace('.', ',')} ATR entfernt – Rauschen.` : stopAtr > 4 ? `Stop ${fmt(t.stop)} ${stopAtr.toFixed(1).replace('.', ',')} ATR entfernt – zu weit, Position wird winzig.` : `Stop ${fmt(t.stop)} hinter der Struktur, ${stopAtr.toFixed(1).replace('.', ',')} ATR.`,
    },
    {
      id: 'crv',
      titel: 'CRV',
      ok: crv >= 1.5,
      text: t.ziel > 0 ? `CRV ${crv.toFixed(2).replace('.', ',')} : 1${crv >= 1.5 ? '' : ' – unter 1,5'}.` : 'Kein Ziel gesetzt.',
    },
  ]
  const okZahl = kriterien.filter((x) => x.ok).length
  const bewertung: ReplayBewertung = okZahl === 5 ? 'sauber' : okZahl >= 3 ? 'mit Abstrichen' : 'falsch'
  const text = bewertung === 'sauber' ? 'Prozess sauber: Richtung, Zone, Bestätigung, Stop und CRV passen. Ob er gewinnt, ist Statistik.' : bewertung === 'mit Abstrichen' ? `${5 - okZahl} von 5 Kriterien nicht erfüllt – siehe unten.` : 'Das war kein Setup aus dem Kurs. Lieber „Kein Trade“.'
  return { bewertung, kriterien, text }
}

/** Kein Trade: richtig, wenn im gesehenen Fenster kein Detektor an einer wichtigen Zone in Tagesrichtung gefeuert hat */
export function bewerteKeinTrade(ctx: BewertungsKontext): Entscheidungsbewertung {
  const bis = Math.min(ctx.entscheidungIndex, ctx.kerzen.length - 1)
  for (let i = ctx.startIndex; i <= bis; i++) {
    const s = erkenneImFenster(ctx.kerzen.slice(0, i + 1), i)
    if (!s) continue
    const passt = ctx.richtungTag === 'seitwaerts' || (s.richtung === 'long' && ctx.richtungTag === 'auf') || (s.richtung === 'short' && ctx.richtungTag === 'ab')
    if (!passt) continue
    const zone = zoneBei(ctx.zonen, s.idealEntry, 0.5 * ctx.atr)
    if (!zone) continue
    return {
      bewertung: 'verpasst',
      kriterien: [],
      verpasst: { index: i, name: strategieName(s.strategieId), richtung: s.richtung, zone },
      text: `Verpasst: ${strategieName(s.strategieId)} ${s.richtung === 'long' ? 'Long' : 'Short'} an der Zone ${fmt(zone.von)} – ${fmt(zone.bis)}, ${bis - i} Kerzen vor deiner Entscheidung, in Tagesrichtung.`,
    }
  }
  return {
    bewertung: 'richtig',
    kriterien: [],
    text: 'Richtig: Im gesehenen Abschnitt gab es an keiner wichtigen Zone ein sauberes Setup in Tagesrichtung. Nichts zu tun ist auch eine Entscheidung.',
  }
}
