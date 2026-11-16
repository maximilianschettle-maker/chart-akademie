import { describe, it, expect } from 'vitest'
import { trackerUnion } from './union'
import { STANDARD_CONFIG, normalisiereConfig } from './katalog'
import type { TrackerConfig } from '../types'

const aus = { ausbruch: false, tunnel: false, 'ema-kreuz': false, rsi: false, setup: false } as const
const cfg = (teil: Partial<TrackerConfig>): TrackerConfig => ({ ...STANDARD_CONFIG, muster: { ...aus }, musterStunde: { ...aus }, push: false, pushStunde: false, ...teil })

describe('trackerUnion', () => {
  it('leer → Standard', () => {
    expect(trackerUnion([])).toEqual(normalisiereConfig(null))
  })
  it('vereinigt Instrumente in Erstnennungs-Reihenfolge ohne Doppelte', () => {
    const [a, b, c] = STANDARD_CONFIG.instrumente
    const u = trackerUnion([cfg({ instrumente: [b, a] }), cfg({ instrumente: [c, a] })])
    expect(u.instrumente).toEqual([b, a, c])
  })
  it('Muster und Push per ODER, aktualisiertAm = max', () => {
    const u = trackerUnion([
      cfg({ muster: { ...aus, rsi: true }, aktualisiertAm: 5 }),
      cfg({ musterStunde: { ...aus, tunnel: true }, pushStunde: true, aktualisiertAm: 9 }),
    ])
    expect(u.muster.rsi).toBe(true)
    expect(u.muster.tunnel).toBe(false)
    expect(u.musterStunde.tunnel).toBe(true)
    expect(u.push).toBe(false)
    expect(u.pushStunde).toBe(true)
    expect(u.aktualisiertAm).toBe(9)
  })
  it('wirft unbekannte Instrumente raus', () => {
    const u = trackerUnion([cfg({ instrumente: ['gibt-es-nicht', STANDARD_CONFIG.instrumente[0]] })])
    expect(u.instrumente).toEqual([STANDARD_CONFIG.instrumente[0]])
  })
})
