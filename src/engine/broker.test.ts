import { describe, it, expect } from 'vitest'
import {
  neuerBroker,
  orderPlatzieren,
  barVerarbeiten,
  positionSchliessen,
  teilSchliessen,
  stopsAendern,
  breakEven,
  mengeAusRisiko,
  TAKER_GEBUEHR,
  SLIPPAGE,
  FUNDING_RATE,
  FUNDING_INTERVALL,
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

/** Long-Position, gefüllt am Open 100 einer flachen Bar (Slippage rausgerechnet). */
function mitLongPosition(teil: Partial<Order> = {}): BrokerZustand {
  const z = orderPlatzieren(neuerBroker(10000), marketLong(teil))
  return barVerarbeiten(z, bar({ time: 1, open: 100 / (1 + SLIPPAGE), high: 100, low: 100, close: 100 }))
}

describe('Order-Fills', () => {
  it('füllt eine Market Order am Open der nächsten Bar — mit Slippage gegen den Trader', () => {
    let z = orderPlatzieren(neuerBroker(10000), marketLong())
    z = barVerarbeiten(z, bar({ time: 1, open: 101 }))
    expect(z.offeneOrder).toBeNull()
    expect(z.position?.entryPreis).toBeCloseTo(101 * (1 + SLIPPAGE), 10)
    expect(z.position?.richtung).toBe('long')
  })

  it('Short-Market füllt unter dem Open (Slippage in Gegenrichtung)', () => {
    let z = orderPlatzieren(neuerBroker(10000), marketLong({ richtung: 'short', stopLoss: 110, takeProfit: 80 }))
    z = barVerarbeiten(z, bar({ time: 1, open: 101 }))
    expect(z.position?.entryPreis).toBeCloseTo(101 * (1 - SLIPPAGE), 10)
  })

  it('füllt eine Limit Order nur, wenn der Preis das Level berührt — ohne Slippage', () => {
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

  it('merkt sich das ursprüngliche Risiko und das Setup-Tag', () => {
    const z = mitLongPosition({ strategieId: 'range-trading', menge: 2 })
    expect(z.position?.risikoBetrag).toBeCloseTo((100 - 90) * 2, 6)
    expect(z.position?.strategieId).toBe('range-trading')
  })
})

describe('SL/TP-Logik', () => {
  it('löst den Stop-Loss aus, wenn low ihn berührt (Long) — Stop läuft als Market mit Slippage', () => {
    const z = barVerarbeiten(mitLongPosition(), bar({ time: 2, low: 89 }))
    expect(z.position).toBeNull()
    expect(z.trades[0].exitGrund).toBe('sl')
    expect(z.trades[0].exitPreis).toBeCloseTo(90 * (1 - SLIPPAGE), 10)
  })

  it('löst den Take-Profit aus, wenn high ihn berührt (Long) — exakt am Limit', () => {
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
    expect(z.trades[0].exitPreis).toBeCloseTo(110 * (1 + SLIPPAGE), 10)
  })
})

describe('Trailing-Stop', () => {
  it('zieht den SL im Gewinn nach, nie zurück, und schließt mit Grund „trailing“', () => {
    let z = mitLongPosition({ trailingAbstand: 5 })
    z = barVerarbeiten(z, bar({ time: 2, high: 110, low: 99, close: 108 }))
    expect(z.position?.stopLoss).toBe(105) // 110 − 5
    z = barVerarbeiten(z, bar({ time: 3, high: 108, low: 106, close: 107 })) // Hoch fällt → SL bleibt
    expect(z.position?.stopLoss).toBe(105)
    z = barVerarbeiten(z, bar({ time: 4, high: 107, low: 104, close: 104.5 })) // berührt 105
    expect(z.position).toBeNull()
    expect(z.trades[0].exitGrund).toBe('trailing')
    expect(z.trades[0].pnl).toBeGreaterThan(0)
  })

  it('Short: Trailing folgt dem Tief nach oben begrenzt', () => {
    let z = orderPlatzieren(
      neuerBroker(10000),
      marketLong({ richtung: 'short', stopLoss: 110, takeProfit: 70, trailingAbstand: 5 }),
    )
    z = barVerarbeiten(z, bar({ time: 1, open: 100, high: 100, low: 100, close: 100 }))
    z = barVerarbeiten(z, bar({ time: 2, high: 101, low: 90, close: 92 }))
    expect(z.position?.stopLoss).toBe(95)
  })
})

describe('Teilverkauf & Break-even', () => {
  it('Teilverkauf halbiert die Menge, bucht einen Teil-Trade und lässt den Rest offen', () => {
    let z = mitLongPosition({ menge: 2 })
    z = teilSchliessen(z, 0.5, 110, 2)
    expect(z.position?.menge).toBeCloseTo(1, 10)
    expect(z.trades).toHaveLength(1)
    expect(z.trades[0].exitGrund).toBe('teil')
    expect(z.trades[0].menge).toBeCloseTo(1, 10)
  })

  it('R-Multiples der Teil-Trades addieren sich zum Gesamt-R (ursprüngliches Risiko)', () => {
    let z = mitLongPosition({ menge: 2 }) // Risiko 20 $
    z = teilSchliessen(z, 0.5, 110, 2) // +10 $ brutto → ~+0,5R
    z = positionSchliessen(z, 120, 3) // +20 $ brutto → ~+1R
    const summeR = z.trades.reduce((s, t) => s + t.rMultiple, 0)
    expect(summeR).toBeGreaterThan(1.4)
    expect(summeR).toBeLessThan(1.5)
  })

  it('Break-even setzt den SL auf den Entry; das R-Multiple bleibt am Ursprungsrisiko', () => {
    let z = mitLongPosition()
    z = breakEven(z, 110)
    expect(z.position?.stopLoss).toBe(100)
    z = barVerarbeiten(z, bar({ time: 2, high: 121, low: 105 })) // TP
    expect(z.trades[0].rMultiple).toBeGreaterThan(1.9) // nicht 0 oder Infinity
  })

  it('lehnt einen SL auf der falschen Seite des Kurses ab', () => {
    const z = mitLongPosition()
    const z2 = stopsAendern(z, 100, { stopLoss: 105 })
    expect(z2).toBe(z)
    const z3 = stopsAendern(z, 100, { takeProfit: 95 })
    expect(z3).toBe(z)
  })

  it('kann Trailing nachträglich aktivieren und deaktivieren', () => {
    let z = mitLongPosition()
    z = stopsAendern(z, 100, { trailingAbstand: 3 })
    expect(z.position?.trailingAbstand).toBe(3)
    z = stopsAendern(z, 100, { trailingAbstand: null })
    expect(z.position?.trailingAbstand).toBeUndefined()
  })
})

describe('PnL, Gebühren & Funding', () => {
  it('berechnet PnL abzüglich Taker-Gebühren (und Slippage beim manuellen Exit)', () => {
    let z = mitLongPosition({ menge: 2 })
    z = positionSchliessen(z, 110, 2)
    const exit = 110 * (1 - SLIPPAGE)
    const brutto = (exit - 100) * 2
    const gebuehr = (100 + exit) * 2 * TAKER_GEBUEHR
    expect(z.trades[0].pnl).toBeCloseTo(brutto - gebuehr, 8)
    expect(z.trades[0].gebuehren).toBeCloseTo(gebuehr, 8)
    expect(z.kontostand).toBeCloseTo(10000 + brutto - gebuehr, 8)
  })

  it('R-Multiple: Gewinn im Verhältnis zum riskierten Betrag', () => {
    let z = mitLongPosition()
    z = barVerarbeiten(z, bar({ time: 2, high: 121, low: 95 }))
    expect(z.trades[0].rMultiple).toBeGreaterThan(1.9)
    expect(z.trades[0].rMultiple).toBeLessThan(2.0)
  })

  it('Verlust am SL ergibt etwa -1R', () => {
    let z = mitLongPosition()
    z = barVerarbeiten(z, bar({ time: 2, low: 89 }))
    expect(z.trades[0].rMultiple).toBeLessThan(-0.99)
    expect(z.trades[0].rMultiple).toBeGreaterThan(-1.05)
  })

  it('Long zahlt Funding an den 8h-Marken, Short kassiert', () => {
    const t0 = FUNDING_INTERVALL * 100
    let z = orderPlatzieren(neuerBroker(10000), marketLong())
    z = barVerarbeiten(z, bar({ time: t0 - 3600, open: 100, high: 100, low: 100, close: 100 }))
    z = barVerarbeiten(z, bar({ time: t0, high: 101, low: 99, close: 100 })) // Funding-Zeitpunkt
    expect(z.position?.fundingKosten).toBeCloseTo(100 * FUNDING_RATE, 10)
    z = barVerarbeiten(z, bar({ time: t0 + 3600, high: 101, low: 99, close: 100 })) // kein Funding
    expect(z.position?.fundingKosten).toBeCloseTo(100 * FUNDING_RATE, 10)

    let s = orderPlatzieren(neuerBroker(10000), marketLong({ richtung: 'short', stopLoss: 110, takeProfit: 80 }))
    s = barVerarbeiten(s, bar({ time: t0 - 3600, open: 100, high: 100, low: 100, close: 100 }))
    s = barVerarbeiten(s, bar({ time: t0, high: 101, low: 99, close: 100 }))
    expect(s.position?.fundingKosten).toBeCloseTo(-100 * FUNDING_RATE, 10)
  })

  it('Funding landet im Trade und mindert die PnL', () => {
    const t0 = FUNDING_INTERVALL * 100
    let z = orderPlatzieren(neuerBroker(10000), marketLong())
    z = barVerarbeiten(z, bar({ time: t0 - 3600, open: 100, high: 100, low: 100, close: 100 }))
    z = barVerarbeiten(z, bar({ time: t0, high: 101, low: 99, close: 100 }))
    z = barVerarbeiten(z, bar({ time: t0 + 3600, high: 121, low: 99 })) // TP
    expect(z.trades[0].funding).toBeCloseTo(100 * FUNDING_RATE, 10)
    expect(z.trades[0].pnl).toBeLessThan(20 - (100 + 120) * TAKER_GEBUEHR) // minus Funding
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
