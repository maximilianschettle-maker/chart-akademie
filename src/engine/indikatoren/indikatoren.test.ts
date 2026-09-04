import { describe, it, expect } from 'vitest'
import type { Candle } from '../../types'
import { ema } from './ema'
import { rsi } from './rsi'
import { volumeProfile } from './volumeProfile'
import { liqCluster } from './liqMap'

function kerzen(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: i * 3600,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
  }))
}

describe('ema', () => {
  it('startet mit dem SMA und reagiert auf neue Werte', () => {
    const c = kerzen([10, 10, 10, 10, 20])
    const werte = ema(c, 4)
    expect(werte[2]).toBeNaN()
    expect(werte[3]).toBe(10) // SMA der ersten 4
    expect(werte[4]).toBeGreaterThan(10)
    expect(werte[4]).toBeLessThan(20)
  })
})

describe('rsi', () => {
  it('liegt bei reinen Anstiegen nahe 100 und bei reinen Verlusten nahe 0', () => {
    const steigend = rsi(kerzen(Array.from({ length: 30 }, (_, i) => 100 + i)), 14)
    expect(steigend[29]).toBeGreaterThan(95)
    const fallend = rsi(kerzen(Array.from({ length: 30 }, (_, i) => 100 - i)), 14)
    expect(fallend[29]).toBeLessThan(5)
  })
})

describe('volumeProfile', () => {
  it('legt den POC auf das meistgehandelte Preisniveau', () => {
    // 10 Kerzen um 100, eine bei 200 → POC muss nahe 100 liegen
    const c = kerzen([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 200])
    const profil = volumeProfile(c, 20)
    expect(profil.poc).toBeGreaterThan(90)
    expect(profil.poc).toBeLessThan(115)
    expect(profil.valueAreaLow).toBeLessThanOrEqual(profil.poc)
    expect(profil.valueAreaHigh).toBeGreaterThanOrEqual(profil.poc)
  })
})

describe('liqCluster', () => {
  it('erzeugt Long-Liquidationen unter Swing-Tiefs und Short-Liquidationen über Swing-Hochs', () => {
    // V-Form: eindeutiges Swing-Tief in der Mitte (99), Nachbarn strikt höher
    const closes = [
      ...Array.from({ length: 12 }, (_, i) => 110 - i),
      ...Array.from({ length: 12 }, (_, i) => 100 + i),
    ]
    const cluster = liqCluster(kerzen(closes), 5)
    const longLiqs = cluster.filter((c) => c.seite === 'long')
    expect(longLiqs.length).toBeGreaterThan(0)
    // Long-Liq eines 10x am Tief ~98: 98 * 0.9 = 88.2
    expect(Math.min(...longLiqs.map((c) => c.preis))).toBeLessThan(98)
  })
})
