// Setup-Bilanz über alle Quellen: Was bringt ein Setup im Schnitt – im Simulator, in den Übungen,
// in der Top-Down-Übung und mit echtem Geld? Reine Rechnung auf (Setup, Quelle, R)-Tripeln.

export type BilanzQuelle = 'echt' | 'simulator' | 'uebung' | 'topdown'

export const QUELLE_TEXT: Record<BilanzQuelle, string> = { echt: 'Echt', simulator: 'Simulator', uebung: 'Übungen', topdown: 'Top-Down' }
export const QUELLEN: BilanzQuelle[] = ['echt', 'simulator', 'uebung', 'topdown']

export interface BilanzPunkt {
  strategieId: string
  quelle: BilanzQuelle
  /** R-Multiple des Trades */
  r: number
}

export interface BilanzZelle {
  anzahl: number
  gewinner: number
  /** 0..1 */
  trefferquote: number
  /** Erwartungswert je Trade in R (Mittelwert) */
  erwartungR: number
  summeR: number
  gewinnR: number
  verlustR: number
  /** Summe Gewinne ÷ Summe Verluste; Infinity ohne Verluste, 0 ohne Gewinne */
  profitFaktor: number
}

export interface BilanzZeile {
  strategieId: string
  gesamt: BilanzZelle
  jeQuelle: Partial<Record<BilanzQuelle, BilanzZelle>>
}

export function zelle(rs: number[]): BilanzZelle {
  const gewinne = rs.filter((r) => r > 0)
  const verluste = rs.filter((r) => r < 0)
  const summe = rs.reduce((s, r) => s + r, 0)
  const sg = gewinne.reduce((s, r) => s + r, 0)
  const sv = -verluste.reduce((s, r) => s + r, 0)
  const rund = (x: number) => Math.round(x * 100) / 100
  return {
    anzahl: rs.length,
    gewinner: gewinne.length,
    trefferquote: rs.length ? gewinne.length / rs.length : 0,
    erwartungR: rs.length ? rund(summe / rs.length) : 0,
    summeR: rund(summe),
    gewinnR: gewinne.length ? rund(sg / gewinne.length) : 0,
    verlustR: verluste.length ? rund(-sv / verluste.length) : 0,
    profitFaktor: sv > 0 ? rund(sg / sv) : sg > 0 ? Infinity : 0,
  }
}

/** Zeilen je Setup, sortiert nach Erwartungswert (bestes zuerst); Setups ohne Punkt fehlen */
export function setupBilanz(punkte: BilanzPunkt[]): BilanzZeile[] {
  const nachSetup = new Map<string, BilanzPunkt[]>()
  for (const p of punkte) {
    if (!Number.isFinite(p.r)) continue
    nachSetup.set(p.strategieId, [...(nachSetup.get(p.strategieId) ?? []), p])
  }
  const zeilen: BilanzZeile[] = []
  for (const [strategieId, liste] of nachSetup) {
    const jeQuelle: BilanzZeile['jeQuelle'] = {}
    for (const q of QUELLEN) {
      const rs = liste.filter((p) => p.quelle === q).map((p) => p.r)
      if (rs.length) jeQuelle[q] = zelle(rs)
    }
    zeilen.push({ strategieId, gesamt: zelle(liste.map((p) => p.r)), jeQuelle })
  }
  return zeilen.sort((a, b) => b.gesamt.erwartungR - a.gesamt.erwartungR || b.gesamt.anzahl - a.gesamt.anzahl)
}

/** Ab so vielen Trades ist der Erwartungswert mehr als ein Zufallswert */
export const MIN_TRADES_AUSSAGE = 20

/** Einordnung einer Zelle in Worten */
export function einordnung(z: BilanzZelle): string {
  if (z.anzahl < 5) return 'zu wenige Trades'
  if (z.anzahl < MIN_TRADES_AUSSAGE) return z.erwartungR > 0 ? 'positiv, noch dünn' : 'negativ, noch dünn'
  if (z.erwartungR >= 0.3) return 'verdient Geld'
  if (z.erwartungR > 0) return 'knapp positiv'
  return 'verliert Geld'
}
