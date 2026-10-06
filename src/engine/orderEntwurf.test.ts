import { describe, it, expect } from 'vitest'
import {
  LEERER_ENTWURF,
  entwurfAuswerten,
  entwurfZuOrder,
  richtungWechseln,
  slAusAtr,
  tpAusR,
  type OrderEntwurf,
} from './orderEntwurf'

const basis: OrderEntwurf = { ...LEERER_ENTWURF, sl: '95', tp: '110' }

describe('entwurfAuswerten', () => {
  it('berechnet Größe aus Risiko und SL-Abstand, dazu CRV und Hebel', () => {
    const a = entwurfAuswerten(basis, 100, 10000)
    expect(a.fehler).toBeNull()
    expect(a.menge).toBeCloseTo(20, 8) // 100 $ Risiko / 5 $ Abstand
    expect(a.crv).toBeCloseTo(2, 8)
    expect(a.hebel).toBeCloseTo(0.2, 8)
    expect(a.gekappt).toBe(false)
  })

  it('begrenzt die Größe auf den Maximal-Hebel — das Risiko sinkt entsprechend', () => {
    const a = entwurfAuswerten({ ...basis, sl: '99.99', tp: '' }, 100, 10000, { maxHebel: 5 })
    expect(a.gekappt).toBe(true)
    expect(a.positionswert).toBeCloseTo(50000, 6)
    expect(a.risikoBetrag).toBeLessThan(100)
  })

  it('Take-Profit ist optional, außer er wird verlangt', () => {
    expect(entwurfAuswerten({ ...basis, tp: '' }, 100, 10000).fehler).toBeNull()
    expect(entwurfAuswerten({ ...basis, tp: '' }, 100, 10000, { tpPflicht: true }).fehler).toMatch(/Take-Profit/)
  })

  it('lehnt SL/TP auf der falschen Seite ab', () => {
    expect(entwurfAuswerten({ ...basis, sl: '101' }, 100, 10000).fehler).toMatch(/SL/)
    expect(entwurfAuswerten({ ...basis, tp: '99' }, 100, 10000).fehler).toMatch(/TP/)
    expect(entwurfAuswerten({ ...basis, richtung: 'short' }, 100, 10000).fehler).toMatch(/SL/)
  })

  it('erkennt Limit und Stop aus der Lage des Einstiegs zum Kurs', () => {
    const long = { ...basis, typ: 'preis' as const, sl: '90', tp: '' }
    expect(entwurfAuswerten({ ...long, entry: '98' }, 100, 10000).orderTyp).toBe('limit')
    expect(entwurfAuswerten({ ...long, entry: '103' }, 100, 10000).orderTyp).toBe('stop')
    const short = { ...long, richtung: 'short' as const, sl: '110' }
    expect(entwurfAuswerten({ ...short, entry: '103' }, 100, 10000).orderTyp).toBe('limit')
    expect(entwurfAuswerten({ ...short, entry: '98' }, 100, 10000).orderTyp).toBe('stop')
  })
})

describe('Entwurf-Helfer', () => {
  it('SL aus ATR setzt den TP auf 2R, wenn noch keiner da ist', () => {
    const neu = slAusAtr({ ...LEERER_ENTWURF }, 100, 2, 1.5)
    expect(Number(neu.sl)).toBeCloseTo(97, 6)
    expect(Number(neu.tp)).toBeCloseTo(106, 6)
  })

  it('TP aus R-Vielfachem', () => {
    expect(Number(tpAusR(basis, 100, 3).tp)).toBeCloseTo(115, 6)
    expect(Number(tpAusR({ ...basis, richtung: 'short', sl: '105' }, 100, 2).tp)).toBeCloseTo(90, 6)
  })

  it('Richtungswechsel spiegelt SL und TP am Einstieg', () => {
    const neu = richtungWechseln(basis, 'short', 100)
    expect(neu.richtung).toBe('short')
    expect(Number(neu.sl)).toBeCloseTo(105, 6)
    expect(Number(neu.tp)).toBeCloseTo(90, 6)
  })

  it('baut die Order: ohne TP steht 0, Stop/Limit tragen den Preis', () => {
    const e = { ...basis, typ: 'preis' as const, entry: '103', sl: '99', tp: '' }
    const order = entwurfZuOrder(e, entwurfAuswerten(e, 100, 10000), 7, true)
    expect(order.typ).toBe('stop')
    expect(order.limitPreis).toBe(103)
    expect(order.takeProfit).toBe(0)
  })
})
