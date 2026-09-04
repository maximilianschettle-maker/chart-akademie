import { describe, it, expect } from 'vitest'
import {
  neuerBroker,
  orderPlatzieren,
  barVerarbeiten,
  positionSchliessen,
  mengeAusRisiko,
  TAKER_GEBUEHR,
  type BrokerZustand,
} from './broker'
import type { Candle, Order } from '../types'

function bar(teil: Partial<Candle> & { time: number }): Candle {
  return { open: 100, high: 105, low: 95, close: 102, volume: 1000, ...teil }
}

function marketLong(teil: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    richtung: 'long',
    typ: 'market',
    stopLoss: 90,
    takeProfit: 120,
    menge: 1,
    erstelltBarIndex: 0,
    ...teil,
  }
}

describe('Order-Fills', () => {
  it('füllt eine Market Order am Open der nächsten Bar', () => {
    let z = orderPlatzieren(neuerBroker(10000), marketLong())
    z = barVerarbeiten(z, bar({ time: 1, open: 101 }))
    expect(z.offeneOrder).toBeNull()
    expect(z.position?.entryPreis).toBe(101)
    expect(z.position?.richtung).toBe('long')
  })

  it('füllt eine Limit Order nur, wenn der Preis das Level berührt', () => {
    const order = marketLong({ typ: 'limit', limitPreis: 96 })
    let z = orderPlatzieren(neuerBroker(10000), order)

    z = barVerarbeiten(z, bar({ time: 1, low: 97 })) // Level nicht berührt
    expect(z.position).toBeNull()
    expect(z.offeneOrder).not.toBeNull()

    z = barVerarbeiten(z, bar({ time: 2, low: 95.5 })) // berührt
    expect(z.position?.entryPreis).toBe(96)
  })

  it('erlaubt nur eine Order/Position gleichzeitig', () => {
    let z = orderPlatzieren(neuerBroker(10000), marketLong())
    z = orderPlatzieren(z, marketLong({ id: 'o2' }))
    expect(z.offeneOrder?.id).toBe('o1')
  })
})

describe('SL/TP-Logik', () => {
  function mitLongPosition(sl = 90, tp = 120): BrokerZustand {
    let z = orderPlatzieren(neuerBroker(10000), marketLong({ stopLoss: sl, takeProfit: tp }))
    return barVerarbeiten(z, bar({ time: 1, open: 100, high: 100, low: 100, close: 100 }))
  }

  it('löst den Stop-Loss aus, wenn low ihn berührt (Long)', () => {
    const z = barVerarbeiten(mitLongPosition(), bar({ time: 2, low: 89 }))
    expect(z.position).toBeNull()
    expect(z.trades[0].exitGrund).toBe('sl')
    expect(z.trades[0].exitPreis).toBe(90)
  })

  it('löst den Take-Profit aus, wenn high ihn berührt (Long)', () => {
    const z = barVerarbeiten(mitLongPosition(), bar({ time: 2, high: 121, low: 95 }))
    expect(z.trades[0].exitGrund).toBe('tp')
    expect(z.trades[0].exitPreis).toBe(120)
  })

  it('SL-zuerst-Regel: berühren SL und TP dieselbe Kerze, zählt der SL', () => {
    const z = barVerarbeiten(mitLongPosition(), bar({ time: 2, high: 125, low: 88 }))
    expect(z.trades[0].exitGrund).toBe('sl')
  })

  it('Short: SL liegt oben, TP unten', () => {
    const order = marketLong({ richtung: 'short', stopLoss: 110, takeProfit: 80 })
    let z = orderPlatzieren(neuerBroker(10000), order)
    z = barVerarbeiten(z, bar({ time: 1, open: 100, high: 100, low: 100, close: 100 }))
    z = barVerarbeiten(z, bar({ time: 2, high: 111, low: 99 }))
    expect(z.trades[0].exitGrund).toBe('sl')
    expect(z.trades[0].exitPreis).toBe(110)
  })
})

describe('PnL & R-Multiple', () => {
  it('berechnet PnL abzüglich Taker-Gebühren', () => {
    let z = orderPlatzieren(neuerBroker(10000), marketLong({ menge: 2 }))
    z = barVerarbeiten(z, bar({ time: 1, open: 100, high: 100, low: 100, close: 100 }))
    z = positionSchliessen(z, 110, 2)
    const brutto = (110 - 100) * 2
    const gebuehr = (100 + 110) * 2 * TAKER_GEBUEHR
    expect(z.trades[0].pnl).toBeCloseTo(brutto - gebuehr, 10)
    expect(z.kontostand).toBeCloseTo(10000 + brutto - gebuehr, 10)
  })

  it('R-Multiple: Gewinn im Verhältnis zum riskierten Betrag', () => {
    // Entry 100, SL 90 → Risiko 10/Stück. Exit am TP 120 → +20/Stück ≈ +2R (minus Gebühren)
    let z = orderPlatzieren(neuerBroker(10000), marketLong())
    z = barVerarbeiten(z, bar({ time: 1, open: 100, high: 100, low: 100, close: 100 }))
    z = barVerarbeiten(z, bar({ time: 2, high: 121, low: 95 }))
    expect(z.trades[0].rMultiple).toBeGreaterThan(1.9)
    expect(z.trades[0].rMultiple).toBeLessThan(2.0)
  })

  it('Verlust am SL ergibt etwa -1R', () => {
    let z = orderPlatzieren(neuerBroker(10000), marketLong())
    z = barVerarbeiten(z, bar({ time: 1, open: 100, high: 100, low: 100, close: 100 }))
    z = barVerarbeiten(z, bar({ time: 2, low: 89 }))
    expect(z.trades[0].rMultiple).toBeLessThan(-0.99)
    expect(z.trades[0].rMultiple).toBeGreaterThan(-1.05)
  })
})

describe('Position Sizing', () => {
  it('berechnet die Menge aus Risikobetrag und SL-Abstand', () => {
    // 100 $ Risiko, Entry 100, SL 90 → 10 Stück
    expect(mengeAusRisiko(100, 100, 90)).toBe(10)
  })
  it('gibt 0 zurück, wenn SL auf dem Entry liegt', () => {
    expect(mengeAusRisiko(100, 100, 100)).toBe(0)
  })
})
