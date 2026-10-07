/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, CandleDatensatz, Trade } from '../types'
import { SZENARIEN } from '../content/szenarien'
import { bewerteSzenario } from './szenarioGrader'
import { REVIEW_FARBEN, reviewAnzeige } from './uebungsReview'

// Die Review-Ansicht zeigt eigenen Trade und Ideal-Trade gleichzeitig, farblich
// getrennt, mit Entry-Fenster als Box und Markern an Trigger, Ideal-Entry und Exit.

const sz = SZENARIEN['s-sweep-btc-mai24']
const candles = (JSON.parse(readFileSync(join(process.cwd(), 'public', 'szenarien', `${sz.datensatz}.json`), 'utf8')) as CandleDatensatz)
  .candles.slice(0, sz.endIndex + 1) as Candle[]

const eigener: Trade = {
  id: 't',
  richtung: 'long',
  entryPreis: 61700,
  exitPreis: 70000,
  entryTime: candles[237].time,
  exitTime: candles[340].time,
  menge: 1,
  stopLoss: 56400,
  takeProfit: 70000,
  pnl: 8300,
  rMultiple: 1.57,
  exitGrund: 'tp',
}

describe('Review-Ansicht', () => {
  const resultat = bewerteSzenario(sz, candles, [eigener])
  const review = reviewAnzeige(sz, candles, [eigener], resultat.ideal)

  it('zeigt eigenen Trade und Ideal-Trade gleichzeitig, farblich getrennt', () => {
    const ids = review.linien.map((l) => l.id)
    expect(ids).toEqual(['eigen-entry', 'eigen-sl', 'eigen-tp', 'ideal-entry', 'ideal-sl', 'ideal-tp'])
    const eigen = review.linien.filter((l) => l.id.startsWith('eigen-'))
    const ideal = review.linien.filter((l) => l.id.startsWith('ideal-'))
    expect(eigen.map((l) => l.preis)).toEqual([61700, 56400, 70000])
    expect(ideal.map((l) => l.preis)).toEqual([59000, 56400, 64500])
    for (const l of ideal) {
      expect(l.farbe).toBe(REVIEW_FARBEN.ideal)
      expect(l.stil).toBe('gepunktet')
    }
    expect(eigen[0]).toMatchObject({ farbe: REVIEW_FARBEN.eigenEntry, fest: true, titel: 'Dein Entry' })
    expect(new Set(eigen.map((l) => l.farbe)).has(REVIEW_FARBEN.ideal)).toBe(false)
    for (const l of review.linien) expect(l.imBlick).toBe(true)
  })

  it('Entry-Fenster als Box: Preiszone × Zeitraum aus der Config', () => {
    expect(review.boxen).toEqual([
      {
        id: 'entry-fenster',
        zeitVon: candles[234].time,
        zeitBis: candles[240].time,
        preisVon: 58500,
        preisBis: 60500,
        fuellung: REVIEW_FARBEN.fensterFuellung,
        rand: REVIEW_FARBEN.fensterRand,
      },
    ])
  })

  it('Marker: eigener Entry/Exit, Ideal-Entry-Kerze, Ideal-TP-Treffer, Trigger', () => {
    const m = review.marker
    expect(m).toContainEqual({ time: candles[237].time, art: 'long', text: '#1' })
    expect(m).toContainEqual({ time: candles[340].time, art: 'exit', text: '+1.57R', gewinn: true })
    expect(m).toContainEqual({ time: candles[234].time, art: 'hinweis', text: 'Ideal-Entry', farbe: REVIEW_FARBEN.ideal, oben: false })
    expect(m).toContainEqual({ time: candles[242].time, art: 'hinweis', text: 'Ideal-TP', farbe: REVIEW_FARBEN.ideal, oben: true })
    expect(m).toContainEqual({ time: candles[234].time, art: 'hinweis', text: 'Trigger', farbe: REVIEW_FARBEN.trigger, oben: true })
  })

  it('ohne eigenen Trade: nur Ideal-Trade, Fenster und Trigger', () => {
    const r = reviewAnzeige(sz, candles, [], bewerteSzenario(sz, candles, []).ideal)
    expect(r.linien.map((l) => l.id)).toEqual(['ideal-entry', 'ideal-sl', 'ideal-tp'])
    expect(r.marker.map((m) => m.text)).toEqual(['Ideal-Entry', 'Ideal-TP', 'Trigger'])
    expect(r.boxen).toHaveLength(1)
  })

  it('Teil-Exits desselben Einstiegs bekommen je einen Exit-Marker', () => {
    const teil: Trade = { ...eigener, id: 'a', exitTime: candles[300].time, exitGrund: 'teil', rMultiple: 0.5 }
    const r = reviewAnzeige(sz, candles, [teil, eigener], resultat.ideal)
    expect(r.marker.filter((m) => m.art === 'exit')).toHaveLength(2)
    expect(r.marker.filter((m) => m.art === 'long')).toHaveLength(1)
  })
})
