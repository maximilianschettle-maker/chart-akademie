import { describe, expect, it } from 'vitest'
import { MAX_FIRMEN, VERGLEICH_GRUPPEN, besteSpalte, symboleAusText } from './vergleich'

describe('Firmenvergleich: Symbole aus Text', () => {
  it('trennt an Komma, Leerzeichen und Semikolon, schreibt groß, entfernt Doppelte', () => {
    expect(symboleAusText('sap.de, aapl ;MSFT sap.de\nasml.as')).toEqual(['SAP.DE', 'AAPL', 'MSFT', 'ASML.AS'])
  })

  it('lässt Unsinn weg und begrenzt auf MAX_FIRMEN', () => {
    expect(symboleAusText('a b c d e f g h')).toHaveLength(MAX_FIRMEN)
    expect(symboleAusText('ok, nicht/erlaubt, ')).toEqual(['OK'])
    expect(symboleAusText('')).toEqual([])
  })
})

describe('Firmenvergleich: beste Spalte', () => {
  it('hoch: größter Wert; niedrig: kleinster, auch negativ', () => {
    expect(besteSpalte([0.1, 0.3, null, 0.2], 'hoch')).toBe(1)
    expect(besteSpalte([1.5, -0.2, 0.4], 'niedrig')).toBe(1)
  })

  it('niedrigPositiv ignoriert Werte ≤ 0 (negatives KGV = Verlust)', () => {
    expect(besteSpalte([-5, 12, 30], 'niedrigPositiv')).toBe(1)
    expect(besteSpalte([-5, 12, null], 'niedrigPositiv')).toBeNull()
  })

  it('Gleichstand: keine Hervorhebung', () => {
    expect(besteSpalte([0, 0], 'hoch')).toBeNull()
    expect(besteSpalte([0.02, 0.02, 0.01], 'hoch')).toBeNull()
    expect(besteSpalte([0.02, 0.03, 0.03], 'hoch')).toBeNull()
    expect(besteSpalte([0.02, 0.03, 0.01], 'hoch')).toBe(1)
  })

  it('ohne Richtung oder mit weniger als zwei Werten keine Hervorhebung', () => {
    expect(besteSpalte([1, 2], 'keine')).toBeNull()
    expect(besteSpalte([1, null], 'hoch')).toBeNull()
    expect(besteSpalte([], 'hoch')).toBeNull()
  })
})

describe('Firmenvergleich: Zeilendefinition', () => {
  it('alle Zeilen-IDs sind eindeutig und jede Gruppe hat Zeilen', () => {
    const ids = VERGLEICH_GRUPPEN.flatMap((g) => g.zeilen.map((z) => z.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const g of VERGLEICH_GRUPPEN) expect(g.zeilen.length).toBeGreaterThan(0)
  })
})
