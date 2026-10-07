/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, CandleDatensatz, Scenario } from '../types'
import { SZENARIEN } from '../content/szenarien'
import { autoPauseGrund } from './autoPause'
import { bewerteSzenario, erreichbareKerzen } from './szenarioGrader'
import { barVerarbeiten, neuerBroker, orderPlatzieren, marketSofort } from './broker'

const cache = new Map<string, Candle[]>()
function kerzen(sz: Scenario): Candle[] {
  let c = cache.get(sz.datensatz)
  if (!c) {
    c = (JSON.parse(readFileSync(join(process.cwd(), 'public', 'szenarien', `${sz.datensatz}.json`), 'utf8')) as CandleDatensatz).candles
    cache.set(sz.datensatz, c)
  }
  return c.slice(0, sz.endIndex + 1)
}

describe('Auto-Pause vor der Entry-Zone', () => {
  it('Trendfolge: pausiert an der Kerze vor dem Trigger (20.02. 12:00), nicht früher und nicht in der Mitte des Fensters erneut', () => {
    const sz = SZENARIEN['s-trend-btc-feb24']
    const c = kerzen(sz)
    expect(autoPauseGrund(sz, c, 278)).toBeNull() // vor Trigger − 1, obwohl die Kerze die Zone berührt
    const g = autoPauseGrund(sz, c, 279)!
    expect(g).not.toBeNull()
    expect(g.zone).toBe('50.400–51.600 $')
    expect(g.triggerErfuellt).toBe(false)
    expect(g.text).toContain('Trigger noch offen')
    expect(autoPauseGrund(sz, c, 280)!.triggerErfuellt).toBe(true)
    expect(autoPauseGrund(sz, c, 320)).toBeNull() // nach dem Fenster
  })

  it('Sweep: Kerze vor der Rückeroberung meldet „Trigger noch offen“, ab der Rückeroberung „Trigger erfüllt“', () => {
    const sz = SZENARIEN['s-sweep-btc-mai24']
    const c = kerzen(sz)
    expect(autoPauseGrund(sz, c, 232)).toBeNull()
    expect(autoPauseGrund(sz, c, 233)?.text).toContain('Trigger noch offen: Rückeroberung')
    expect(autoPauseGrund(sz, c, 234)?.text).toContain('Trigger erfüllt (Rückeroberung: 4h-Schluss wieder über 59.600 $) — jetzt die Limit-Order')
  })

  it('Range: pausiert am 05.09. 20:00 — 0,5 % über der Unterkanten-Zone, bevor der Kurs sie erreicht', () => {
    const sz = SZENARIEN['s-range-btc-sep23']
    const c = kerzen(sz)
    // Bar 380: Tief 25.806 — Zone bis 25.750, erweitert um 0,5 % = 25.879 → berührt
    expect(c[380].low).toBeGreaterThan(25750)
    expect(autoPauseGrund(sz, c, 380)).not.toBeNull()
    expect(autoPauseGrund(sz, c, 379)).toBeNull()
  })

  it('Abstand ist je Übung konfigurierbar', () => {
    const sz = SZENARIEN['s-range-btc-sep23']
    const c = kerzen(sz)
    const eng: Scenario = { ...sz, kriterien: { ...sz.kriterien, pauseAbstand: 0.001 } }
    expect(autoPauseGrund(eng, c, 380)).toBeNull() // 25.750 × 1,001 = 25.776 < Tief 25.806
    expect(autoPauseGrund(eng, c, 381)).not.toBeNull()
  })

  it('Kein-Trade-Szenarien und Übungen ohne Zone pausieren nie', () => {
    const sz = SZENARIEN['s-fakeout-btc-apr24']
    const c = kerzen(sz)
    for (let i = sz.startIndex; i <= sz.endIndex; i++) expect(autoPauseGrund(sz, c, i)).toBeNull()
  })
})

describe('Limit-Order in der Zone', () => {
  const basis = { time: 0, open: 100, high: 101, low: 99, close: 100, volume: 1 }
  const limit = { id: 'o', richtung: 'long' as const, typ: 'limit' as const, limitPreis: 95, stopLoss: 90, takeProfit: 110, menge: 1, erstelltBarIndex: 0 }

  it('wird gefüllt, auch wenn die Kerze die Zone in einem Rutsch komplett durchläuft', () => {
    let b = orderPlatzieren(neuerBroker(10000), limit)
    // Eine Kerze von 100 bis 92 und zurück — läuft durch das Limit bei 95 hindurch
    b = barVerarbeiten(b, { ...basis, time: 3600, open: 100, high: 100, low: 92, close: 98 })
    expect(b.offeneOrder).toBeNull()
    expect(b.position?.entryPreis).toBe(95)
  })

  it('bei einem Gap unter das Limit zählt das bessere Open', () => {
    let b = orderPlatzieren(neuerBroker(10000), limit)
    b = barVerarbeiten(b, { ...basis, time: 3600, open: 93, high: 96, low: 92, close: 95 })
    expect(b.position?.entryPreis).toBe(93)
  })

  it('SL und TP in derselben Kerze → deterministisch der SL (konservative Regel, siehe broker.ts)', () => {
    let b = marketSofort(neuerBroker(10000), { ...limit, typ: 'market', limitPreis: undefined }, 100, 0)
    b = barVerarbeiten(b, { ...basis, time: 3600, open: 100, high: 115, low: 85, close: 100 })
    expect(b.position).toBeNull()
    expect(b.trades[0].exitGrund).toBe('sl')
    expect(b.trades[0].exitPreis).toBeLessThan(91) // SL 90 mit Slippage
  })
})

describe('Faire Bewertung: Zone nur von einer Kerze durchlaufen', () => {
  const START = Date.UTC(2024, 0, 1) / 1000
  const ruhig = (i: number): Candle => ({ time: START + i * 3600, open: 110, high: 111, low: 109, close: 110, volume: 1 })
  const feedback = { perfekt: 'P', gut: 'G', verpasst: 'V', falsch: 'F' }
  const sz: Scenario = {
    id: 's',
    titel: 't',
    strategieId: 'sr-bounce',
    datensatz: '',
    symbol: 'X',
    interval: '1h',
    startIndex: 0,
    endIndex: 39,
    aufgabe: '',
    richtung: 'long',
    entryZone: { preisVon: 98, preisBis: 102, barVon: 10, barBis: 30 },
    kriterien: { trigger: { beschreibung: 'Rückkehr in die Zone', bar: 10 } },
    idealEntry: 100,
    idealStopLoss: 97,
    idealTakeProfit: 106,
    feedback,
    datumVerdeckt: true,
  }

  it('eine einzelne Kerze durch die Zone, keine Order → „nur Limit hätte gegriffen“ statt verpasst', () => {
    const c = Array.from({ length: 40 }, (_, i) => (i === 20 ? { ...ruhig(i), open: 110, high: 112, low: 96, close: 110 } : ruhig(i)))
    expect(erreichbareKerzen(sz, c)).toEqual([20])
    const r = bewerteSzenario(sz, c, [])
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('nurLimit')
    expect(r.text).toContain('eine einzige Kerze (01.01.2024, 20:00) hat die Entry-Zone (98–102 $) durchlaufen')
    expect(r.text).toContain('Hier hätte nur eine vorab platzierte Limit-Order gegriffen.')
    expect(r.bilanz.prozess).toBe('kein Trade')
  })

  it('zwei Kerzen in der Zone → normales verpasst', () => {
    const c = Array.from({ length: 40 }, (_, i) => (i === 20 || i === 21 ? { ...ruhig(i), low: 100 } : ruhig(i)))
    expect(erreichbareKerzen(sz, c)).toEqual([20, 21])
    const r = bewerteSzenario(sz, c, [])
    expect(r.bewertung).toBe('verpasst')
    expect(r.grund).toBe('keinTrade')
  })

  it('Mindestzahl je Übung konfigurierbar', () => {
    const c = Array.from({ length: 40 }, (_, i) => (i === 20 || i === 21 ? { ...ruhig(i), low: 100 } : ruhig(i)))
    const streng: Scenario = { ...sz, kriterien: { ...sz.kriterien, minErreichbareKerzen: 3 } }
    expect(bewerteSzenario(streng, c, []).grund).toBe('nurLimit')
  })

  it('Zone nie erreicht → weiterhin verpasst (kein Setup-Fenster zu bewerten)', () => {
    const c = Array.from({ length: 40 }, (_, i) => ruhig(i))
    expect(bewerteSzenario(sz, c, []).grund).toBe('keinTrade')
  })

  it('mit platzierter, nie gefüllter Order gilt weiterhin „Order nie gefüllt“', () => {
    const c = Array.from({ length: 40 }, (_, i) => (i === 20 ? { ...ruhig(i), low: 96 } : ruhig(i)))
    const r = bewerteSzenario(sz, c, [], { id: 'o', richtung: 'long', typ: 'limit', limitPreis: 90, stopLoss: 85, takeProfit: 110, menge: 1, erstelltBarIndex: 12 })
    expect(r.grund).toBe('orderNichtGefuellt')
  })

  it('kuratierte Übungen: die Zone ist nach dem Trigger über mehrere Kerzen erreichbar (ein echtes „verpasst“ bleibt möglich)', () => {
    for (const s of Object.values(SZENARIEN).filter((x) => x.richtung !== 'keiner')) {
      expect(erreichbareKerzen(s, kerzen(s)).length, s.id).toBeGreaterThanOrEqual(2)
    }
  })
})
