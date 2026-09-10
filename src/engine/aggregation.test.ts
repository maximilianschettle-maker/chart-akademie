import { describe, it, expect } from 'vitest'
import { aggregiere, intervalSekunden, bucketStart } from './aggregation'
import type { Candle } from '../types'

function reihe(n: number, sek: number, start = 0): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: start + i * sek,
    open: 100 + i,
    high: 110 + i,
    low: 90 - i,
    close: 101 + i,
    volume: 10,
  }))
}

describe('Aggregation auf höheren Timeframe', () => {
  it('erkennt das Intervall aus den Daten', () => {
    expect(intervalSekunden(reihe(10, 900))).toBe(900)
    expect(intervalSekunden(reihe(10, 3600))).toBe(3600)
  })

  it('bucketStart rundet auf den Bucket-Anfang ab', () => {
    expect(bucketStart(3600 + 1800, 3600)).toBe(3600)
    expect(bucketStart(7199, 3600)).toBe(3600)
  })

  it('fasst 4 × 15m zu einer 1h-Kerze zusammen (OHLC + Volumen)', () => {
    const k = aggregiere(reihe(4, 900), 3600)
    expect(k).toHaveLength(1)
    expect(k[0].open).toBe(100)
    expect(k[0].high).toBe(113)
    expect(k[0].low).toBe(87)
    expect(k[0].close).toBe(104)
    expect(k[0].volume).toBe(40)
  })

  it('die letzte Kerze bleibt unfertig, wenn der Bucket noch nicht voll ist', () => {
    const k = aggregiere(reihe(6, 900), 3600)
    expect(k).toHaveLength(2)
    expect(k[1].close).toBe(106)
    expect(k[1].volume).toBe(20)
  })

  it('startet neue Buckets zeitbasiert, auch bei Datenlücken', () => {
    const c = [...reihe(2, 900), ...reihe(2, 900, 3 * 3600)]
    const k = aggregiere(c, 3600)
    expect(k).toHaveLength(2)
    expect(k[1].time).toBe(3 * 3600)
  })
})
