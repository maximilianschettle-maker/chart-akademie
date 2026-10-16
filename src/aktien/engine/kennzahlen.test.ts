import { describe, expect, it } from 'vitest'
import type { Abschluss, Kurs } from '../types'
import { leererAbschluss } from './sec'
import { cagr, kennzahlen, ttm } from './kennzahlen'
import { DCF_STANDARD, basisFcf, dcf, dcfBasisAus, sensitivitaet, stufenUm } from './dcf'
import { fmtBetrag, fmtFaktor, fmtKurs, fmtProzent, zahlAus } from './format'

function jahr(gj: number, werte: Partial<Abschluss>): Abschluss {
  return { ...leererAbschluss(gj, `${gj}-12-31`, 'FY', 'EUR', 'sec'), ...werte }
}

const jahre: Abschluss[] = [
  jahr(2020, { umsatz: 100, nettogewinn: 10, freierCashflow: 12, epsVerwaessert: 1, aktienVerwaessert: 10 }),
  jahr(2021, { umsatz: 110, nettogewinn: 11, freierCashflow: 13, epsVerwaessert: 1.1, aktienVerwaessert: 10 }),
  jahr(2022, { umsatz: 121, nettogewinn: 12, freierCashflow: 14, epsVerwaessert: 1.25, aktienVerwaessert: 9.8 }),
  jahr(2023, { umsatz: 133, nettogewinn: 14, freierCashflow: 15, epsVerwaessert: 1.4, aktienVerwaessert: 9.6 }),
  jahr(2024, { umsatz: 146, nettogewinn: 15, freierCashflow: 17, epsVerwaessert: 1.6, aktienVerwaessert: 9.4 }),
  jahr(2025, {
    umsatz: 161,
    bruttogewinn: 80,
    ebit: 32,
    ebitda: 40,
    nettogewinn: 20,
    freierCashflow: 20,
    epsVerwaessert: 2.2,
    aktienVerwaessert: 9.0,
    bilanzsumme: 200,
    eigenkapital: 100,
    finanzschulden: 60,
    zahlungsmittel: 20,
    dividenden: 8,
    rueckkaeufe: 4,
    aktienAusstehend: 9.0,
  }),
]

const kurs: Kurs = { preis: 30, waehrung: 'EUR', zeit: 0, marktkap: 270, aktienAnzahl: 9 }

describe('Kennzahlen', () => {
  const k = kennzahlen(jahre, kurs, 'EUR')

  it('Margen und Renditen aus dem letzten Jahr', () => {
    expect(k.jahr).toBe(2025)
    expect(k.bruttomarge).toBeCloseTo(80 / 161)
    expect(k.ebitMarge).toBeCloseTo(32 / 161)
    expect(k.nettomarge).toBeCloseTo(20 / 161)
    expect(k.eigenkapitalrendite).toBeCloseTo(0.2)
    expect(k.eigenkapitalquote).toBeCloseTo(0.5)
    expect(k.nettoverschuldung).toBe(40)
    expect(k.nettoverschuldungZuEbitda).toBeCloseTo(1)
    expect(k.ausschuettungsquote).toBeCloseTo(0.4)
    expect(k.kapitalrueckfuehrungZuFcf).toBeCloseTo(0.6)
  })

  it('Wachstum als CAGR, Aktienzahl als Veränderung', () => {
    expect(k.umsatzWachstum1).toBeCloseTo(161 / 146 - 1)
    expect(k.umsatzWachstum5).toBeCloseTo(Math.pow(1.61, 1 / 5) - 1)
    expect(k.umsatzWachstum10).toBeNull() // nur 6 Jahre
    expect(k.epsWachstum5).toBeCloseTo(Math.pow(2.2, 1 / 5) - 1)
    expect(k.aktienVeraenderung5).toBeCloseTo(-0.1)
  })

  it('Kursbezogene Kennzahlen, wenn Währungen gleich sind', () => {
    expect(k.kgv).toBeCloseTo(30 / 2.2)
    expect(k.kbv).toBeCloseTo(2.7)
    expect(k.fcfRendite).toBeCloseTo(20 / 270)
    expect(k.dividendenrendite).toBeCloseTo(8 / 270)
    expect(k.evEbitda).toBeCloseTo((270 + 40) / 40)
  })

  it('Kurs in anderer Währung: keine selbst gerechneten Kursverhältnisse', () => {
    const k2 = kennzahlen(jahre, { ...kurs, waehrung: 'USD', kgvTtm: 14 }, 'EUR')
    expect(k2.kgv).toBe(14)
    expect(k2.fcfRendite).toBeNull()
  })

  it('Lücken und Nullen liefern null, nie NaN', () => {
    const k3 = kennzahlen([jahr(2025, { umsatz: 0, nettogewinn: -5, eigenkapital: 0 })], null, 'EUR')
    expect(k3.nettomarge).toBeNull()
    expect(k3.eigenkapitalrendite).toBeNull()
    expect(k3.kgv).toBeNull()
    expect(Object.values(k3).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false)
    expect(kennzahlen([], kurs, 'EUR').jahr).toBeNull()
  })

  it('CAGR nur für positive Werte, TTM braucht vier Quartale', () => {
    expect(cagr(100, 200, 2)).toBeCloseTo(Math.SQRT2 - 1)
    expect(cagr(-5, 10, 2)).toBeNull()
    const q = (gj: number, n: number, umsatz: number): Abschluss => ({ ...leererAbschluss(gj, `${gj}-${String(n * 3).padStart(2, '0')}-30`, 'Q', 'EUR', 'sec'), quartal: n, umsatz })
    expect(ttm([q(2025, 1, 1), q(2025, 2, 2), q(2025, 3, 3)], 'umsatz')).toBeNull()
    expect(ttm([q(2024, 4, 9), q(2025, 1, 1), q(2025, 2, 2), q(2025, 3, 3), q(2025, 4, 4)], 'umsatz')).toBe(10)
  })
})

describe('DCF', () => {
  const basis = dcfBasisAus(jahre, 9)!

  it('Basis aus den Abschlüssen', () => {
    expect(basis.fcfReihe).toEqual([12, 13, 14, 15, 17, 20])
    expect(basis.nettoschulden).toBe(40)
    expect(basis.aktien).toBe(9)
    expect(basisFcf(basis.fcfReihe, 3)).toBeCloseTo((15 + 17 + 20) / 3)
    expect(basisFcf(basis.fcfReihe, 1)).toBe(20)
  })

  it('ohne Wachstum und ohne Schulden: Wert = FCF / r (Rentenformel)', () => {
    const e = dcf({ fcfReihe: [10], nettoschulden: 0, aktien: 1 }, { ...DCF_STANDARD, basisJahre: 1, wachstum1: 0, wachstum2: 0, endwachstum: 0, diskontsatz: 10, jahre1: 5, jahre2: 5 })!
    expect(e.fairerWertJeAktie).toBeCloseTo(100, 6)
    expect(e.jahre.length).toBe(10)
    expect(e.endwertAnteil).toBeGreaterThan(0.3)
    expect(e.kaufkursMitMarge).toBeCloseTo(75, 6)
  })

  it('Nettoschulden mindern den Wert je Aktie; Diskontsatz ≤ Endwachstum → null', () => {
    const mit = dcf(basis, DCF_STANDARD)!
    const ohne = dcf({ ...basis, nettoschulden: 0 }, DCF_STANDARD)!
    expect(ohne.fairerWertJeAktie - mit.fairerWertJeAktie).toBeCloseTo(40 / 9)
    expect(dcf(basis, { ...DCF_STANDARD, diskontsatz: 2, endwachstum: 2 })).toBeNull()
  })

  it('Sensitivität: höheres Wachstum und niedrigerer Diskontsatz → höherer Wert', () => {
    const m = sensitivitaet(basis, DCF_STANDARD, stufenUm(10, 5, 3), stufenUm(9, 2, 3))
    expect(m.length).toBe(3)
    expect(m[2][0]!).toBeGreaterThan(m[0][2]!)
    expect(m[1][1]).toBeCloseTo(dcf(basis, DCF_STANDARD)!.fairerWertJeAktie)
    expect(stufenUm(9, 2, 5)).toEqual([5, 7, 9, 11, 13])
  })

  it('negativer FCF ergibt negativen Wert, kein Absturz', () => {
    const e = dcf({ fcfReihe: [-5, -3], nettoschulden: 0, aktien: 1 }, DCF_STANDARD)!
    expect(e.fairerWertJeAktie).toBeLessThan(0)
    expect(dcfBasisAus([jahr(2025, { freierCashflow: 5, aktienAusstehend: null, aktienVerwaessert: null })])).toBeNull()
  })
})

describe('Format', () => {
  it('Beträge, Prozente, Faktoren', () => {
    expect(fmtBetrag(36_800_000_000, 'EUR')).toBe('36,8 Mrd. €')
    expect(fmtBetrag(-739_000_000, 'USD')).toBe('−739,0 Mio. $')
    expect(fmtBetrag(null)).toBe('–')
    expect(fmtProzent(0.2762)).toBe('27,6 %')
    expect(fmtProzent(0.094, 1, true)).toBe('+9,4 %')
    expect(fmtProzent(-0.05)).toBe('−5,0 %')
    expect(fmtFaktor(27.78)).toBe('27,8×')
    expect(fmtKurs(199.22, 'EUR')).toBe('199,22 €')
    expect(zahlAus('9,5')).toBe(9.5)
    expect(zahlAus('abc')).toBeNull()
  })
})
