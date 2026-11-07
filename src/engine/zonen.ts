import type { Candle } from '../types'
import { letzterAtr } from './indikatoren/atr'

// Zonen-Erkennung für die Top-Down-Übung: markante Hochs und Tiefs (Fraktale), Range-Kanten und
// Ausgangspunkte starker Bewegungen werden zu Preisbändern gebündelt und nach Stärke sortiert.
// Reine Logik, getestet in zonen.test.ts. Keine Zukunft: nur Kerzen bis zum letzten Index.

export type ZonenArt = 'widerstand' | 'unterstuetzung' | 'range' | 'impuls'

export interface Zone {
  id: string
  von: number
  bis: number
  art: ZonenArt
  /** Anläufe an die Zone (Kerzen, die sie berühren, nach einer Kerze ohne Berührung) */
  beruehrungen: number
  /** Index der letzten Berührung */
  letzterIndex: number
  staerke: number
  wichtig: boolean
  text: string
}

export interface ZonenOptionen {
  /** Kerzen je Seite für ein Fraktal-Hoch/-Tief */
  fraktal: number
  /** Punkte näher als so viele ATR bilden eine Zone */
  toleranzAtr: number
  /** Mindestbreite einer Zone in ATR */
  minBreiteAtr: number
  /** so viele Zonen gelten als wichtig */
  maxWichtig: number
  /** so viele Kerzen zurück */
  rueckschau: number
  /** Impuls: Bewegung über drei Kerzen in ATR */
  impulsAtr: number
}

export const STANDARD_ZONEN: ZonenOptionen = { fraktal: 3, toleranzAtr: 0.6, minBreiteAtr: 0.4, maxWichtig: 5, rueckschau: 300, impulsAtr: 2.5 }

export interface Swing {
  index: number
  preis: number
  art: 'hoch' | 'tief'
}

/** Fraktal-Hochs und -Tiefs: Extrem gegenüber k Kerzen je Seite */
export function swings(c: Candle[], k = 3): Swing[] {
  const out: Swing[] = []
  for (let i = k; i < c.length - k; i++) {
    let hoch = true
    let tief = true
    for (let j = 1; j <= k; j++) {
      if (c[i].high < c[i - j].high || c[i].high < c[i + j].high) hoch = false
      if (c[i].low > c[i - j].low || c[i].low > c[i + j].low) tief = false
    }
    if (hoch) out.push({ index: i, preis: c[i].high, art: 'hoch' })
    if (tief) out.push({ index: i, preis: c[i].low, art: 'tief' })
  }
  return out
}

interface Punkt {
  preis: number
  index: number
  gewicht: number
  art: 'swing' | 'range' | 'impuls'
  /** eigene Bandbreite (Impuls, Range) */
  von?: number
  bis?: number
}

/** Ausgangspunkte starker Bewegungen: drei Kerzen in eine Richtung über ≥ impulsAtr; die Basis davor ist die Zone */
export function impulsUrspruenge(c: Candle[], atr: number, impulsAtr: number): Punkt[] {
  const out: Punkt[] = []
  for (let i = 3; i < c.length; i++) {
    const a = c[i - 2]
    const bewegung = c[i].close - a.open
    if (Math.abs(bewegung) < impulsAtr * atr) continue
    const auf = bewegung > 0
    const gleich = [c[i - 2], c[i - 1], c[i]].every((k) => (auf ? k.close >= k.open : k.close <= k.open))
    if (!gleich) continue
    const basis = c[i - 3]
    const von = auf ? Math.min(basis.low, a.low) : Math.min(a.open, basis.close)
    const bis = auf ? Math.max(a.open, basis.close) : Math.max(basis.high, a.high)
    out.push({ preis: (von + bis) / 2, index: i - 3, gewicht: 1.5, art: 'impuls', von, bis })
    i += 2 // dieselbe Bewegung nicht mehrfach zählen
  }
  return out
}

/** Range am Ende des Abschnitts: längstes Fenster (20–120 Kerzen) mit Höhe ≤ 6 ATR und je zwei Berührungen der Kanten */
export function rangeKanten(c: Candle[], atr: number): { tief: number; hoch: number; von: number } | null {
  const n = c.length
  for (let len = Math.min(120, n); len >= 20; len--) {
    const von = n - len
    let hoch = -Infinity
    let tief = Infinity
    for (let i = von; i < n; i++) {
      hoch = Math.max(hoch, c[i].high)
      tief = Math.min(tief, c[i].low)
    }
    const hoehe = hoch - tief
    if (hoehe <= 0 || hoehe > 6 * atr) continue
    let oben = 0
    let unten = 0
    for (let i = von; i < n; i++) {
      if (c[i].high >= hoch - 0.15 * hoehe) oben++
      if (c[i].low <= tief + 0.15 * hoehe) unten++
    }
    if (oben >= 2 && unten >= 2) return { tief, hoch, von }
  }
  return null
}

/** Anläufe an ein Band: Kerzen, die es berühren, nachdem die Kerze davor es nicht berührt hat */
export function anlaeufe(c: Candle[], von: number, bis: number): { anzahl: number; letzterIndex: number } {
  let anzahl = 0
  let letzterIndex = -1
  let drin = false
  for (let i = 0; i < c.length; i++) {
    const beruehrt = c[i].low <= bis && c[i].high >= von
    if (beruehrt) {
      if (!drin) anzahl++
      letzterIndex = i
    }
    drin = beruehrt
  }
  return { anzahl, letzterIndex }
}

export function findeZonen(kerzen: Candle[], opt: ZonenOptionen = STANDARD_ZONEN): Zone[] {
  const c = kerzen.slice(-opt.rueckschau)
  const n = c.length
  if (n < 30) return []
  const atr = letzterAtr(c, n - 1, 14)
  if (!(atr > 0)) return []
  const close = c[n - 1].close

  const punkte: Punkt[] = swings(c, opt.fraktal).map((s) => ({ preis: s.preis, index: s.index, gewicht: 1, art: 'swing' as const }))
  punkte.push(...impulsUrspruenge(c, atr, opt.impulsAtr))
  const range = rangeKanten(c, atr)
  if (range) {
    const rand = Math.max(0.15 * (range.hoch - range.tief), 0.2 * atr)
    punkte.push({ preis: range.hoch, index: n - 1, gewicht: 2, art: 'range', von: range.hoch - rand, bis: range.hoch + rand })
    punkte.push({ preis: range.tief, index: n - 1, gewicht: 2, art: 'range', von: range.tief - rand, bis: range.tief + rand })
  }
  punkte.sort((a, b) => a.preis - b.preis)

  // Bündeln: benachbarte Punkte innerhalb der Toleranz bilden eine Zone
  const gruppen: Punkt[][] = []
  for (const p of punkte) {
    const g = gruppen[gruppen.length - 1]
    if (g && p.preis - g[g.length - 1].preis <= opt.toleranzAtr * atr) g.push(p)
    else gruppen.push([p])
  }

  const zonen: Zone[] = gruppen.map((g, nr) => {
    let von = Math.min(...g.map((p) => p.von ?? p.preis))
    let bis = Math.max(...g.map((p) => p.bis ?? p.preis))
    const minBreite = opt.minBreiteAtr * atr
    if (bis - von < minBreite) {
      const mitte = (von + bis) / 2
      von = mitte - minBreite / 2
      bis = mitte + minBreite / 2
    }
    const { anzahl, letzterIndex } = anlaeufe(c, von, bis)
    const hatImpuls = g.some((p) => p.art === 'impuls')
    const hatRange = g.some((p) => p.art === 'range')
    const art: ZonenArt = hatRange ? 'range' : hatImpuls ? 'impuls' : bis < close ? 'unterstuetzung' : 'widerstand'
    const abstandAtr = Math.abs((von + bis) / 2 - close) / atr
    const frische = 1 - (n - 1 - letzterIndex) / n
    const staerke = anzahl + g.reduce((s, p) => s + p.gewicht, 0) * 0.5 + (hatImpuls ? 1.5 : 0) + (hatRange ? 1 : 0) + frische + (abstandAtr <= 3 ? 1 : abstandAtr <= 8 ? 0.5 : 0)
    const lage = bis < close ? 'Unterstützung' : von > close ? 'Widerstand' : 'am Kurs'
    const text = hatRange
      ? `Range-${(von + bis) / 2 > close ? 'Oberkante' : 'Unterkante'}, ${anzahl}× angelaufen`
      : hatImpuls
        ? `Ausgangspunkt einer starken Bewegung (${lage}), ${anzahl}× angelaufen`
        : `${lage}, ${anzahl}× angelaufen, zuletzt vor ${n - 1 - letzterIndex} Kerzen`
    return { id: `z${nr}`, von, bis, art, beruehrungen: anzahl, letzterIndex, staerke: Math.round(staerke * 100) / 100, wichtig: false, text }
  })

  // Nachbarn verschmelzen: Zonen mit Lücke unter einer halben ATR sind eine Zone (sonst drei Bänder für ein Level)
  zonen.sort((a, b) => a.von - b.von)
  const verschmolzen: Zone[] = []
  for (const z of zonen) {
    const v = verschmolzen[verschmolzen.length - 1]
    if (v && z.von - v.bis <= 0.5 * atr) {
      const von = Math.min(v.von, z.von)
      const bis = Math.max(v.bis, z.bis)
      const { anzahl, letzterIndex } = anlaeufe(c, von, bis)
      const art: ZonenArt = v.art === 'range' || z.art === 'range' ? 'range' : v.art === 'impuls' || z.art === 'impuls' ? 'impuls' : bis < close ? 'unterstuetzung' : 'widerstand'
      const lage = bis < close ? 'Unterstützung' : von > close ? 'Widerstand' : 'am Kurs'
      const text = art === 'range' ? (v.art === 'range' ? v.text : z.text) : art === 'impuls' ? `Ausgangspunkt einer starken Bewegung (${lage}), ${anzahl}× angelaufen` : `${lage}, ${anzahl}× angelaufen, zuletzt vor ${n - 1 - letzterIndex} Kerzen`
      verschmolzen[verschmolzen.length - 1] = { ...v, von, bis, art, beruehrungen: anzahl, letzterIndex, staerke: Math.max(v.staerke, z.staerke) + 0.5, text }
    } else verschmolzen.push(z)
  }

  // wichtig: die stärksten mit mindestens zwei Anläufen (oder Impuls/Range); eine Zone, in der der Kurs gerade
  // steht, ist keine Zone zum Einzeichnen – sie wird ständig „angelaufen“
  const kandidaten = verschmolzen
    .filter((z) => (z.beruehrungen >= 2 || z.art === 'impuls' || z.art === 'range') && !(close >= z.von && close <= z.bis))
    .sort((a, b) => b.staerke - a.staerke)
  for (const z of kandidaten.slice(0, opt.maxWichtig)) z.wichtig = true
  return verschmolzen.sort((a, b) => b.von - a.von)
}

// ── Vergleich mit den Bändern des Nutzers ───────────────────────────────────

export interface Band {
  preisVon: number
  preisBis: number
}

export interface ZonenVergleich {
  /** wichtige Zonen, die ein Band des Nutzers trifft */
  getroffen: { zone: Zone; band: Band }[]
  /** wichtige Zonen ohne Band */
  verfehlt: Zone[]
  /** Bänder, die nur eine unwichtige Zone treffen */
  nebensaechlich: { zone: Zone; band: Band }[]
  /** Bänder ohne jede Zone */
  ueberfluessig: Band[]
  /** getroffen / wichtig, 0..1 */
  quote: number
}

function ueberlappung(a: Band, z: Zone): number {
  const lo = Math.max(Math.min(a.preisVon, a.preisBis), z.von)
  const hi = Math.min(Math.max(a.preisVon, a.preisBis), z.bis)
  if (hi <= lo) return 0
  return (hi - lo) / Math.min(Math.abs(a.preisBis - a.preisVon) || 1e-9, z.bis - z.von || 1e-9)
}

function abstand(a: Band, z: Zone): number {
  const lo = Math.min(a.preisVon, a.preisBis)
  const hi = Math.max(a.preisVon, a.preisBis)
  if (hi < z.von) return z.von - hi
  if (lo > z.bis) return lo - z.bis
  return 0
}

/** Band trifft Zone: mindestens 30 % Überlappung oder Lücke unter `toleranz` (z.B. 0,3 ATR) */
export function vergleicheZonen(zonen: Zone[], baender: Band[], toleranz: number): ZonenVergleich {
  const getroffen: ZonenVergleich['getroffen'] = []
  const nebensaechlich: ZonenVergleich['nebensaechlich'] = []
  const ueberfluessig: Band[] = []
  const getroffeneIds = new Set<string>()
  for (const band of baender) {
    let beste: Zone | null = null
    let besterWert = -1
    for (const z of zonen) {
      const u = ueberlappung(band, z)
      const d = abstand(band, z)
      const wert = u >= 0.3 ? 1 + u + (z.wichtig ? 1 : 0) : d <= toleranz ? 0.5 + (z.wichtig ? 1 : 0) : -1
      if (wert > besterWert) {
        besterWert = wert
        beste = wert >= 0 ? z : null
      }
    }
    if (!beste) ueberfluessig.push(band)
    else if (beste.wichtig) {
      if (!getroffeneIds.has(beste.id)) getroffen.push({ zone: beste, band })
      getroffeneIds.add(beste.id)
    } else nebensaechlich.push({ zone: beste, band })
  }
  const wichtige = zonen.filter((z) => z.wichtig)
  const verfehlt = wichtige.filter((z) => !getroffeneIds.has(z.id))
  return { getroffen, verfehlt, nebensaechlich, ueberfluessig, quote: wichtige.length ? getroffen.length / wichtige.length : 1 }
}
