import { describe, it, expect } from 'vitest'
import { Circle, CircleAlert, CircleCheck, CircleX } from 'lucide-react'
import { BEWERTUNG_ANZEIGE, NICHT_VERSUCHT, bewertungAnzeige } from './bewertungAnzeige'

// Jeder Status hat in der Übersicht ein eigenes Icon und eine eigene Farbe —
// „falsch“ und „verpasst“ dürfen nicht wie ein Erfolg (grüner Haken) aussehen.
describe('Ergebnis-Anzeige', () => {
  it('perfekt → grün mit Haken', () => {
    expect(BEWERTUNG_ANZEIGE.perfekt.farbe).toBe('text-long')
    expect(BEWERTUNG_ANZEIGE.perfekt.Icon).toBe(CircleCheck)
  })
  it('falsch → rot mit Kreuz', () => {
    expect(BEWERTUNG_ANZEIGE.falsch.farbe).toBe('text-short')
    expect(BEWERTUNG_ANZEIGE.falsch.Icon).toBe(CircleX)
  })
  it('gut → eigene Farbe (blau), weder grüner Haken noch rotes Kreuz', () => {
    expect(BEWERTUNG_ANZEIGE.gut.farbe).toBe('text-sky-400')
    expect(BEWERTUNG_ANZEIGE.gut.Icon).not.toBe(CircleCheck)
    expect(BEWERTUNG_ANZEIGE.gut.Icon).not.toBe(CircleX)
  })
  it('verpasst → orange, kein Haken', () => {
    expect(BEWERTUNG_ANZEIGE.verpasst.farbe).toContain('orange')
    expect(BEWERTUNG_ANZEIGE.verpasst.Icon).toBe(CircleAlert)
  })
  it('ok → gelb, kein grüner Haken', () => {
    expect(BEWERTUNG_ANZEIGE.ok.farbe).toBe('text-akzent')
    expect(BEWERTUNG_ANZEIGE.ok.Icon).not.toBe(CircleCheck)
  })
  it('nicht versucht → neutral', () => {
    expect(bewertungAnzeige(undefined)).toBe(NICHT_VERSUCHT)
    expect(NICHT_VERSUCHT.farbe).toBe('text-gedimmt')
    expect(NICHT_VERSUCHT.Icon).toBe(Circle)
  })
  it('alle Status unterscheiden sich in Icon und Farbe', () => {
    const alle = Object.values(BEWERTUNG_ANZEIGE)
    expect(new Set(alle.map((a) => a.Icon)).size).toBe(alle.length)
    expect(new Set(alle.map((a) => a.farbe)).size).toBe(alle.length)
  })
})
