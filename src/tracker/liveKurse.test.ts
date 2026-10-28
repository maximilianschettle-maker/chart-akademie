import { describe, expect, it } from 'vitest'
import type { Candle } from '../types'
import { aktuellerKurs, vortagesSchluss } from './liveKurse'

function kerzen(closes: number[]): Candle[] {
  return closes.map((close, i) => ({ time: 1_700_000_000 + i * 86_400, open: close, high: close, low: close, close, volume: 0 }))
}

describe('liveKurse', () => {
  it('nimmt den Vortagesschluss, wenn die letzte Kerze vom selben Tag ist', () => {
        const c = kerzen([100, 101, 102])
    const letzteMs = c[2].time * 1000
    expect(vortagesSchluss(c, letzteMs + 3_600_000)).toBe(101)
    expect(vortagesSchluss(c, letzteMs + 86_400_000)).toBe(102)
    expect(vortagesSchluss([], 0)).toBeNull()
    expect(aktuellerKurs({ kurs: 5, kursZeit: '2026-10-28T10:00:00Z' }, { preis: 6, zeit: Date.parse('2026-10-28T11:00:00Z') })).toMatchObject({ preis: 6, live: true })
    expect(aktuellerKurs({ kurs: 5, kursZeit: '2026-10-28T10:00:00Z' }, { preis: 6, zeit: Date.parse('2026-10-28T09:00:00Z') })).toMatchObject({ preis: 5, live: false })
    expect(aktuellerKurs(null, undefined)).toBeNull()
  })
})

