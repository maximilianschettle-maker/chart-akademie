import { describe, expect, it } from 'vitest'
import { intervallAusKerzen, rasteAufKerzen, terminMarker } from './termine'
import type { MakroDaten } from './types'
import { fmtRestzeit, fmtBp, fmtKorridor, naechsterTermin, fmtUhr, fmtDatum } from './format'
import { istMakroDaten, istVeraltet } from './laden'

const H = 3600

describe('termine', () => {
  const kerzen = [0, H, 2 * H, 3 * H]
  it('rastet in die Kerze, in deren Intervall die Zeit fällt', () => {
    expect(rasteAufKerzen(0, kerzen, H)).toBe(0)
    expect(rasteAufKerzen(H + 1, kerzen, H)).toBe(H)
    expect(rasteAufKerzen(3 * H + 1800, kerzen, H)).toBe(3 * H)
    expect(rasteAufKerzen(4 * H, kerzen, H)).toBeNull()
    expect(rasteAufKerzen(-1, kerzen, H)).toBeNull()
    expect(rasteAufKerzen(5, [], H)).toBeNull()
  })
  it('schätzt das Intervall', () => {
    expect(intervallAusKerzen([0, 900, 1800, 2700])).toBe(900)
    expect(intervallAusKerzen([5])).toBe(86400)
  })
  it('baut Marker für beide Banken nur innerhalb des Kerzenbereichs', () => {
    const daten = {
      version: 1,
      lastUpdated: '2026-10-28T00:00:00Z',
      quellen: {},
      fed: { zins: null, historie: [], meldungen: [], letzteEntscheidung: null, termine: [{ datum: '2026-10-28', entscheidungUtc: '2026-10-28T18:00:00Z', sep: true }] },
      ezb: { zins: null, historie: [], meldungen: [], letzteEntscheidung: null, termine: [{ datum: '2026-10-29', entscheidungUtc: '2026-10-29T13:15:00Z' }, { datum: '2026-12-17', entscheidungUtc: '2026-12-17T13:15:00Z' }] },
    } as unknown as MakroDaten
    const start = Date.parse('2026-10-28T00:00:00Z') / 1000
    const zeiten = Array.from({ length: 48 }, (_, i) => start + i * H)
    const m = terminMarker(daten, zeiten, H)
    expect(m.map((x) => [x.bank, x.zeit - start])).toEqual([
      ['fed', 18 * H],
      ['ezb', 37 * H],
    ])
    expect(m[0].sep).toBe(true)
  })
})

describe('format', () => {
  it('zeigt deutsche Ortszeit mit Zeitumstellung', () => {
    expect(fmtUhr('2026-10-28T18:00:00Z')).toBe('19:00') // Winterzeit in Berlin, USA noch Sommerzeit
    expect(fmtUhr('2026-06-17T18:00:00Z')).toBe('20:00')
    expect(fmtUhr('2026-07-23T12:15:00Z')).toBe('14:15')
    expect(fmtDatum('2026-09-17')).toBe('17.09.2026')
  })
  it('formatiert Restzeit, Basispunkte und Korridor', () => {
    const t = Date.parse('2026-10-28T18:00:00Z')
    expect(fmtRestzeit('2026-10-28T18:00:00Z', t - 5 * 60_000)).toBe('in 5 Min')
    expect(fmtRestzeit('2026-10-28T18:00:00Z', t - 2 * H * 1000 - 14 * 60_000)).toBe('in 2 Std 14 Min')
    expect(fmtRestzeit('2026-10-28T18:00:00Z', t - 2 * 86_400_000 - 5 * H * 1000)).toBe('in 2 Tagen 5 Std')
    expect(fmtRestzeit('2026-10-28T18:00:00Z', t + 1)).toBe('jetzt')
    expect(fmtBp(25)).toBe('+25 Bp')
    expect(fmtBp(-50)).toBe('−50 Bp')
    expect(fmtBp(0)).toBe('±0 Bp')
    expect(fmtKorridor(3.75, 4)).toBe('3,75–4,00 %')
  })
  it('findet den nächsten Termin mit Nachlauf', () => {
    const termine = [
      { datum: '2026-10-28', entscheidungUtc: '2026-10-28T18:00:00Z' },
      { datum: '2026-12-09', entscheidungUtc: '2026-12-09T19:00:00Z' },
    ]
    expect(naechsterTermin(termine, Date.parse('2026-10-28T19:00:00Z'))?.datum).toBe('2026-10-28')
    expect(naechsterTermin(termine, Date.parse('2026-10-28T22:00:00Z'))?.datum).toBe('2026-12-09')
    expect(naechsterTermin(termine, Date.parse('2027-01-01T00:00:00Z'))).toBeNull()
  })
})

describe('laden', () => {
  it('erkennt gültige Daten und veraltete Stände', () => {
    const d = { version: 1, lastUpdated: '2026-10-28T06:00:00Z', quellen: {}, fed: { termine: [], historie: [] }, ezb: { termine: [], historie: [] } }
    expect(istMakroDaten(d)).toBe(true)
    expect(istMakroDaten({ version: 2 })).toBe(false)
    expect(istMakroDaten(null)).toBe(false)
    expect(istVeraltet(d as unknown as MakroDaten, Date.parse('2026-10-29T06:00:00Z'))).toBe(false)
    expect(istVeraltet(d as unknown as MakroDaten, Date.parse('2026-10-30T06:00:00Z'))).toBe(true)
  })
})
