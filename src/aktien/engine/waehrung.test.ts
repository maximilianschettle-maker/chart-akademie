import { describe, expect, it } from 'vitest'
import type { Fundamentaldaten, Kurs, Wechselkurs } from '../types'
import { betragUmrechnen, kursFuerKennzahlen, kursUmrechnen, paarCode, paarSymbol, wechselkursText } from './waehrung'

const kurs: Kurs = { preis: 40, waehrung: 'HKD', zeit: 1, marktkap: 80e9, enterpriseValue: 70e9, kgvTtm: 25, kbv: 2, kursziel: 50, hoch52w: 60, tief52w: 30 }
const wk: Wechselkurs = { von: 'HKD', nach: 'CNY', kurs: 0.85, standAm: 1 }

describe('Währung: Paare', () => {
  it('Yahoo-Symbol und Paarcode', () => {
    expect(paarSymbol('hkd', 'CNY')).toBe('HKDCNY=X')
    expect(paarSymbol('EUR', 'EUR')).toBeNull()
    expect(paarSymbol('', 'EUR')).toBeNull()
    expect(paarCode('usd', 'eur')).toBe('USDEUR')
  })
})

describe('Währung: Kurs umrechnen', () => {
  it('rechnet Beträge um, lässt Verhältnisse stehen', () => {
    const u = kursUmrechnen(kurs, wk)
    expect(u.waehrung).toBe('CNY')
    expect(u.preis).toBeCloseTo(34, 6)
    expect(u.marktkap).toBeCloseTo(68e9, 0)
    expect(u.enterpriseValue).toBeCloseTo(59.5e9, 0)
    expect(u.kursziel).toBeCloseTo(42.5, 6)
    expect(u.hoch52w).toBeCloseTo(51, 6)
    expect(u.kgvTtm).toBe(25)
    expect(u.kbv).toBe(2)
  })

  it('falsches Paar oder ungültiger Kurs: unverändert', () => {
    expect(kursUmrechnen(kurs, { ...wk, von: 'USD' })).toBe(kurs)
    expect(kursUmrechnen(kurs, { ...wk, kurs: 0 })).toBe(kurs)
  })

  it('kursFuerKennzahlen: gleiche Währung → Original, sonst umgerechnet, ohne Wechselkurs Original', () => {
    const basis = { firma: { symbol: 'X', name: 'X', waehrung: 'CNY', kursWaehrung: 'HKD', boerse: '' }, kurs, jahre: [], quartale: [], quellen: [], standAm: 1, hinweise: [] } as Fundamentaldaten
    expect(kursFuerKennzahlen({ ...basis, wechselkurs: wk })!.waehrung).toBe('CNY')
    expect(kursFuerKennzahlen(basis)).toBe(kurs)
    expect(kursFuerKennzahlen({ ...basis, firma: { ...basis.firma, waehrung: 'HKD' } })).toBe(kurs)
    expect(kursFuerKennzahlen({ ...basis, kurs: null })).toBeNull()
  })
})

describe('Währung: Beträge', () => {
  const kurse = { USDEUR: 0.89, HKDCNY: 0.85 }
  it('direkt, rückwärts, gleich, fehlend', () => {
    expect(betragUmrechnen(100, 'USD', 'EUR', kurse)).toBeCloseTo(89, 6)
    expect(betragUmrechnen(89, 'EUR', 'USD', kurse)).toBeCloseTo(100, 6)
    expect(betragUmrechnen(5, 'EUR', 'EUR', kurse)).toBe(5)
    expect(betragUmrechnen(5, 'GBP', 'EUR', kurse)).toBeNull()
    expect(betragUmrechnen(null, 'USD', 'EUR', kurse)).toBeNull()
  })

  it('Hinweistext', () => {
    expect(wechselkursText(wk)).toBe('1 HKD = 0,85 CNY')
    expect(wechselkursText({ von: 'JPY', nach: 'EUR', kurs: 0.0059, standAm: 1 })).toBe('1 JPY = 0,0059 EUR')
  })
})
