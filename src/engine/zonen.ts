import type { Candle } from '../types'
import { letzterAtr } from './indikatoren/atr'

// Zonen-Erkennung für die Top-Down-Übung: markante Hochs und Tiefs (Fraktale), Range-Kanten und
// Ausgangspunkte starker Bewegungen werden zu Preisbändern gebündelt und nach Stärke sortiert.
// Reine Logik, getestet in zonen.test.ts. Keine Zukunft: nur Kerzen bis zum letzten Index.

export type ZonenArt = 'widerstand' | 'unterstuetzung' | 'range' | 'impuls'

/** Ein Kontakt des Kurses mit der Zone: gedreht (gehalten/abgewiesen) oder durchgelaufen */
export interface Kontakt {
  /** erste und letzte Kerze des Kontakts */
  vonIndex: number
  bisIndex: number
  /** Kerze mit dem Extrem in der Zone (Tief bei „gehalten“, Hoch bei „abgewiesen“), sonst die erste */
  index: number
  time: number
  /** gehalten: von oben gekommen, wieder nach oben · abgewiesen: von unten, wieder nach unten ·
   *  durchlauf: auf der anderen Seite herausgekommen · offen: Kurs steht noch in der Zone oder Anfang unbekannt */
  art: 'gehalten' | 'abgewiesen' | 'durchlauf' | 'offen'
}

/** Woraus die Erkennung eine Zone gebildet hat */
export interface Herkunft {
  art: 'hoch' | 'tief' | 'impuls' | 'range'
  index: number
  time: number
  preis: number
  /** nur impuls: Richtung und Größe der Bewegung in ATR */
  auf?: boolean
  bewegungAtr?: number
}

export interface Zone {
  id: string
  von: number
  bis: number
  art: ZonenArt
  /** Kontakte, an denen der Kurs gedreht hat (gehalten oder abgewiesen) */
  reaktionen: number
  /** Kontakte, bei denen der Kurs durch die Zone gelaufen ist */
  durchlaeufe: number
  kontakte: Kontakt[]
  herkunft: Herkunft[]
  /** alle Kontakte (Reaktionen + Durchläufe + offene) */
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
  /** Mindest- und Höchstbreite einer Zone in ATR */
  minBreiteAtr: number
  maxBreiteAtr: number
  /** so viele Zonen gelten als wichtig */
  maxWichtig: number
  /** so viele Kerzen zurück */
  rueckschau: number
  /** Impuls: Bewegung über drei Kerzen in ATR */
  impulsAtr: number
}

export const STANDARD_ZONEN: ZonenOptionen = { fraktal: 3, toleranzAtr: 0.6, minBreiteAtr: 0.4, maxBreiteAtr: 2, maxWichtig: 5, rueckschau: 300, impulsAtr: 2.5 }

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
  /** swing: Hoch oder Tief */
  swing?: 'hoch' | 'tief'
  /** impuls: Richtung und Größe in ATR */
  auf?: boolean
  bewegungAtr?: number
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
    out.push({ preis: (von + bis) / 2, index: i - 3, gewicht: 1.5, art: 'impuls', von, bis, auf, bewegungAtr: Math.abs(bewegung) / atr })
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

/** So viele Kerzen ohne Berührung trennen zwei Kontakte; kürzere Lücken gehören zum selben Kontakt */
export const KONTAKT_LUECKE = 3

/**
 * Kontakte des Kurses mit einem Band, je Kontakt mit Ausgang: Kommt der Kurs auf der Seite wieder heraus,
 * von der er kam, hat die Zone reagiert (gehalten/abgewiesen); kommt er auf der anderen heraus, ist er durchgelaufen.
 */
export function kontakte(c: Candle[], von: number, bis: number): Kontakt[] {
  const beruehrt = (i: number) => c[i].low <= bis && c[i].high >= von
  const seite = (i: number): 'oben' | 'unten' => (c[i].low > bis ? 'oben' : 'unten')
  const out: Kontakt[] = []
  let i = 0
  while (i < c.length) {
    if (!beruehrt(i)) {
      i++
      continue
    }
    const start = i
    let ende = i
    for (let j = i + 1; j < c.length && j - ende <= KONTAKT_LUECKE; j++) if (beruehrt(j)) ende = j
    const davor = start > 0 ? seite(start - 1) : null
    const danach = ende < c.length - 1 ? seite(ende + 1) : null
    let art: Kontakt['art'] = 'offen'
    if (davor && danach) art = davor !== danach ? 'durchlauf' : davor === 'oben' ? 'gehalten' : 'abgewiesen'
    let index = start
    if (art === 'gehalten') for (let k = start; k <= ende; k++) if (c[k].low < c[index].low) index = k
    if (art === 'abgewiesen') for (let k = start; k <= ende; k++) if (c[k].high > c[index].high) index = k
    out.push({ vonIndex: start, bisIndex: ende, index, time: c[index].time, art })
    i = ende + 1
  }
  return out
}

function zaehle(k: Kontakt[]): { reaktionen: number; durchlaeufe: number; letzterIndex: number } {
  return {
    reaktionen: k.filter((x) => x.art === 'gehalten' || x.art === 'abgewiesen').length,
    durchlaeufe: k.filter((x) => x.art === 'durchlauf').length,
    letzterIndex: k.length ? k[k.length - 1].bisIndex : -1,
  }
}

/** „4× gedreht, 9× durchlaufen“ */
export function kontaktText(reaktionen: number, durchlaeufe: number): string {
  return `${reaktionen}× gedreht${durchlaeufe ? `, ${durchlaeufe}× durchlaufen` : ''}`
}

/** Ein Satz zur Einordnung: trägt die Zone, oder läuft der Kurs meist durch? */
export function zonenFazit(z: Pick<Zone, 'reaktionen' | 'durchlaeufe' | 'art'>): string {
  const { reaktionen: r, durchlaeufe: d } = z
  if (r === 0)
    return z.art === 'impuls'
      ? 'Der Kurs hat hier noch nie gedreht. Die Zone steht nur, weil hier eine starke Bewegung begann – ein Kandidat, kein bewährtes Level.'
      : 'Der Kurs hat hier noch nie gedreht – als Zone schwach.'
  if (d > 2 * r) return `Der Kurs läuft hier viel öfter durch (${d}×), als er dreht (${r}×). Das ist eher die Mitte der Bewegung als eine Kante – mit Vorsicht behandeln.`
  if (d > r) return `Mehr Durchläufe (${d}×) als Reaktionen (${r}×): Die Zone wirkt, aber nicht verlässlich.`
  if (r >= 3 && d * 3 <= r) return `Der Kurs hat hier ${r}× gedreht und ist ${d ? `nur ${d}×` : 'nie'} durchgelaufen – eine saubere Zone.`
  if (r >= 3) return `${r}× gedreht, ${d}× durchgelaufen: Die Zone hält öfter, als sie bricht – brauchbar, aber kein sicheres Level.`
  return `${r}× gedreht, ${d ? `${d}×` : 'nie'} durchgelaufen – brauchbar, aber noch wenig bestätigt.`
}

export function findeZonen(kerzen: Candle[], opt: ZonenOptionen = STANDARD_ZONEN): Zone[] {
  const c = kerzen.slice(-opt.rueckschau)
  const n = c.length
  if (n < 30) return []
  const atr = letzterAtr(c, n - 1, 14)
  if (!(atr > 0)) return []
  const close = c[n - 1].close

  const punkte: Punkt[] = swings(c, opt.fraktal).map((s) => ({ preis: s.preis, index: s.index, gewicht: 1, art: 'swing' as const, swing: s.art }))
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
    // breiter als 2 ATR ist keine Zone mehr, sondern ein Bereich – auf die Mitte eindampfen
    if (bis - von > opt.maxBreiteAtr * atr) {
      const mitte = (von + bis) / 2
      von = mitte - (opt.maxBreiteAtr * atr) / 2
      bis = mitte + (opt.maxBreiteAtr * atr) / 2
    }
    const liste = kontakte(c, von, bis)
    const { reaktionen, durchlaeufe, letzterIndex } = zaehle(liste)
    // Nur die Punkte der Gruppe, die im (ggf. eingedampften) Band liegen, tragen die Zone – eine lange Kette
    // von Hochs und Tiefs in der Mitte der Bewegung soll das Band nicht stärker machen, als es ist
    const imBand = g.filter((p) => (p.bis ?? p.preis) >= von - 1e-9 && (p.von ?? p.preis) <= bis + 1e-9)
    const herkunft: Herkunft[] = imBand
      .map((p) => ({ art: p.art === 'swing' ? p.swing! : p.art, index: p.index, time: c[p.index].time, preis: p.preis, ...(p.art === 'impuls' ? { auf: p.auf, bewegungAtr: p.bewegungAtr } : {}) }))
      .sort((a, b) => a.index - b.index)
    const hatImpuls = imBand.some((p) => p.art === 'impuls')
    const hatRange = imBand.some((p) => p.art === 'range')
    const art: ZonenArt = hatRange ? 'range' : hatImpuls ? 'impuls' : bis < close ? 'unterstuetzung' : 'widerstand'
    const abstandAtr = Math.abs((von + bis) / 2 - close) / atr
    const frische = 1 - (n - 1 - letzterIndex) / n
    // Reaktionen zählen, Durchläufe schwächen (höchstens 2 Punkte Abzug)
    const staerke = reaktionen - Math.min(2, 0.25 * durchlaeufe) + imBand.reduce((s, p) => s + p.gewicht, 0) * 0.5 + (hatImpuls ? 1.5 : 0) + (hatRange ? 1 : 0) + frische + (abstandAtr <= 3 ? 1 : abstandAtr <= 8 ? 0.5 : 0)
    const lage = bis < close ? 'Unterstützung' : von > close ? 'Widerstand' : 'am Kurs'
    const kt = kontaktText(reaktionen, durchlaeufe)
    const text = hatRange
      ? `Range-${(von + bis) / 2 > close ? 'Oberkante' : 'Unterkante'}, ${kt}`
      : hatImpuls
        ? `Ausgangspunkt einer starken Bewegung (${lage}), ${kt}`
        : `${lage}, ${kt}, zuletzt vor ${n - 1 - letzterIndex} Kerzen`
    return { id: `z${nr}`, von, bis, art, reaktionen, durchlaeufe, kontakte: liste, herkunft, beruehrungen: liste.length, letzterIndex, staerke: Math.round(staerke * 100) / 100, wichtig: false, text }
  })

  // Nachbarn verschmelzen: Zonen mit Lücke unter einer halben ATR sind eine Zone (sonst drei Bänder für ein Level)
  zonen.sort((a, b) => a.von - b.von)
  const verschmolzen: Zone[] = []
  for (const z of zonen) {
    const v = verschmolzen[verschmolzen.length - 1]
    if (v && z.von - v.bis <= 0.5 * atr && Math.max(v.bis, z.bis) - Math.min(v.von, z.von) <= opt.maxBreiteAtr * atr) {
      const von = Math.min(v.von, z.von)
      const bis = Math.max(v.bis, z.bis)
      const liste = kontakte(c, von, bis)
      const { reaktionen, durchlaeufe, letzterIndex } = zaehle(liste)
      const kt = kontaktText(reaktionen, durchlaeufe)
      const herkunft = [...v.herkunft, ...z.herkunft].sort((a, b) => a.index - b.index)
      const art: ZonenArt = v.art === 'range' || z.art === 'range' ? 'range' : v.art === 'impuls' || z.art === 'impuls' ? 'impuls' : bis < close ? 'unterstuetzung' : 'widerstand'
      const lage = bis < close ? 'Unterstützung' : von > close ? 'Widerstand' : 'am Kurs'
      const text =
        art === 'range'
          ? `Range-${(von + bis) / 2 > close ? 'Oberkante' : 'Unterkante'}, ${kt}`
          : art === 'impuls'
            ? `Ausgangspunkt einer starken Bewegung (${lage}), ${kt}`
            : `${lage}, ${kt}, zuletzt vor ${n - 1 - letzterIndex} Kerzen`
      verschmolzen[verschmolzen.length - 1] = { ...v, von, bis, art, reaktionen, durchlaeufe, kontakte: liste, herkunft, beruehrungen: liste.length, letzterIndex, staerke: Math.max(v.staerke, z.staerke) + 0.5, text }
    } else verschmolzen.push(z)
  }

  // wichtig: die stärksten mit mindestens zwei Reaktionen (oder Impuls/Range); eine Zone, in der der Kurs gerade
  // steht, ist keine Zone zum Einzeichnen – sie wird ständig „angelaufen“
  const kandidaten = verschmolzen
    .filter((z) => (z.reaktionen >= 2 || z.art === 'impuls' || z.art === 'range') && !(close >= z.von && close <= z.bis))
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
