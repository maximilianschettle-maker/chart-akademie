// Discounted-Cashflow in zwei Phasen plus Endwert (Gordon). Reine Funktionen.
//
// Fairer Wert je Aktie = (Σ Barwerte der FCF + Barwert des Endwerts − Nettoschulden) / Aktien.
// Der Endwert wird nach dem letzten Prognosejahr mit ewigem Wachstum g berechnet:
// FCF_n+1 / (r − g). Liegt g nicht klar unter r, ist das Modell unbrauchbar → null.

import type { Abschluss, DcfAnnahmen, DcfErgebnis } from '../types'

export const DCF_STANDARD: DcfAnnahmen = {
  basisJahre: 3,
  wachstum1: 10,
  jahre1: 5,
  wachstum2: 4,
  jahre2: 5,
  diskontsatz: 9,
  endwachstum: 2,
  sicherheitsmarge: 25,
}

export interface DcfBasis {
  /** Freier Cashflow der letzten Jahre, aufsteigend (ältestes zuerst) */
  fcfReihe: number[]
  nettoschulden: number
  aktien: number
}

/** Basisdaten aus den Abschlüssen: FCF-Reihe, Nettoschulden und Aktienzahl des letzten Jahres. */
export function dcfBasisAus(jahre: Abschluss[], aktienAnzahlKurs?: number): DcfBasis | null {
  const fy = jahre.filter((j) => j.zeitraum === 'FY' && j.freierCashflow !== null).sort((a, b) => a.ende.localeCompare(b.ende))
  if (fy.length === 0) return null
  const letzt = fy[fy.length - 1]
  const aktien = aktienAnzahlKurs ?? letzt.aktienAusstehend ?? letzt.aktienVerwaessert
  if (!aktien || aktien <= 0) return null
  const nettoschulden = (letzt.finanzschulden ?? 0) - (letzt.zahlungsmittel ?? 0)
  return { fcfReihe: fy.map((j) => j.freierCashflow as number), nettoschulden, aktien }
}

export function basisFcf(reihe: number[], basisJahre: number): number | null {
  const n = Math.max(1, Math.min(basisJahre, reihe.length))
  if (reihe.length === 0) return null
  const letzte = reihe.slice(-n)
  return letzte.reduce((s, v) => s + v, 0) / letzte.length
}

export function dcf(basis: DcfBasis, a: DcfAnnahmen): DcfErgebnis | null {
  const fcf0 = basisFcf(basis.fcfReihe, a.basisJahre)
  if (fcf0 === null || basis.aktien <= 0) return null
  const r = a.diskontsatz / 100
  const g = a.endwachstum / 100
  if (!(r > g + 0.005)) return null // Endwert-Formel braucht r deutlich über g
  const jahre: DcfErgebnis['jahre'] = []
  let fcf = fcf0
  let summe = 0
  const gesamt = Math.max(0, Math.round(a.jahre1)) + Math.max(0, Math.round(a.jahre2))
  for (let t = 1; t <= gesamt; t++) {
    const rate = t <= a.jahre1 ? a.wachstum1 / 100 : a.wachstum2 / 100
    fcf = fcf * (1 + rate)
    const barwert = fcf / Math.pow(1 + r, t)
    summe += barwert
    jahre.push({ jahr: t, fcf, barwert })
  }
  const endwert = (fcf * (1 + g)) / (r - g)
  const endwertBarwert = endwert / Math.pow(1 + r, gesamt)
  const unternehmenswert = summe + endwertBarwert
  const eigenkapitalwert = unternehmenswert - basis.nettoschulden
  const fairerWertJeAktie = eigenkapitalwert / basis.aktien
  return {
    basisFcf: fcf0,
    jahre,
    summeBarwerte: summe,
    endwert,
    endwertBarwert,
    unternehmenswert,
    nettoschulden: basis.nettoschulden,
    eigenkapitalwert,
    fairerWertJeAktie,
    kaufkursMitMarge: fairerWertJeAktie * (1 - a.sicherheitsmarge / 100),
    endwertAnteil: unternehmenswert !== 0 ? endwertBarwert / unternehmenswert : 0,
  }
}

/** Matrix fairer Wert je Aktie: Zeilen = Wachstum Phase 1, Spalten = Diskontsatz. */
export function sensitivitaet(basis: DcfBasis, a: DcfAnnahmen, wachstumsStufen: number[], diskontStufen: number[]): (number | null)[][] {
  return wachstumsStufen.map((w) => diskontStufen.map((d) => dcf(basis, { ...a, wachstum1: w, diskontsatz: d })?.fairerWertJeAktie ?? null))
}

/** Stufen rund um einen Mittelwert: z.B. 9 % → [5, 7, 9, 11, 13] */
export function stufenUm(mitte: number, schritt: number, anzahl = 5): number[] {
  const halb = Math.floor(anzahl / 2)
  return Array.from({ length: anzahl }, (_, i) => Math.round((mitte + (i - halb) * schritt) * 100) / 100)
}
