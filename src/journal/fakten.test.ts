import { describe, expect, it } from 'vitest'
import { einstiegsIndex, exkursion, faktenSammeln, heuteVorher, swingVorEinstieg, trendAus } from './fakten'
import { neuerEintrag } from './engine'
import type { Candle } from '../types'
import type { JournalEintrag } from './types'

function kerze(time: number, open: number, high: number, low: number, close: number): Candle {
  return { time, open, high, low, close, volume: 1 }
}

/** Aufwärtstrend: 120 Kerzen mit leichtem Anstieg, ein Swing-Tief bei Index 100 */
function aufwaerts(): Candle[] {
  const k: Candle[] = []
  for (let i = 0; i < 120; i++) {
    const basis = 100 + i * 0.5
    const tief = i === 100 ? basis - 3 : basis - 0.4
    k.push(kerze(1_700_000_000 + i * 900, basis, basis + 0.6, tief, basis + 0.3))
  }
  return k
}

const ENTWURF = {
  markt: 'Nasdaq 100',
  symbol: '^NDX',
  waehrung: 'USD',
  richtung: 'long' as const,
  entryTime: 1_700_000_000 + 110 * 900 + 100,
  entryPreis: 155.3,
  stopLoss: 151.5,
  takeProfit: 163,
  risikoProzent: 1,
  strategieId: 'trendfolge-ema',
  zeitrahmen: '15m' as const,
  imPlan: true,
}

describe('Fakten für die KI-Prüfung', () => {
  const k = aufwaerts()

  it('Einstiegskerze: letzte Kerze mit time ≤ Einstieg', () => {
    expect(einstiegsIndex(k, ENTWURF.entryTime)).toBe(110)
    expect(einstiegsIndex(k, k[0].time - 1)).toBe(-1)
    expect(einstiegsIndex(k, k[119].time + 5000)).toBe(119)
  })

  it('Trend aus EMA 20/50 und Steigung', () => {
    const t = trendAus(k, 110)
    expect(t?.trend).toBe('auf')
    expect(t?.lage).toContain('EMA 50 steigend')
    const ab = [...k].map((c, i) => kerze(c.time, 200 - i * 0.5, 200 - i * 0.5 + 0.4, 200 - i * 0.5 - 0.6, 200 - i * 0.5 - 0.3))
    expect(trendAus(ab, 110)?.trend).toBe('ab')
    expect(trendAus(k, 10)).toBeNull()
  })

  it('Swing-Tief vor dem Einstieg und Lage des Stops', () => {
    expect(swingVorEinstieg(k, 110, 'long')).toBe(100 + 100 * 0.5 - 3) // 147
    expect(swingVorEinstieg(k, 110, 'short')).toBeNull() // stetig steigende Hochs haben kein Swing-Hoch
  })

  it('MFE/MAE in R bis zum Ausstieg', () => {
    const e = { richtung: 'long' as const, entryPreis: 155.3, stopLoss: 151.5, exitTime: k[115].time }
    const ex = exkursion(k, 110, e)
    expect(ex?.kerzen).toBe(5)
    expect(ex!.mfeR).toBeGreaterThan(0)
    expect(ex!.maeR).toBeLessThanOrEqual(0)
    expect(exkursion(k, 119, e)).toBeNull()
  })

  it('Trades und Verluste am selben Tag vor dem Einstieg', () => {
    const e = neuerEintrag(ENTWURF, 1)
    const frueher: JournalEintrag = { ...neuerEintrag({ ...ENTWURF, entryTime: ENTWURF.entryTime - 3600 }, 2), status: 'geschlossen', exitPreis: 151.5, exitTime: ENTWURF.entryTime - 1800, exitGrund: 'stop' }
    const spaeter = neuerEintrag({ ...ENTWURF, entryTime: ENTWURF.entryTime + 3600 }, 3)
    expect(heuteVorher([e, frueher, spaeter], e)).toEqual({ tradesVorher: 1, verlusteVorher: 1 })
  })

  it('Fakten ohne Kerzen bleiben null, mit Kerzen gefüllt, Ergebnis nur auf Wunsch', () => {
    const e = neuerEintrag(ENTWURF, 1)
    const ohne = faktenSammeln(e, null, [e], null, false)
    expect(ohne.kerzen).toBeNull()
    expect(ohne.trend).toBeNull()
    expect(ohne.crv).toBeCloseTo(2.03, 2)
    expect(ohne.setupBehauptet).toBe('Trendfolge-Pullback')
    const mit = faktenSammeln(e, k, [e], '15m', false)
    expect(mit.kerzen).toEqual({ intervall: '15m', vorEinstieg: 111, nachEinstieg: 9 })
    expect(mit.trend).toBe('auf')
    expect(mit.atr).toBeGreaterThan(0)
    expect(mit.stopInAtr).toBeGreaterThan(0)
    expect(mit.struktur).toEqual({ preis: 147, stopDahinter: false })
    expect(mit.ergebnis).toBeNull()
    const zu: JournalEintrag = { ...e, status: 'geschlossen', exitPreis: 163, exitTime: k[115].time, exitGrund: 'ziel' }
    const erg = faktenSammeln(zu, k, [zu], '15m', true)
    expect(erg.ergebnis?.r).toBeCloseTo(2.03, 2)
    expect(erg.ergebnis?.exitGrund).toBe('ziel')
    expect(erg.ergebnis?.kerzenGehalten).toBe(5)
    // ohne Wunsch kein Ergebnis, auch wenn geschlossen (Vorher-Blick)
    expect(faktenSammeln(zu, k, [zu], '15m', false).ergebnis).toBeNull()
  })
})
