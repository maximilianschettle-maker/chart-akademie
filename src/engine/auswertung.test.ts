import { describe, it, expect } from 'vitest'
import {
  logischeTrades,
  equityKurve,
  gruppiere,
  tageszeit,
  haltedauer,
  rVerteilung,
  fehlerMuster,
} from './auswertung'
import type { Trade } from '../types'

function trade(teil: Partial<Trade>): Trade {
  return {
    id: 's1:1-2',
    richtung: 'long',
    entryPreis: 100,
    exitPreis: 106,
    entryTime: 3600,
    exitTime: 7200,
    menge: 1,
    stopLoss: 97,
    takeProfit: 106,
    pnl: 6,
    rMultiple: 2,
    exitGrund: 'tp',
    interval: '1h',
    ...teil,
  }
}

describe('Logische Trades', () => {
  it('fasst Teil-Exits desselben Einstiegs zusammen', () => {
    const lt = logischeTrades([
      trade({ id: 's1:1-2-teil', exitGrund: 'teil', pnl: 3, rMultiple: 0.5, exitTime: 5000 }),
      trade({ id: 's1:1-3-tp', exitGrund: 'tp', pnl: 4, rMultiple: 1.3, exitTime: 9000 }),
      trade({ id: 's1:9-10', entryTime: 9 * 3600, exitTime: 10 * 3600 }),
    ])
    expect(lt).toHaveLength(2)
    expect(lt[0].pnl).toBe(7)
    expect(lt[0].rMultiple).toBeCloseTo(1.8, 6)
    expect(lt[0].teilExits).toBe(2)
    expect(lt[0].exitGrund).toBe('tp')
    expect(lt[0].geplantesCrv).toBeCloseTo(2, 6)
  })

  it('trennt gleiche Entry-Zeiten verschiedener Sessions', () => {
    const lt = logischeTrades([trade({ id: 'a:1-2' }), trade({ id: 'b:1-2' })])
    expect(lt).toHaveLength(2)
  })
})

describe('Equity & Gruppen', () => {
  it('Equity-Kurve startet beim Startkapital und kumuliert', () => {
    const k = equityKurve(logischeTrades([trade({}), trade({ id: 's1:5-6', entryTime: 5 * 3600, pnl: -3 })]), 1000)
    expect(k.map((p) => p.kontostand)).toEqual([1000, 1006, 1003])
  })

  it('gruppiert nach Setup-Tag mit Trefferquote und Ø R', () => {
    const g = gruppiere(
      logischeTrades([
        trade({ strategieId: 'range-trading' }),
        trade({ id: 's1:5-6', entryTime: 5, strategieId: 'range-trading', pnl: -3, rMultiple: -1 }),
        trade({ id: 's1:8-9', entryTime: 8, strategieId: 'sr-bounce' }),
      ]),
      (t) => t.strategieId ?? 'ohne',
    )
    const range = g.find((x) => x.label === 'range-trading')!
    expect(range.anzahl).toBe(2)
    expect(range.trefferquote).toBe(50)
    expect(range.durchschnittR).toBeCloseTo(0.5, 6)
  })

  it('Tageszeit und Haltedauer', () => {
    expect(tageszeit(logischeTrades([trade({ entryTime: 10 * 3600 })])[0])).toMatch(/Europa/)
    expect(haltedauer(logischeTrades([trade({ entryTime: 0, exitTime: 5 * 3600 })])[0])).toBe('4–10 Kerzen')
    expect(haltedauer(logischeTrades([trade({ interval: undefined })])[0])).toBe('unbekannt')
  })

  it('R-Verteilung zählt in die richtigen Bins', () => {
    const bins = rVerteilung(logischeTrades([trade({ rMultiple: -1.2 }), trade({ id: 'x:2-3', entryTime: 2, rMultiple: 2.4 })]))
    expect(bins[0].anzahl).toBe(1) // < −1R
    expect(bins.find((b) => b.label.startsWith('2…'))!.anzahl).toBe(1)
  })
})

describe('Fehler-Muster', () => {
  it('erkennt zu enge Stops', () => {
    const trades = [0, 1, 2].map((i) =>
      trade({ id: `s:${i}-x`, entryTime: i * 10 * 3600, exitGrund: 'sl', stopLoss: 99.8, takeProfit: 101, pnl: -0.2, rMultiple: -1 }),
    )
    expect(fehlerMuster(logischeTrades(trades)).map((h) => h.id)).toContain('stop-zu-eng')
  })

  it('erkennt zu frühe manuelle Exits', () => {
    const trades = [0, 1, 2].map((i) =>
      trade({ id: `s:${i}-x`, entryTime: i * 10 * 3600, exitGrund: 'manuell', pnl: 0.5, rMultiple: 0.2 }),
    )
    expect(fehlerMuster(logischeTrades(trades)).map((h) => h.id)).toContain('zu-frueh-raus')
  })

  it('erkennt Übertraden direkt nach einem Verlust', () => {
    const t: Trade[] = []
    for (let i = 0; i < 3; i++) {
      const basis = i * 20 * 3600
      t.push(trade({ id: `s:${basis}-a`, entryTime: basis, exitTime: basis + 3600, pnl: -3, rMultiple: -1, exitGrund: 'sl' }))
      t.push(trade({ id: `s:${basis + 7200}-b`, entryTime: basis + 7200, exitTime: basis + 5 * 3600 }))
    }
    expect(fehlerMuster(logischeTrades(t)).map((h) => h.id)).toContain('uebertraden-nach-verlust')
  })

  it('bleibt still bei sauberem Journal', () => {
    const trades = [0, 1, 2, 3].map((i) =>
      trade({ id: `s:${i}-x`, entryTime: i * 50 * 3600, exitTime: i * 50 * 3600 + 5 * 3600, richtung: i % 2 ? 'long' : 'short', strategieId: 'range-trading' }),
    )
    expect(fehlerMuster(logischeTrades(trades))).toHaveLength(0)
  })
})
