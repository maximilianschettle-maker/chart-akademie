import { describe, expect, it } from 'vitest'
import { bewerteKeinTrade, bewerteTrade, simuliereTrade, zoneBei, type BewertungsKontext } from './replay'
import type { Zone } from '../engine/zonen'
import type { Candle } from '../types'

const k = (time: number, open: number, high: number, low: number, close: number): Candle => ({ time, open, high, low, close, volume: 1 })
const zone = (von: number, bis: number, text = 'Unterstützung'): Zone => ({ id: `${von}`, von, bis, art: 'unterstuetzung', beruehrungen: 3, letzterIndex: 1, staerke: 3, wichtig: true, text })

describe('Replay: Simulation', () => {
  const kerzen = [k(0, 100, 101, 99, 100), k(1, 100, 102, 99.5, 101.5), k(2, 101.5, 103, 101, 102.5), k(3, 102.5, 104, 102, 103.5), k(4, 103.5, 106, 103, 105.5)]

  it('Limit-Fill, dann Ziel', () => {
    const s = simuliereTrade(kerzen, 0, { richtung: 'long', entry: 99.8, stop: 98.8, ziel: 103 })
    expect(s).toMatchObject({ gefuellt: true, fillIndex: 1, ausgang: 'ziel', exitIndex: 2, r: 3.2 })
  })

  it('Markt läuft schon durch den Einstieg → Fill am Open', () => {
    const s = simuliereTrade(kerzen, 0, { richtung: 'long', entry: 100.5, stop: 99, ziel: 110 })
    expect(s.fillIndex).toBe(1)
    expect(s.ausgang).toBe('offen')
    expect(s.r).toBeCloseTo((105.5 - 100) / 1.5, 2)
  })

  it('Stop vor Ziel in derselben Kerze, nicht gefüllt, Short', () => {
    expect(simuliereTrade(kerzen, 0, { richtung: 'long', entry: 99.6, stop: 99.55, ziel: 102 }).ausgang).toBe('stop')
    expect(simuliereTrade(kerzen, 0, { richtung: 'long', entry: 95, stop: 94, ziel: 100 }).ausgang).toBe('nicht gefüllt')
    const s = simuliereTrade(kerzen, 0, { richtung: 'short', entry: 101.8, stop: 102.4, ziel: 95 })
    expect(s).toMatchObject({ gefuellt: true, fillIndex: 1, ausgang: 'stop' })
    expect(s.r).toBe(-1)
    expect(simuliereTrade(kerzen, 0, { richtung: 'long', entry: 100, stop: 100, ziel: 101 }).ausgang).toBe('nicht gefüllt')
  })
})

describe('Replay: Bewertung', () => {
  const kerzen: Candle[] = Array.from({ length: 60 }, (_, i) => k(i, 100 + (i % 5) * 0.2, 101 + (i % 5) * 0.2, 99.5 + (i % 5) * 0.2, 100.6 + (i % 5) * 0.2))
  const ctx: BewertungsKontext = { richtungTag: 'auf', zonen: [zone(99, 100)], kerzen, startIndex: 40, entscheidungIndex: 55, atr: 1 }

  it('findet die Zone am Einstieg mit Toleranz', () => {
    expect(zoneBei(ctx.zonen, 100.2, 0.3)?.von).toBe(99)
    expect(zoneBei(ctx.zonen, 100.5, 0.3)).toBeNull()
  })

  it('sauberer Long an der Zone in Tagesrichtung', () => {
    const b = bewerteTrade(ctx, { richtung: 'long', entry: 100.2, stop: 98.8, ziel: 103 })
    expect(b.bewertung).toBe('sauber')
    expect(b.kriterien.every((x) => x.ok)).toBe(true)
  })

  it('gegen den Trend, ohne Zone, Stop vor der Zone, CRV zu klein', () => {
    const b = bewerteTrade(ctx, { richtung: 'short', entry: 105, stop: 105.2, ziel: 104.9 })
    expect(b.bewertung).toBe('falsch')
    const ids = b.kriterien.filter((x) => !x.ok).map((x) => x.id)
    expect(ids).toContain('richtung')
    expect(ids).toContain('zone')
    expect(ids).toContain('stop')
    expect(ids).toContain('crv')
    const vorZone = bewerteTrade(ctx, { richtung: 'long', entry: 100.2, stop: 99.5, ziel: 103 })
    expect(vorZone.kriterien.find((x) => x.id === 'stop')?.text).toMatch(/vor der Zone/)
  })

  it('Bestätigung fehlt bei bärischer Entscheidungskerze', () => {
    const kerzen2 = kerzen.map((c, i) => (i === 55 ? k(55, 100.5, 100.8, 99.2, 99.4) : c))
    const b = bewerteTrade({ ...ctx, kerzen: kerzen2 }, { richtung: 'long', entry: 100.2, stop: 98.8, ziel: 103 })
    expect(b.kriterien.find((x) => x.id === 'bestaetigung')?.ok).toBe(false)
    expect(b.bewertung).toBe('mit Abstrichen')
  })

  it('Kein Trade ist richtig, wenn die Erkennung nichts an einer Zone findet', () => {
    const b = bewerteKeinTrade(ctx)
    expect(b.bewertung).toBe('richtig')
    expect(b.verpasst).toBeUndefined()
  })
})
