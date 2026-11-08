import { describe, expect, it } from 'vitest'
import { rundeAusKerzen, waehleZufall } from './daten'
import type { Candle } from '../types'

const k = (time: number): Candle => ({ time, open: 1, high: 2, low: 0, close: 1, volume: 1 })
const TAG = 86_400

describe('Top-Down-Runde aus Kerzen', () => {
  // 400 Tage Tageskerzen, Stundenkerzen über dieselben 400 Tage (24 je Tag)
  const tag = Array.from({ length: 400 }, (_, i) => k(i * TAG))
  const stunde = Array.from({ length: 400 * 24 }, (_, i) => k(i * 3600))

  it('T liegt nach 100 Tageskerzen und lässt 30 Stundenkerzen Nachlauf', () => {
    const frueh = rundeAusKerzen({ name: 'Gold', symbol: 'GC=F', waehrung: 'USD' }, tag, stunde, () => 0)
    expect(frueh).not.toBeNull()
    expect(frueh!.endeZeit).toBeGreaterThanOrEqual(tag[100].time)
    expect(frueh!.tag.length).toBeGreaterThanOrEqual(100)
    expect(frueh!.stundeNach!.length).toBeGreaterThanOrEqual(30)
    const spaet = rundeAusKerzen({ name: 'Gold', symbol: 'GC=F', waehrung: 'USD' }, tag, stunde, () => 0.999999)
    expect(spaet!.stundeNach!.length).toBeGreaterThanOrEqual(30)
    expect(spaet!.stunde.length).toBeLessThanOrEqual(400)
    expect(spaet!.tag.length).toBeLessThanOrEqual(300)
    // alle Tageskerzen liegen vor T
    expect(spaet!.tag.every((c) => c.time <= spaet!.endeZeit)).toBe(true)
  })

  it('null bei zu wenig Spanne', () => {
    expect(rundeAusKerzen({ name: 'x', symbol: 'x', waehrung: 'USD' }, tag.slice(0, 50), stunde, () => 0.5)).toBeNull()
    expect(rundeAusKerzen({ name: 'x', symbol: 'x', waehrung: 'USD' }, tag, stunde.slice(0, 100), () => 0.5)).toBeNull()
  })

  it('Zufallsauswahl bleibt in der Liste', () => {
    expect(waehleZufall([1, 2, 3], () => 0.999)).toBe(3)
    expect(waehleZufall([1, 2, 3], () => 0)).toBe(1)
  })
})
