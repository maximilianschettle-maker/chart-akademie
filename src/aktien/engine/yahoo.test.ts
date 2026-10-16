import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { firmaAusQuoteSummary, gjEndeMonatAusQuoteSummary, kursAusQuoteSummary, suchtrefferAus, yahooJahre, yahooQuartale, type QuoteSummaryRoh, type ZeitreihenZeile } from './yahoo'
import { abschluesseVereinen, fundamentaldatenBauen } from './normalisierung'
import { secJahre, type SecKonzepte } from './sec'

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T
}

const qs = fixture<QuoteSummaryRoh>('yahoo-sap-quotesummary.json')
const jahreRoh = fixture<ZeitreihenZeile[]>('yahoo-sap-jahre.json')
const quartaleRoh = fixture<ZeitreihenZeile[]>('yahoo-sap-quartale.json')

describe('Yahoo: Firma und Kurs', () => {
  it('Firma aus quoteSummary', () => {
    const f = firmaAusQuoteSummary('SAP.DE', qs)
    expect(f.name).toBe('SAP SE')
    expect(f.waehrung).toBe('EUR')
    expect(f.kursWaehrung).toBe('EUR')
    expect(f.boerse).toBe('XETRA')
    expect(f.sektor).toBe('Technology')
    expect(f.land).toBe('Germany')
  })

  it('Kurs mit Bewertungskennzahlen', () => {
    const k = kursAusQuoteSummary(qs)!
    expect(k.preis).toBeCloseTo(199.22, 2)
    expect(k.marktkap).toBeGreaterThan(200e9)
    expect(k.kgvTtm).toBeGreaterThan(10)
    expect(k.dividendenrendite).toBeGreaterThan(0.005)
    expect(k.zeit).toBeGreaterThan(1_700_000_000)
  })

  it('Geschäftsjahresende', () => {
    expect(gjEndeMonatAusQuoteSummary(qs)).toBe(12)
  })
})

describe('Yahoo: Abschlüsse', () => {
  const jahre = yahooJahre(jahreRoh, 'EUR')

  it('überspringt Randjahre mit wenigen Feldern, Beträge mit positivem Vorzeichen', () => {
    expect(jahre.map((j) => j.geschaeftsjahr)).toEqual([2022, 2023, 2024, 2025])
    const j = jahre[3]
    expect(j.umsatz).toBe(36_800_000_000)
    expect(j.capex).toBe(739_000_000)
    expect(j.dividenden).toBe(2_743_000_000)
    expect(j.rueckkaeufe).toBe(1_937_000_000)
    expect(j.freierCashflow).toBe(8_417_000_000)
    expect(j.finanzschulden).toBe(7_476_000_000)
    expect(j.quellen).toEqual(['yahoo'])
  })

  it('Quartale mit Geschäftsjahr und Nummer', () => {
    const q = yahooQuartale(quartaleRoh, 'EUR', 12)
    const letzte = q[q.length - 1]
    expect(letzte.ende).toBe('2026-06-30')
    expect(letzte.geschaeftsjahr).toBe(2026)
    expect(letzte.quartal).toBe(2)
    expect(letzte.umsatz).toBe(9_878_000_000)
  })
})

describe('Zusammenführen SEC + Yahoo', () => {
  const sap = fixture<SecKonzepte>('sec-sap.json')
  const sec = secJahre(sap, 'EUR')
  const yahoo = yahooJahre(jahreRoh, 'EUR')

  it('SEC gewinnt, Yahoo füllt nur Lücken; alte Jahre bleiben SEC-only', () => {
    const hinweise: string[] = []
    const alle = abschluesseVereinen(sec, yahoo, hinweise)
    expect(hinweise).toEqual([])
    const j2025 = alle.find((a) => a.geschaeftsjahr === 2025)!
    expect(j2025.nettogewinn).toBe(7_161_000_000)
    expect(j2025.finanzschulden).toBe(6_150_000_000) // SEC
    expect(j2025.quellen[0]).toBe('sec') // Yahoo darf nur Lücken füllen (z.B. Dividenden)
    expect(alle.find((a) => a.geschaeftsjahr === 2016)!.quellen).toEqual(['sec'])
    expect(alle.length).toBe(sec.length)
  })

  it('andere Währung: Beträge aus Yahoo werden nicht gemischt', () => {
    const hinweise: string[] = []
    const secUsd = sec.map((a) => ({ ...a, waehrung: 'USD', capex: null }))
    const alle = abschluesseVereinen(secUsd, yahoo, hinweise)
    expect(alle.find((a) => a.geschaeftsjahr === 2025)!.capex).toBeNull()
    expect(hinweise.length).toBe(1)
  })

  it('Fundamentaldaten ohne SEC-Teil tragen einen Hinweis', () => {
    const f = fundamentaldatenBauen({ firma: firmaAusQuoteSummary('SAP.DE', qs), jahre: yahoo, quartale: [], standAm: 1 }, null, kursAusQuoteSummary(qs), 1)!
    expect(f.quellen).toEqual(['yahoo'])
    expect(f.hinweise[0]).toMatch(/Keine SEC-Daten/)
    expect(f.jahre.length).toBe(4)
  })

  it('Suchtreffer: nur Aktien', () => {
    const t = suchtrefferAus({
      quotes: [
        { symbol: 'SIE.DE', longname: 'Siemens Aktiengesellschaft', exchDisp: 'XETRA', quoteType: 'EQUITY' },
        { symbol: 'XYZ', shortname: 'Fonds', exchDisp: 'NAS', quoteType: 'ETF' },
      ],
    })
    expect(t).toEqual([{ symbol: 'SIE.DE', name: 'Siemens Aktiengesellschaft', boerse: 'XETRA', typ: 'EQUITY' }])
  })
})
