/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, CandleDatensatz, Trade } from '../types'
import type { ErkanntesSetup } from './setupErkennung'
import { erkenneAn, erkenneImFenster } from './setupErkennung'
import { bewerteIdeal, rueckblick, rueckblickSumme, sucheBereich } from './rueckblick'

function bar(time: number, teil: Partial<Candle> = {}): Candle {
  return { time, open: 100, high: 101, low: 99, close: 100, volume: 1, ...teil }
}

function setup(teil: Partial<ErkanntesSetup> = {}): ErkanntesSetup {
  return {
    strategieId: 'sr-bounce',
    richtung: 'long',
    signalIndex: 2,
    entryZone: { preisVon: 98, preisBis: 102, barVon: 2, barBis: 6 },
    idealEntry: 100,
    idealStopLoss: 95,
    idealTakeProfit: 110,
    lage: '',
    merkmale: [],
    ebenen: [],
    punkte: [],
    ...teil,
  }
}

function trade(teil: Partial<Trade>): Trade {
  return {
    id: 't',
    richtung: 'long',
    entryPreis: 100,
    exitPreis: 105,
    entryTime: 3,
    exitTime: 5,
    menge: 1,
    stopLoss: 95,
    takeProfit: 110,
    pnl: 5,
    rMultiple: 1,
    exitGrund: 'manuell',
    ...teil,
  }
}

const flach = (n: number) => Array.from({ length: n }, (_, i) => bar(i))

describe('bewerteIdeal', () => {
  it('Ziel erreicht → +CRV, Einstieg ist der Schlusskurs der Signalkerze', () => {
    const c = flach(8)
    c[5] = bar(5, { high: 111 })
    const b = bewerteIdeal(c, setup(), 7)
    expect(b?.entry).toBe(100)
    expect(b?.crv).toBeCloseTo(2, 8)
    expect(b?.ergebnis).toEqual({ art: 'tp', r: 2, exitIndex: 5 })
  })

  it('Stop zuerst: berührt eine Kerze beides, zählt der Stop', () => {
    const c = flach(8)
    c[4] = bar(4, { high: 112, low: 94 })
    expect(bewerteIdeal(c, setup(), 7)?.ergebnis).toEqual({ art: 'sl', r: -1, exitIndex: 4 })
  })

  it('wertet nur bis zur letzten gespielten Kerze aus — danach bleibt der Trade offen', () => {
    const c = flach(10)
    c[4] = bar(4, { close: 102.5, high: 103 })
    c[8] = bar(8, { high: 120 }) // läge hinter dem Sitzungsende
    const b = bewerteIdeal(c, setup(), 4)
    expect(b?.ergebnis.art).toBe('offen')
    expect(b?.ergebnis.r).toBeCloseTo(0.5, 8)
  })

  it('Short spiegelbildlich', () => {
    const c = flach(8)
    c[3] = bar(3, { low: 89 })
    const b = bewerteIdeal(c, setup({ richtung: 'short', idealStopLoss: 104, idealTakeProfit: 90 }), 7)
    expect(b?.ergebnis.art).toBe('tp')
    expect(b?.crv).toBeCloseTo(2.5, 8)
  })

  it('verwirft Setups, die sich zum Signal-Schlusskurs nicht lohnen (CRV < 1)', () => {
    expect(bewerteIdeal(flach(8), setup({ idealTakeProfit: 103 }), 7)).toBeNull()
    expect(bewerteIdeal(flach(8), setup({ idealStopLoss: 100.5 }), 7)).toBeNull()
  })
})

describe('rueckblick', () => {
  const c = flach(40)

  it('ohne eigenen Trade → verpasst', () => {
    const f = rueckblick(c, [setup()], [], 39)
    expect(f[0].status).toBe('verpasst')
  })

  it('eigener Einstieg in dieselbe Richtung im Entry-Fenster → gehandelt', () => {
    const f = rueckblick(c, [setup()], [trade({ entryTime: 4, exitTime: 9 })], 39)
    expect(f[0].status).toBe('gehandelt')
    expect(f[0].eigenerTrade?.rMultiple).toBe(1)
  })

  it('Einstieg in die Gegenrichtung oder nach dem Fenster zählt nicht', () => {
    expect(rueckblick(c, [setup()], [trade({ richtung: 'short', entryTime: 4 })], 39)[0].status).toBe('verpasst')
    expect(rueckblick(c, [setup()], [trade({ entryTime: 12, exitTime: 14 })], 39)[0].status).toBe('verpasst')
  })

  it('lief zum Signal schon ein anderer Trade → belegt statt verpasst', () => {
    const s = setup({ signalIndex: 10, entryZone: { preisVon: 98, preisBis: 102, barVon: 10, barBis: 14 } })
    const f = rueckblick(c, [s], [trade({ richtung: 'short', entryTime: 5, exitTime: 20 })], 39)
    expect(f[0].status).toBe('belegt')
  })

  it('Summe zählt nur entschiedene verpasste Setups ins R', () => {
    const daten = flach(40)
    daten[5] = bar(5, { high: 111 }) // Setup A: Ziel
    daten[22] = bar(22, { low: 94 }) // Setup B: Stop
    const a = setup()
    const b = setup({ signalIndex: 20, entryZone: { preisVon: 98, preisBis: 102, barVon: 20, barBis: 24 } })
    const offen = setup({ signalIndex: 37, entryZone: { preisVon: 98, preisBis: 102, barVon: 37, barBis: 39 } })
    const s = rueckblickSumme(rueckblick(daten, [a, b, offen], [], 39))
    expect(s.verpasst).toBe(3)
    expect(s.verpassteGewinner).toBe(1)
    expect(s.verpassteVerlierer).toBe(1)
    expect(s.verpassteOffen).toBe(1)
    expect(s.verpassteR).toBeCloseTo(1, 8) // +2R − 1R
  })
})

describe('Suche an echten Daten', () => {
  const lade = (name: string): Candle[] =>
    (JSON.parse(readFileSync(join(process.cwd(), 'public', 'replay', `${name}.json`), 'utf8')) as CandleDatensatz)
      .candles

  it('findet Setups mit Merkmalen, fasst dichte Treffer zusammen und blickt nicht voraus', () => {
    for (const name of ['replay-btc-1h-2022', 'replay-eth-4h-2021', 'replay-sol-15m-2023']) {
      const c = lade(name)
      const setups: ErkanntesSetup[] = []
      sucheBereich(c, 150, c.length - 1, setups)
      expect(setups.length, `${name}: nichts gefunden`).toBeGreaterThan(0)
      expect(setups.length, `${name}: zu viele`).toBeLessThan(c.length / 15)
      for (const s of setups) {
        expect(s.merkmale.length).toBeGreaterThanOrEqual(3)
        // alle Markierungen liegen in der Vergangenheit des Signals
        for (const p of s.punkte) expect(p.index).toBeLessThanOrEqual(s.signalIndex)
        // dasselbe Ergebnis, wenn die Zukunft abgeschnitten ist
        const ohneZukunft = erkenneImFenster(c.slice(0, s.signalIndex + 1), s.signalIndex)
        expect(ohneZukunft?.strategieId).toBe(s.strategieId)
      }
      // gleiche Richtung nie dichter als 15 Kerzen
      for (let k = 1; k < setups.length; k++) {
        for (let m = 0; m < k; m++) {
          if (setups[k].richtung === setups[m].richtung) {
            expect(Math.abs(setups[k].signalIndex - setups[m].signalIndex)).toBeGreaterThanOrEqual(15)
          }
        }
      }
      const funde = rueckblick(c, setups, [], c.length - 1)
      for (const f of funde) expect(f.crv).toBeGreaterThanOrEqual(1)
    }
  })

  it('das Fenster liefert dieselben Treffer wie die Suche über den ganzen Abschnitt', () => {
    const c = lade('replay-btc-1h-2022')
    let gleich = 0
    let gesamt = 0
    for (let i = 450; i < c.length; i += 3) {
      const a = erkenneAn(c, i)
      const b = erkenneImFenster(c, i)
      gesamt++
      if ((a?.strategieId ?? null) === (b?.strategieId ?? null)) gleich++
    }
    expect(gleich / gesamt).toBeGreaterThan(0.97)
  })
})
