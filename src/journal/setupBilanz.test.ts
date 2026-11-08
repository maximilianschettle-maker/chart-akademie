import { describe, expect, it } from 'vitest'
import { einordnung, setupBilanz, zelle, type BilanzPunkt } from './setupBilanz'

describe('Setup-Bilanz', () => {
  it('Zelle: Trefferquote, Erwartungswert, Ø Gewinn/Verlust, Profit-Faktor', () => {
    const z = zelle([2, -1, 1.5, -1, -1, 3])
    expect(z.anzahl).toBe(6)
    expect(z.gewinner).toBe(3)
    expect(z.trefferquote).toBe(0.5)
    expect(z.summeR).toBe(3.5)
    expect(z.erwartungR).toBeCloseTo(0.58, 2)
    expect(z.gewinnR).toBeCloseTo(2.17, 2)
    expect(z.verlustR).toBe(-1)
    expect(z.profitFaktor).toBeCloseTo(6.5 / 3, 2)
    expect(zelle([1, 2]).profitFaktor).toBe(Infinity)
    expect(zelle([-1]).profitFaktor).toBe(0)
    expect(zelle([]).anzahl).toBe(0)
  })

  it('Zeilen je Setup und Quelle, bestes Setup zuerst', () => {
    const p: BilanzPunkt[] = [
      { strategieId: 'breakout-retest', quelle: 'simulator', r: 2 },
      { strategieId: 'breakout-retest', quelle: 'simulator', r: -1 },
      { strategieId: 'breakout-retest', quelle: 'echt', r: 1.5 },
      { strategieId: 'range-trading', quelle: 'uebung', r: -1 },
      { strategieId: 'range-trading', quelle: 'topdown', r: -1 },
      { strategieId: 'range-trading', quelle: 'echt', r: NaN },
    ]
    const z = setupBilanz(p)
    expect(z.map((x) => x.strategieId)).toEqual(['breakout-retest', 'range-trading'])
    expect(z[0].gesamt.anzahl).toBe(3)
    expect(z[0].jeQuelle.simulator?.anzahl).toBe(2)
    expect(z[0].jeQuelle.echt?.erwartungR).toBe(1.5)
    expect(z[0].jeQuelle.uebung).toBeUndefined()
    expect(z[1].gesamt.anzahl).toBe(2) // NaN fällt heraus
    expect(z[1].gesamt.erwartungR).toBe(-1)
  })

  it('Einordnung in Worten', () => {
    expect(einordnung(zelle([1, 1]))).toBe('zu wenige Trades')
    expect(einordnung(zelle(Array(10).fill(0.5)))).toBe('positiv, noch dünn')
    expect(einordnung(zelle(Array(25).fill(0.5)))).toBe('verdient Geld')
    expect(einordnung(zelle([...Array(20).fill(0.1), ...Array(5).fill(0.2)]))).toBe('knapp positiv')
    expect(einordnung(zelle(Array(25).fill(-0.2)))).toBe('verliert Geld')
  })
})
