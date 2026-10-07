/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, CandleDatensatz, Order } from '../types'
import { SZENARIEN } from '../content/szenarien'
import { type BrokerZustand, barVerarbeiten, marketSofort, neuerBroker, orderPlatzieren, positionSchliessen, teilSchliessen } from './broker'
import { alleBewertungen, bewerteAlleTrades, besterTrade, logischeTrades, uebungsErgebnis, zusammenfassung } from './uebungsVerlauf'

// Mehrere Trades in einem Durchlauf der Sweep-Übung (echte Daten): Trade 1 Short
// in den Sweep hinein (falsch), danach Trade 2 Long nach der Rückeroberung (perfekt).

const sz = SZENARIEN['s-sweep-btc-mai24']
const c = (JSON.parse(readFileSync(join(process.cwd(), 'public', 'szenarien', `${sz.datensatz}.json`), 'utf8')) as CandleDatensatz)
  .candles.slice(0, sz.endIndex + 1) as Candle[]

function order(teil: Partial<Order>): Order {
  return { id: 'o', richtung: 'long', typ: 'market', stopLoss: 0, takeProfit: 0, menge: 1, erstelltBarIndex: 0, ...teil }
}

/** Replay bis `bisBar`, dabei an den angegebenen Bars Market-Orders versuchen. */
function replay(aktionen: Record<number, Order>, bisBar = sz.endIndex): BrokerZustand {
  let b = neuerBroker(10000)
  for (let cursor = sz.startIndex; cursor <= bisBar; cursor++) {
    if (cursor > sz.startIndex) b = barVerarbeiten(b, c[cursor], sz.id)
    const o = aktionen[cursor]
    if (o) b = o.typ === 'market' ? marketSofort(b, { ...o, erstelltBarIndex: cursor }, c[cursor].close, c[cursor].time) : orderPlatzieren(b, o)
    if (cursor === sz.endIndex && b.position) b = positionSchliessen(b, c[cursor].close, c[cursor].time, 'szenarioEnde', sz.id)
  }
  return b
}

const short1 = order({ richtung: 'short', stopLoss: 61500, takeProfit: 50000 }) // Bar 223 (01.05. 04:00): Short in den Sweep
const long2 = order({ richtung: 'long', stopLoss: 56400, takeProfit: 64500 }) // Bar 234 (03.05. 00:00): Long nach Rückeroberung

describe('Mehrere Trades pro Übung', () => {
  it('bei offener Position bleibt ein zweiter Trade gesperrt', () => {
    const b = replay({ 223: short1, 226: long2 }, 230)
    expect(b.position?.richtung).toBe('short')
    expect(b.trades).toHaveLength(0)
    // Auch eine wartende Order wird abgelehnt, solange die Position offen ist
    const mitOrder = orderPlatzieren(b, order({ typ: 'limit', limitPreis: 50000, stopLoss: 49000, takeProfit: 55000 }))
    expect(mitOrder).toBe(b)
  })

  it('Trade 1 schließen → Trade 2 möglich', () => {
    const b = replay({ 223: short1, 234: long2 })
    // Short wird am 03.05. 12:00 ausgestoppt (Bar 237, Hoch 62.116 > SL 61.500)
    expect(b.trades.length).toBeGreaterThanOrEqual(1)
    const erster = b.trades[0]
    expect(erster.richtung).toBe('short')
    expect(erster.exitGrund).toBe('sl')
    // Der Long an Bar 234 kam zu früh (Short noch offen) → wird abgelehnt
    expect(b.trades.filter((t) => t.richtung === 'long')).toHaveLength(0)

    // Nach dem Stop des Shorts (Bar 237) ist der Long frei
    const b2 = replay({ 223: short1, 238: long2 })
    expect(b2.trades.map((t) => t.richtung)).toEqual(['short', 'long'])
    expect(b2.trades[1].exitGrund).toBe('tp')
  })

  it('jeder Trade bekommt eine eigene, korrekte Bewertung', () => {
    const b = replay({ 223: short1, 238: long2 })
    const bewertungen = bewerteAlleTrades(sz, c, b.trades)
    expect(bewertungen.map((x) => x.nr)).toEqual([1, 2])
    expect(bewertungen[0].resultat.bewertung).toBe('falsch')
    expect(bewertungen[0].resultat.grund).toBe('richtung')
    expect(bewertungen[0].rMultiple).toBeLessThan(0)
    // Long am 03.05. 16:00 zu 62.067: nach Trigger, aber 2,6 % über der Zone → gut
    expect(bewertungen[1].resultat.bewertung).toBe('gut')
    expect(bewertungen[1].resultat.grund).toBe('preiszone')
    expect(bewertungen[1].rMultiple).toBeGreaterThan(0)

    const e = uebungsErgebnis(sz, c, b.trades)
    expect(e.bester?.nr).toBe(2)
    expect(e.resultat.bewertung).toBe('gut')
  })

  it('Teil-Exits desselben Einstiegs bilden einen logischen Trade', () => {
    // Weites Ziel (70.000, erreicht am 20.05.), damit die Position an Bar 300 noch offen ist
    const b0 = replay({ 238: order({ richtung: 'long', stopLoss: 56400, takeProfit: 70000 }) }, 300)
    expect(b0.position).toBeTruthy()
    // Hälfte manuell raus, Rest läuft weiter bis zum TP
    let b = teilSchliessen(b0, 0.5, c[300].close, c[300].time, sz.id)
    for (let cursor = 301; cursor <= sz.endIndex; cursor++) b = barVerarbeiten(b, c[cursor], sz.id)
    expect(b.trades).toHaveLength(2)
    const l = logischeTrades(b.trades)
    expect(l).toHaveLength(1)
    expect(l[0].trades).toHaveLength(2)
    expect(l[0].rMultiple).toBeCloseTo(b.trades[0].rMultiple + b.trades[1].rMultiple, 6)
    expect(bewerteAlleTrades(sz, c, b.trades)).toHaveLength(1)
  })

  it('ohne Trade entscheidet das Szenario (verpasst)', () => {
    const e = uebungsErgebnis(sz, c, [])
    expect(e.bewertungen).toEqual([])
    expect(e.bester).toBeUndefined()
    expect(e.resultat.bewertung).toBe('verpasst')
  })

  it('bester Trade: Rang vor R', () => {
    const b = replay({ 223: short1, 238: long2 })
    const bewertungen = bewerteAlleTrades(sz, c, b.trades)
    expect(besterTrade(bewertungen)?.nr).toBe(2)
    expect(besterTrade([bewertungen[0]])?.nr).toBe(1)
  })
})

describe('Zusammenfassung', () => {
  const b = replay({ 223: short1, 238: long2 })
  const bewertungen = bewerteAlleTrades(sz, c, b.trades)

  it('Versuche, Treffer, Gesamt-R und Verlauf erster → letzter', () => {
    const z = zusammenfassung(bewertungen)
    expect(z.versuche).toBe(2)
    expect(z.treffer).toBe(1)
    expect(z.gesamtR).toBeCloseTo(bewertungen[0].rMultiple + bewertungen[1].rMultiple, 6)
    expect(z.erste).toBe('falsch')
    expect(z.letzte).toBe('gut')
    expect(z.verbesserung).toBe('besser')
    expect(z.text).toMatch(/^2 Versuche · 1 Treffer · [+−]\d+\.\d\dR gesamt · Verlauf: falsch → gut \(besser\)$/)
  })

  it('ein Versuch: kein Verlauf', () => {
    const z = zusammenfassung([bewertungen[1]])
    expect(z.verbesserung).toBeNull()
    expect(z.text).toMatch(/^1 Versuch · 1 Treffer · \+\d+\.\d\dR gesamt$/)
  })

  it('„Nochmal“: Historie über Durchläufe bleibt und wird gemeinsam zusammengefasst', () => {
    // Durchlauf 1: nur der falsche Short · Durchlauf 2 (gleiche Daten, Chart zurückgesetzt): nur der gute Long
    const d1 = { nr: 1, bewertungen: bewerteAlleTrades(sz, c, replay({ 223: short1 }).trades) }
    const d2 = { nr: 2, bewertungen: bewerteAlleTrades(sz, c, replay({ 238: long2 }).trades) }
    expect(d2.bewertungen[0].nr).toBe(1) // zählt im neuen Durchlauf wieder bei 1
    const alle = alleBewertungen([d1, d2])
    expect(alle.map((x) => x.resultat.bewertung)).toEqual(['falsch', 'gut'])
    const z = zusammenfassung(alle)
    expect(z.versuche).toBe(2)
    expect(z.verbesserung).toBe('besser')
  })

  it('leer', () => {
    expect(zusammenfassung([]).text).toBe('Kein Trade.')
  })
})
