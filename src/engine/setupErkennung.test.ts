import { describe, it, expect } from 'vitest'
import {
  erkenneRangeBounce,
  erkenneTrendPullback,
  erkenneBreakoutRetest,
  findeSetup,
  setupZuSzenario,
} from './setupErkennung'
import type { Candle } from '../types'

function kerze(i: number, open: number, close: number, spanne = 0.5): Candle {
  return {
    time: i * 3600,
    open,
    close,
    high: Math.max(open, close) + spanne,
    low: Math.min(open, close) - spanne,
    volume: 100,
  }
}

/** Synthetische Range 100..110 mit Berührungen beider Ränder, Preis am Ende nahe der Unterkante. */
function rangeDaten(n = 200): Candle[] {
  const c: Candle[] = []
  for (let i = 0; i < n; i++) {
    const phase = (i % 40) / 40 // Dreieckswelle zwischen 100 und 110
    const wert = phase < 0.5 ? 100 + phase * 20 : 110 - (phase - 0.5) * 20
    c.push(kerze(i, wert, wert + 0.2, 0.3))
  }
  return c
}

/** Synthetischer Aufwärtstrend mit Pullback am Ende. */
function trendDaten(n = 220): Candle[] {
  const c: Candle[] = []
  for (let i = 0; i < n; i++) {
    let wert = 100 + i * 0.5 + Math.sin(i / 6) * 2
    if (i > n - 8) wert = 100 + (n - 8) * 0.5 - (i - (n - 8)) * 0.9 // Rücksetzer
    c.push(kerze(i, wert, wert + 0.1, 0.4))
  }
  return c
}

/** Decke bei 110 dreimal getestet, dann Ausbruch auf 116, dann Retest bei ~110,5. */
function breakoutDaten(): Candle[] {
  const c: Candle[] = []
  let i = 0
  for (; i < 150; i++) {
    const phase = i % 30
    const wert = phase < 15 ? 100 + phase * 0.62 : 109.3 - (phase - 15) * 0.62 // Hochs bei ~109,7
    c.push(kerze(i, wert, wert + 0.1, 0.2))
  }
  for (let k = 0; k < 6; k++, i++) c.push(kerze(i, 108 + k * 1.5, 109 + k * 1.5, 0.3)) // Ausbruch bis ~116
  for (let k = 0; k < 4; k++, i++) c.push(kerze(i, 114 - k * 1.2, 113.5 - k * 1.2, 0.3)) // Rücksetzer
  c.push(kerze(i++, 110.4, 110.6, 0.3))
  for (let k = 0; k < 90; k++, i++) c.push(kerze(i, 111 + k * 0.05, 111.1 + k * 0.05, 0.3))
  return c
}

describe('Setup-Erkennung', () => {
  it('erkennt einen Range-Bounce an der Unterkante', () => {
    const c = rangeDaten()
    // Signal dort, wo der Preis gerade zur Unterkante zurückkommt (phase ≈ 0,95)
    const i = 40 * 4 + 38
    const s = erkenneRangeBounce(c, i)
    expect(s?.strategieId).toBe('range-trading')
    expect(s?.richtung).toBe('long')
    expect(s!.idealStopLoss).toBeLessThan(100)
    expect(s!.idealTakeProfit).toBeGreaterThan(108)
  })

  it('erkennt keinen Range-Bounce in einem Trend', () => {
    expect(erkenneRangeBounce(trendDaten(), 200)).toBeNull()
  })

  it('erkennt einen Trendfolge-Pullback (long)', () => {
    const c = trendDaten()
    const s = erkenneTrendPullback(c, c.length - 1, 'long')
    expect(s?.strategieId).toBe('trendfolge-ema')
    expect(s?.richtung).toBe('long')
    expect((s!.idealTakeProfit - s!.idealEntry) / (s!.idealEntry - s!.idealStopLoss)).toBeGreaterThanOrEqual(1.5)
  })

  it('erkennt Breakout + Retest', () => {
    const c = breakoutDaten()
    const i = 150 + 6 + 4
    const s = erkenneBreakoutRetest(c, i)
    expect(s?.strategieId).toBe('breakout-retest')
    expect(s!.idealStopLoss).toBeLessThan(109.7)
    expect(s!.idealTakeProfit).toBeGreaterThan(s!.idealEntry)
  })

  it('findeSetup liefert deterministisch mit festem Zufall und baut ein Szenario', () => {
    const c = breakoutDaten()
    let seed = 0.37
    const zufall = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    const s = findeSetup(c, 60, zufall)
    expect(s).not.toBeNull()
    const sz = setupZuSzenario(s!, 'TESTUSDT', '1h', 60)
    expect(sz.generiert).toBe(true)
    expect(sz.ansageVerdeckt).toBe(true)
    expect(sz.endIndex).toBe(s!.signalIndex + 60)
    expect(sz.endIndex).toBeLessThan(c.length)
  })
})
