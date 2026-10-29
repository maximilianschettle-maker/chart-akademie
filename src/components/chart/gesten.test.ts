import { describe, expect, it } from 'vitest'
import { achsenZugFaktor, verschiebeBereich, zoomBereich } from './gesten'

describe('Chart-Gesten (Rechenhelfer)', () => {
  it('zoomt um den Anker und hält den Ankerpunkt fest', () => {
    const b = { from: 100, to: 200 }
    expect(zoomBereich(b, 2, 0.5)).toEqual({ from: 50, to: 250 })
    expect(zoomBereich(b, 0.5, 0.5)).toEqual({ from: 125, to: 175 })
    // Anker am unteren Rand: from bleibt
    expect(zoomBereich(b, 2, 0)).toEqual({ from: 100, to: 300 })
    // Anker am oberen Rand: to bleibt
    expect(zoomBereich(b, 0.5, 1)).toEqual({ from: 150, to: 200 })
    // Faktor 1 ändert nichts
    expect(zoomBereich(b, 1, 0.3)).toEqual(b)
  })

  it('verschiebt einen Bereich', () => {
    expect(verschiebeBereich({ from: -0.5, to: 99.5 }, 10)).toEqual({ from: 9.5, to: 109.5 })
  })

  it('Achsen-Zug: nach unten ziehen vergrößert, nach oben verkleinert, Ruhe = 1', () => {
    expect(achsenZugFaktor(0)).toBe(1)
    expect(achsenZugFaktor(160)).toBeCloseTo(Math.E, 6)
    expect(achsenZugFaktor(-160)).toBeCloseTo(1 / Math.E, 6)
    // symmetrisch: gleiche Strecke hin und zurück hebt sich auf
    expect(achsenZugFaktor(80) * achsenZugFaktor(-80)).toBeCloseTo(1, 9)
  })
})
