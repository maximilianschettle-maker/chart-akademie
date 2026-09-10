import { describe, it, expect } from 'vitest'
import { bewerteSzenario } from './szenarioGrader'
import type { Candle, Scenario, Trade } from '../types'

const candles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
  time: i * 3600,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1,
}))

const feedback = { perfekt: 'P', ok: 'O', verpasst: 'V', falsch: 'F' }

const setup: Scenario = {
  id: 's',
  titel: 't',
  strategieId: 'range-trading',
  datensatz: '',
  symbol: 'X',
  interval: '1h',
  startIndex: 10,
  endIndex: 49,
  aufgabe: '',
  richtung: 'long',
  entryZone: { preisVon: 98, preisBis: 102, barVon: 10, barBis: 30 },
  idealEntry: 100,
  idealStopLoss: 97,
  idealTakeProfit: 106,
  feedback,
  datumVerdeckt: true,
}

function trade(teil: Partial<Trade>): Trade {
  return {
    id: 't',
    richtung: 'long',
    entryPreis: 100,
    exitPreis: 106,
    entryTime: 20 * 3600,
    exitTime: 30 * 3600,
    menge: 1,
    stopLoss: 97,
    takeProfit: 106,
    pnl: 6,
    rMultiple: 2,
    exitGrund: 'tp',
    ...teil,
  }
}

describe('Szenario-Bewertung', () => {
  it('perfekt: Zone, SL-Seite, CRV ≥ 1,5', () => {
    expect(bewerteSzenario(setup, candles, [trade({})]).bewertung).toBe('perfekt')
  })
  it('ok: Zone getroffen, CRV zu klein', () => {
    expect(bewerteSzenario(setup, candles, [trade({ takeProfit: 103 })]).bewertung).toBe('ok')
  })
  it('falsch: außerhalb der Zeit-Zone', () => {
    expect(bewerteSzenario(setup, candles, [trade({ entryTime: 40 * 3600 })]).bewertung).toBe('falsch')
  })
  it('verpasst: kein Trade', () => {
    expect(bewerteSzenario(setup, candles, []).bewertung).toBe('verpasst')
  })
  it('addiert Teil-Trades desselben Einstiegs zum Gesamt-R', () => {
    const r = bewerteSzenario(setup, candles, [
      trade({ id: 'a', rMultiple: 0.5, exitGrund: 'teil' }),
      trade({ id: 'b', rMultiple: 1.2 }),
    ])
    expect(r.rMultiple).toBeCloseTo(1.7, 6)
  })

  describe('Kein-Trade-Szenario', () => {
    const keinTrade: Scenario = { ...setup, richtung: 'keiner', alternativRichtung: 'short', entryZone: undefined }
    it('kein Trade → perfekt', () => {
      expect(bewerteSzenario(keinTrade, candles, []).bewertung).toBe('perfekt')
    })
    it('Trade in Alternativrichtung → ok', () => {
      expect(bewerteSzenario(keinTrade, candles, [trade({ richtung: 'short' })]).bewertung).toBe('ok')
    })
    it('anderer Trade → falsch', () => {
      expect(bewerteSzenario(keinTrade, candles, [trade({})]).bewertung).toBe('falsch')
    })
  })
})
