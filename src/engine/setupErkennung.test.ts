import { describe, it, expect } from 'vitest'
import {
  erkenneRangeBounce,
  erkenneTrendPullback,
  erkenneBreakoutRetest,
  erkenneAn,
  findeSetup,
  setupZuSzenario,
  type ErkanntesSetup,
} from './setupErkennung'
import type { Candle } from '../types'

// Synthetische Daten prüfen die Grundlogik; die echten Datensätze werden in
// setupErkennung.real.test.ts geprüft.

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

/** Synthetische Range 100..110 mit Berührungen beider Ränder. */
function rangeDaten(n = 240): Candle[] {
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

/** Decke bei ~109,7 dreimal getestet, Ausbruch auf 116, Retest bei ~110,5, danach Anstieg. */
function breakoutDaten(): Candle[] {
  const c: Candle[] = []
  let i = 0
  for (; i < 150; i++) {
    const phase = i % 30
    const wert = phase < 15 ? 100 + phase * 0.62 : 109.3 - (phase - 15) * 0.62
    c.push(kerze(i, wert, wert + 0.1, 0.2))
  }
  for (let k = 0; k < 6; k++, i++) c.push(kerze(i, 108 + k * 1.5, 109 + k * 1.5, 0.3)) // Ausbruch bis ~116
  for (let k = 0; k < 4; k++, i++) c.push(kerze(i, 114 - k * 1.2, 113.5 - k * 1.2, 0.3)) // Rücksetzer
  c.push(kerze(i++, 110.4, 110.6, 0.3))
  for (let k = 0; k < 90; k++, i++) c.push(kerze(i, 111 + k * 0.05, 111.1 + k * 0.05, 0.3))
  return c
}

function scanne(c: Candle[], von: number, bis: number, f: (c: Candle[], i: number) => ErkanntesSetup | null) {
  const treffer: ErkanntesSetup[] = []
  for (let i = von; i <= bis; i++) {
    const s = f(c, i)
    if (s) treffer.push(s)
  }
  return treffer
}

describe('Setup-Erkennung (synthetisch)', () => {
  it('erkennt einen Range-Bounce an der Unterkante — genau einmal pro Anlauf', () => {
    const c = rangeDaten()
    const t = scanne(c, 150, 239, erkenneRangeBounce)
    expect(t.length).toBeGreaterThan(0)
    expect(t.length).toBeLessThanOrEqual(3) // 240 Bars, Anlauf alle 40 Bars
    expect(t[0].richtung).toBe('long')
    expect(t[0].idealStopLoss).toBeLessThan(100)
    expect(t[0].idealTakeProfit).toBeGreaterThan(108)
  })

  it('erkennt keinen Range-Bounce in einem Trend', () => {
    expect(scanne(trendDaten(), 150, 219, erkenneRangeBounce)).toHaveLength(0)
  })

  it('erkennt einen Trendfolge-Pullback (long) beim ersten EMA-Kontakt', () => {
    const c = trendDaten()
    const t = scanne(c, 200, c.length - 1, (c, i) => erkenneTrendPullback(c, i, 'long'))
    expect(t.length).toBeGreaterThan(0)
    const s = t[0]
    expect(s.strategieId).toBe('trendfolge-ema')
    expect((s.idealTakeProfit - s.idealEntry) / (s.idealEntry - s.idealStopLoss)).toBeGreaterThanOrEqual(1.5)
  })

  it('erkennt Breakout + Retest beim ersten Rücklauf auf die Decke', () => {
    const c = breakoutDaten()
    const t = scanne(c, 155, 175, erkenneBreakoutRetest)
    expect(t.length).toBeGreaterThan(0)
    expect(t[0].idealStopLoss).toBeLessThan(109.7)
    expect(t[0].idealTakeProfit).toBeGreaterThan(t[0].idealEntry)
  })

  it('erkenneAn liefert für ruhige Daten ohne Struktur nichts', () => {
    const flach = Array.from({ length: 300 }, (_, i) => kerze(i, 100, 100.05, 0.1))
    expect(scanne(flach, 150, 299, erkenneAn)).toHaveLength(0)
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
