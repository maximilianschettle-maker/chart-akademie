import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cikIndexBauen, cikSuchen, nameNormalisieren, reiheAus, secJahre, secQuartale, waehrungAusKonzept, type SecKonzept, type SecKonzepte } from './sec'
import { fiskalQuartal, gjEndeMonatAus } from './zeitraum'

function fixture(name: string): SecKonzepte {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as SecKonzepte
}

const aapl = fixture('sec-aapl.json')
const sap = fixture('sec-sap.json')

describe('SEC: Apple (us-gaap, 10-K/10-Q)', () => {
  const jahre = secJahre(aapl, 'USD')

  it('liefert ein Geschäftsjahr je Stichtag, aufsteigend', () => {
    expect(jahre.length).toBeGreaterThanOrEqual(10)
    expect(jahre.map((j) => j.geschaeftsjahr)).toEqual([...jahre.map((j) => j.geschaeftsjahr)].sort())
    expect(new Set(jahre.map((j) => j.geschaeftsjahr)).size).toBe(jahre.length)
  })

  it('GJ 2025: Umsatz, Gewinn, Cashflow, Schulden wie im 10-K', () => {
    const j = jahre.find((x) => x.geschaeftsjahr === 2025)!
    expect(j.ende).toBe('2025-09-27')
    expect(j.umsatz).toBe(416_161_000_000)
    expect(j.nettogewinn).toBe(112_010_000_000)
    expect(j.operativerCashflow).toBe(111_482_000_000)
    expect(j.capex).toBe(12_715_000_000)
    expect(j.freierCashflow).toBe(111_482_000_000 - 12_715_000_000)
    expect(j.epsVerwaessert).toBe(7.46)
    expect(j.eigenkapital).toBe(73_733_000_000)
    expect(j.aktienAusstehend).toBe(14_773_260_000)
    // LongTermDebt (gesamt) hat Vorrang vor lang + kurz
    expect(j.finanzschulden).toBe(90_678_000_000)
    expect(j.quellen).toEqual(['sec'])
  })

  it('nimmt den Umsatz aus dem älteren Tag "Revenues", wo der neue fehlt', () => {
    const alt = jahre.find((x) => x.geschaeftsjahr === 2016)
    expect(alt?.umsatz).toBeGreaterThan(200_000_000_000)
  })

  it('Quartalswerte aus 10-Q sind echte Quartale (keine Jahres-Summen), Q4 abgeleitet', () => {
    const q = secQuartale(aapl, 'USD', jahre)
    const gj2025 = q.filter((x) => x.geschaeftsjahr === 2025)
    expect(gj2025.map((x) => x.quartal)).toEqual([1, 2, 3, 4])
    const summe = gj2025.reduce((s, x) => s + (x.umsatz ?? 0), 0)
    expect(summe).toBe(416_161_000_000)
    // Q1 (Weihnachtsquartal) ist das größte
    expect(gj2025[0].umsatz).toBeGreaterThan(gj2025[2].umsatz!)
    // Bestandsgrößen am Quartalsende, Q4 = Jahresbilanz
    expect(gj2025[3].bilanzsumme).toBe(jahre.find((x) => x.geschaeftsjahr === 2025)!.bilanzsumme)
  })

  it('FY-Auswahl verwirft Quartalswerte, die im 10-K als fp=FY markiert sind', () => {
    const rev = aapl['us-gaap:Revenues'] as SecKonzept
    const r = reiheAus(rev, 'USD', { zeitraum: 'FY', art: 'fluss' })
    // Im Fixture stecken 10-K-Einträge mit Quartalsspanne (frame CY2018Q3) — die dürfen nicht landen
    for (const [ende, v] of r.werte) expect(v, ende).toBeGreaterThan(100_000_000_000)
  })
})

describe('SEC: SAP (ifrs-full, 20-F)', () => {
  const jahre = secJahre(sap, 'EUR')

  it('Berichtswährung aus den Einheiten raten', () => {
    expect(waehrungAusKonzept(sap['ifrs-full:Revenue']!)).toBe('EUR')
  })

  it('GJ 2025 in EUR, Schulden aus lang + kurz, EBITDA aus EBIT + Abschreibungen', () => {
    const j = jahre.find((x) => x.geschaeftsjahr === 2025)!
    expect(j.umsatz).toBe(36_800_000_000)
    expect(j.nettogewinn).toBe(7_161_000_000) // den Eigentümern zurechenbar (ohne Minderheiten)
    expect(j.waehrung).toBe('EUR')
    expect(j.finanzschulden).toBe(6_150_000_000) // Borrowings gesamt
    expect(j.ebitda).toBe(j.ebit! + 1_311_000_000)
    expect(j.capex).toBe(739_000_000)
    expect(j.rueckkaeufe).toBe(1_937_000_000)
    expect(j.aktienAusstehend).toBe(1_229_000_000)
  })

  it('20-F-Filer haben keine SEC-Quartale', () => {
    expect(secQuartale(sap, 'EUR', jahre)).toEqual([])
  })

  it('lange Historie (mehr als Yahoo)', () => {
    expect(jahre.length).toBeGreaterThanOrEqual(10)
  })
})

describe('Geschäftsjahr-Zuordnung', () => {
  it('Apple-Quartale (GJ endet September)', () => {
    expect(fiskalQuartal('2024-12-28', 9)).toEqual({ geschaeftsjahr: 2025, quartal: 1 })
    expect(fiskalQuartal('2025-03-29', 9)).toEqual({ geschaeftsjahr: 2025, quartal: 2 })
    expect(fiskalQuartal('2025-06-28', 9)).toEqual({ geschaeftsjahr: 2025, quartal: 3 })
    expect(fiskalQuartal('2025-09-27', 9)).toEqual({ geschaeftsjahr: 2025, quartal: 4 })
  })
  it('Kalenderjahr', () => {
    expect(fiskalQuartal('2026-03-31', 12)).toEqual({ geschaeftsjahr: 2026, quartal: 1 })
    expect(fiskalQuartal('2025-12-31', 12)).toEqual({ geschaeftsjahr: 2025, quartal: 4 })
  })
  it('GJ-Endmonat aus Stichtagen', () => {
    expect(gjEndeMonatAus(['2023-09-30', '2024-09-28', '2025-09-27'])).toBe(9)
    expect(gjEndeMonatAus([])).toBe(12)
  })
})

describe('CIK-Zuordnung', () => {
  const index = cikIndexBauen([
    { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
    { cik_str: 1000184, ticker: 'SAP', title: 'SAP SE' },
    { cik_str: 937966, ticker: 'ASML', title: 'ASML HOLDING NV' },
    { cik_str: 1114448, ticker: 'NVS', title: 'NOVARTIS AG' },
  ])

  it('Name normalisieren', () => {
    expect(nameNormalisieren('Apple Inc.')).toBe('apple')
    expect(nameNormalisieren('ASML Holding N.V.')).toBe('asml')
    expect(nameNormalisieren('Siemens Aktiengesellschaft')).toBe('siemens')
  })

  it('US-Ticker direkt', () => {
    expect(cikSuchen(index, 'AAPL')).toEqual({ cik: '0000320193', zuordnung: 'ticker' })
    expect(cikSuchen(index, 'aapl')).toEqual({ cik: '0000320193', zuordnung: 'ticker' })
  })

  it('EU-Symbol über den Namen', () => {
    expect(cikSuchen(index, 'SAP.DE', 'SAP SE')).toEqual({ cik: '0001000184', zuordnung: 'name' })
    expect(cikSuchen(index, 'ASML.AS', 'ASML Holding N.V.')).toEqual({ cik: '0000937966', zuordnung: 'name' })
    expect(cikSuchen(index, 'NOVN.SW', 'Novartis AG')).toEqual({ cik: '0001114448', zuordnung: 'name' })
  })

  it('EU-Symbol ohne Namen und ohne Treffer → null', () => {
    expect(cikSuchen(index, 'SIE.DE', 'Siemens Aktiengesellschaft')).toBeNull()
    expect(cikSuchen(index, 'SIE.DE')).toBeNull()
  })
})

describe('SEC: Quartals-Cashflow aus kumulierten 10-Q-Werten', () => {
  it('Apple GJ 2025: alle vier Quartale haben operativen Cashflow und FCF, Summe = Jahr', () => {
    const jahre = secJahre(aapl, 'USD')
    const q = secQuartale(aapl, 'USD', jahre).filter((x) => x.geschaeftsjahr === 2025)
    expect(q.map((x) => x.operativerCashflow !== null)).toEqual([true, true, true, true])
    expect(q.map((x) => x.freierCashflow !== null)).toEqual([true, true, true, true])
    const summe = q.reduce((s, x) => s + (x.operativerCashflow as number), 0)
    expect(summe).toBe(111_482_000_000)
    for (const x of q) expect(x.capex).toBeGreaterThan(0)
  })
})
