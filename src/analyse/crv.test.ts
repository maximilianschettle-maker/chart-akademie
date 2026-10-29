import { describe, expect, it } from 'vitest'
import { crvBerechnen, rundePreis, stopAusProzent, zielAusR } from './crv'

describe('CRV-Rechner', () => {
  it('Long: Stückzahl aus Kontorisiko, CRV aus Abständen', () => {
    const r = crvBerechnen({ richtung: 'long', konto: 10_000, risikoProzent: 1, entry: 100, stop: 95, ziel: 115 })
    expect(r.risikoBetrag).toBe(100)
    expect(r.risikoJeStueck).toBe(5)
    expect(r.chanceJeStueck).toBe(15)
    expect(r.stueck).toBe(20)
    expect(r.positionswert).toBe(2000)
    expect(r.positionAnteil).toBeCloseTo(0.2)
    expect(r.crv).toBe(3)
    expect(r.gewinnBeiZiel).toBe(300)
    expect(r.verlustBeiStop).toBe(100)
    expect(r.stopProzent).toBe(5)
    expect(r.zielProzent).toBe(15)
    expect(r.probleme).toEqual([])
  })

  it('Short: Stop über, Ziel unter dem Einstieg', () => {
    const r = crvBerechnen({ richtung: 'short', konto: 5_000, risikoProzent: 2, entry: 50, stop: 52, ziel: 44 })
    expect(r.risikoBetrag).toBe(100)
    expect(r.stueck).toBe(50)
    expect(r.crv).toBe(3)
    expect(r.probleme).toEqual([])
  })

  it('meldet falsch liegende Stops/Ziele und liefert dann 0 Stück', () => {
    const r = crvBerechnen({ richtung: 'long', konto: 10_000, risikoProzent: 1, entry: 100, stop: 105, ziel: 90 })
    expect(r.stueck).toBe(0)
    expect(r.crv).toBe(0)
    expect(r.probleme).toContain('Stop muss unter dem Einstieg liegen')
    expect(r.probleme).toContain('Ziel muss über dem Einstieg liegen')
  })

  it('rundet die Stückzahl ab (nie mehr Risiko als erlaubt)', () => {
    const r = crvBerechnen({ richtung: 'long', konto: 10_000, risikoProzent: 1, entry: 100, stop: 97, ziel: 110 })
    expect(r.stueck).toBe(33)
    expect(r.verlustBeiStop).toBeCloseTo(99)
  })

  it('Hilfen: Stop aus Prozent, Ziel aus R, Preisrundung', () => {
    expect(stopAusProzent(100, 2, 'long')).toBe(98)
    expect(stopAusProzent(100, 2, 'short')).toBe(102)
    expect(zielAusR(100, 98, 3, 'long')).toBe(106)
    expect(zielAusR(100, 102, 2, 'short')).toBe(96)
    expect(rundePreis(123.456789)).toBe(123.46)
    expect(rundePreis(12.34567)).toBe(12.346)
    expect(rundePreis(0.123456)).toBe(0.12346)
  })
})
