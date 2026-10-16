// Kennzahlen aus Abschlüssen und Kurs. Reine Funktionen; fehlende Eingaben → null, nie NaN.

import type { Abschluss, Kurs } from '../types'

export interface Kennzahlen {
  /** Bezugsjahr (letztes vollständiges Geschäftsjahr) */
  jahr: number | null
  bruttomarge: number | null
  ebitMarge: number | null
  nettomarge: number | null
  fcfMarge: number | null
  eigenkapitalrendite: number | null
  gesamtkapitalrendite: number | null
  eigenkapitalquote: number | null
  nettoverschuldung: number | null
  nettoverschuldungZuEbitda: number | null
  ausschuettungsquote: number | null
  /** Dividenden + Rückkäufe im Verhältnis zum FCF */
  kapitalrueckfuehrungZuFcf: number | null
  umsatzWachstum1: number | null
  umsatzWachstum3: number | null
  umsatzWachstum5: number | null
  umsatzWachstum10: number | null
  gewinnWachstum1: number | null
  gewinnWachstum3: number | null
  gewinnWachstum5: number | null
  fcfWachstum3: number | null
  fcfWachstum5: number | null
  epsWachstum5: number | null
  aktienVeraenderung5: number | null
  // Kursbezogen (nur wenn Kurs- und Berichtswährung gleich sind)
  kgv: number | null
  kbv: number | null
  kuv: number | null
  evEbitda: number | null
  fcfRendite: number | null
  dividendenrendite: number | null
}

function div(z: number | null | undefined, n: number | null | undefined): number | null {
  if (z === null || z === undefined || n === null || n === undefined || n === 0 || !Number.isFinite(z) || !Number.isFinite(n)) return null
  return z / n
}

/** Durchschnittliche jährliche Wachstumsrate zwischen zwei Werten über n Jahre; nur für positive Werte definiert. */
export function cagr(alt: number | null | undefined, neu: number | null | undefined, jahre: number): number | null {
  if (alt === null || alt === undefined || neu === null || neu === undefined || jahre <= 0) return null
  if (alt <= 0 || neu <= 0) return null
  return Math.pow(neu / alt, 1 / jahre) - 1
}

/** Letzte n Geschäftsjahre, aufsteigend; nur Zeilen mit Umsatz oder Gewinn. */
export function letzteJahre(jahre: Abschluss[], n: number): Abschluss[] {
  const gueltig = jahre.filter((j) => j.zeitraum === 'FY' && (j.umsatz !== null || j.nettogewinn !== null)).sort((a, b) => a.ende.localeCompare(b.ende))
  return gueltig.slice(-n)
}

function wachstum(jahre: Abschluss[], feld: keyof Abschluss, n: number): number | null {
  const reihe = jahre.filter((j) => j[feld] !== null)
  if (reihe.length < n + 1) return null
  const neu = reihe[reihe.length - 1]
  const alt = reihe[reihe.length - 1 - n]
  if (neu.geschaeftsjahr - alt.geschaeftsjahr !== n) return null // Lücke in der Reihe
  return cagr(alt[feld] as number, neu[feld] as number, n)
}

export function kennzahlen(jahreAlle: Abschluss[], kurs: Kurs | null, berichtsWaehrung: string): Kennzahlen {
  const jahre = letzteJahre(jahreAlle, 11)
  const j = jahre[jahre.length - 1]
  const leer: Kennzahlen = {
    jahr: null,
    bruttomarge: null,
    ebitMarge: null,
    nettomarge: null,
    fcfMarge: null,
    eigenkapitalrendite: null,
    gesamtkapitalrendite: null,
    eigenkapitalquote: null,
    nettoverschuldung: null,
    nettoverschuldungZuEbitda: null,
    ausschuettungsquote: null,
    kapitalrueckfuehrungZuFcf: null,
    umsatzWachstum1: null,
    umsatzWachstum3: null,
    umsatzWachstum5: null,
    umsatzWachstum10: null,
    gewinnWachstum1: null,
    gewinnWachstum3: null,
    gewinnWachstum5: null,
    fcfWachstum3: null,
    fcfWachstum5: null,
    epsWachstum5: null,
    aktienVeraenderung5: null,
    kgv: null,
    kbv: null,
    kuv: null,
    evEbitda: null,
    fcfRendite: null,
    dividendenrendite: null,
  }
  if (!j) return leer

  const nettoverschuldung = j.finanzschulden !== null && j.zahlungsmittel !== null ? j.finanzschulden - j.zahlungsmittel : null
  const rueckfuehrung = j.dividenden !== null || j.rueckkaeufe !== null ? (j.dividenden ?? 0) + (j.rueckkaeufe ?? 0) : null

  const k: Kennzahlen = {
    ...leer,
    jahr: j.geschaeftsjahr,
    bruttomarge: div(j.bruttogewinn, j.umsatz),
    ebitMarge: div(j.ebit, j.umsatz),
    nettomarge: div(j.nettogewinn, j.umsatz),
    fcfMarge: div(j.freierCashflow, j.umsatz),
    eigenkapitalrendite: div(j.nettogewinn, j.eigenkapital),
    gesamtkapitalrendite: div(j.nettogewinn, j.bilanzsumme),
    eigenkapitalquote: div(j.eigenkapital, j.bilanzsumme),
    nettoverschuldung,
    nettoverschuldungZuEbitda: j.ebitda !== null && j.ebitda > 0 ? div(nettoverschuldung, j.ebitda) : null,
    ausschuettungsquote: j.nettogewinn !== null && j.nettogewinn > 0 ? div(j.dividenden, j.nettogewinn) : null,
    kapitalrueckfuehrungZuFcf: j.freierCashflow !== null && j.freierCashflow > 0 ? div(rueckfuehrung, j.freierCashflow) : null,
    umsatzWachstum1: wachstum(jahre, 'umsatz', 1),
    umsatzWachstum3: wachstum(jahre, 'umsatz', 3),
    umsatzWachstum5: wachstum(jahre, 'umsatz', 5),
    umsatzWachstum10: wachstum(jahre, 'umsatz', 10),
    gewinnWachstum1: wachstum(jahre, 'nettogewinn', 1),
    gewinnWachstum3: wachstum(jahre, 'nettogewinn', 3),
    gewinnWachstum5: wachstum(jahre, 'nettogewinn', 5),
    fcfWachstum3: wachstum(jahre, 'freierCashflow', 3),
    fcfWachstum5: wachstum(jahre, 'freierCashflow', 5),
    epsWachstum5: wachstum(jahre, 'epsVerwaessert', 5),
  }
  // Aktienzahl kann auch sinken → kein CAGR, sondern einfache Veränderung
  const aktien = jahre.filter((x) => x.aktienVerwaessert !== null)
  if (aktien.length >= 6) {
    const neu = aktien[aktien.length - 1]
    const alt = aktien[aktien.length - 6]
    k.aktienVeraenderung5 = div((neu.aktienVerwaessert as number) - (alt.aktienVerwaessert as number), alt.aktienVerwaessert)
  }

  if (kurs && kurs.waehrung === berichtsWaehrung) {
    const marktkap = kurs.marktkap ?? (kurs.aktienAnzahl ? kurs.preis * kurs.aktienAnzahl : null)
    k.kgv = kurs.kgvTtm ?? (j.epsVerwaessert !== null && j.epsVerwaessert > 0 ? div(kurs.preis, j.epsVerwaessert) : null)
    k.kbv = kurs.kbv ?? (j.eigenkapital !== null && j.eigenkapital > 0 ? div(marktkap, j.eigenkapital) : null)
    k.kuv = kurs.kuv ?? div(marktkap, j.umsatz)
    const ev = kurs.enterpriseValue ?? (marktkap !== null && nettoverschuldung !== null ? marktkap + nettoverschuldung : null)
    k.evEbitda = kurs.evEbitda ?? (j.ebitda !== null && j.ebitda > 0 ? div(ev, j.ebitda) : null)
    k.fcfRendite = j.freierCashflow !== null && marktkap ? div(j.freierCashflow, marktkap) : null
    k.dividendenrendite = kurs.dividendenrendite ?? (marktkap && j.dividenden !== null ? div(j.dividenden, marktkap) : null)
  } else if (kurs) {
    // Währungen verschieden: nur die reinen Yahoo-Verhältnisse übernehmen (die sind in sich stimmig)
    k.kgv = kurs.kgvTtm ?? null
    k.kbv = kurs.kbv ?? null
    k.kuv = kurs.kuv ?? null
    k.evEbitda = kurs.evEbitda ?? null
    k.dividendenrendite = kurs.dividendenrendite ?? null
  }
  return k
}

/** Summe der letzten vier Quartale (TTM) für Flussgrößen, null wenn weniger als vier vorliegen. */
export function ttm(quartale: Abschluss[], feld: 'umsatz' | 'nettogewinn' | 'freierCashflow' | 'operativerCashflow' | 'epsVerwaessert'): number | null {
  const q = quartale.filter((x) => x.zeitraum === 'Q' && x[feld] !== null).sort((a, b) => a.ende.localeCompare(b.ende)).slice(-4)
  if (q.length < 4) return null
  return q.reduce((s, x) => s + (x[feld] as number), 0)
}
