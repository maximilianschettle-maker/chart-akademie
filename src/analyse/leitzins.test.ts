import { describe, expect, it } from 'vitest'
import type { MakroDaten } from '../makro/types'
import { bankFuerWaehrung, leitzinsPunkte } from './leitzins'

const T = (iso: string) => Date.parse(iso) / 1000

const daten = {
  fed: { historie: [{ datum: '2024-01-01', oben: 5.5, unten: 5.25 }, { datum: '2025-06-01', oben: 4.5, unten: 4.25 }, { datum: '2026-03-01', oben: 4.0, unten: 3.75 }] },
  ezb: { historie: [{ datum: '2024-06-06', einlage: 3.75 }, { datum: '2025-09-01', einlage: 2.0 }] },
} as unknown as MakroDaten

describe('Leitzins-Overlay', () => {
  it('wählt die Bank nach Währung', () => {
    expect(bankFuerWaehrung('EUR')).toBe('ezb')
    expect(bankFuerWaehrung('USD')).toBe('fed')
    expect(bankFuerWaehrung('CHF')).toBe('fed')
  })

  it('setzt den Wert vor dem Fenster an den Anfang, nimmt Änderungen im Fenster, verlängert bis zum Ende', () => {
    const p = leitzinsPunkte(daten, 'fed', T('2025-01-01'), T('2026-10-01'))
    expect(p.map((x) => [new Date(x.time * 1000).toISOString().slice(0, 10), x.value])).toEqual([
      ['2025-01-01', 5.375],
      ['2025-06-01', 4.375],
      ['2026-03-01', 3.875],
      ['2026-10-01', 3.875],
    ])
  })

  it('EZB nutzt den Einlagesatz; ohne Daten oder leeres Fenster kommt nichts', () => {
    const p = leitzinsPunkte(daten, 'ezb', T('2025-01-01'), T('2025-12-31'))
    expect(p.map((x) => x.value)).toEqual([3.75, 2.0, 2.0])
    expect(leitzinsPunkte(null, 'ezb', 0, 10)).toEqual([])
    expect(leitzinsPunkte(daten, 'ezb', 10, 10)).toEqual([])
    // Fenster komplett vor der Historie: keine Punkte
    expect(leitzinsPunkte(daten, 'ezb', T('2020-01-01'), T('2020-12-31'))).toEqual([])
  })
})
