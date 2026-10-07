/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, CandleDatensatz } from '../types'
import { SZENARIEN } from '../content/szenarien'
import {
  UNTER_INTERVALL,
  aktuellerStand,
  fertigerStand,
  istKerzeFertig,
  naechsterTeilschritt,
  ohlcPfad,
  schritteJeKerze,
  sichtbareKerzen,
  teilkerze,
  unterkerzenBis,
  unterkerzenVon,
} from './intrabar'
import { barVerarbeiten, marketSofort, neuerBroker, type BrokerZustand } from './broker'
import { kerzenIndex } from './szenarioGrader'

const H = 3600
const k = (i: number, o: number, h: number, l: number, c: number): Candle => ({ time: i * H, open: o, high: h, low: l, close: c, volume: 4 })
const u = (time: number, o: number, h: number, l: number, c: number): Candle => ({ time, open: o, high: h, low: l, close: c, volume: 1 })

/** Aggregiert Unterkerzen zurück zu einer Kerze (zum Vergleich). */
function zusammen(subs: Candle[], time: number): Candle {
  return {
    time,
    open: subs[0].open,
    high: Math.max(...subs.map((s) => s.high)),
    low: Math.min(...subs.map((s) => s.low)),
    close: subs[subs.length - 1].close,
    volume: subs.reduce((s, x) => s + x.volume, 0),
  }
}

describe('OHLC-Pfad', () => {
  it('grüne Kerze: O→L→H→C in drei Teilstücken, die wieder die Kerze ergeben', () => {
    const kerze = k(0, 100, 110, 95, 105)
    const p = ohlcPfad(kerze, H)
    expect(p.map((s) => [s.open, s.close])).toEqual([
      [100, 95],
      [95, 110],
      [110, 105],
    ])
    expect(p.map((s) => s.time)).toEqual([0, 1200, 2400])
    expect(zusammen(p, 0)).toEqual({ ...kerze, volume: 4 })
  })
  it('rote Kerze: O→H→L→C', () => {
    const p = ohlcPfad(k(0, 100, 110, 95, 97), H)
    expect(p.map((s) => [s.open, s.close])).toEqual([
      [100, 110],
      [110, 95],
      [95, 97],
    ])
  })
})

describe('Unterkerzen und Teilkerzen', () => {
  const haupt = [k(0, 100, 104, 98, 102), k(1, 102, 106, 101, 105)]
  const unter = [u(0, 100, 101, 98, 99), u(900, 99, 104, 99, 103), u(1800, 103, 103, 100, 101), u(2700, 101, 102, 100, 102), u(H, 102, 103, 101, 103), u(H + 900, 103, 106, 102, 105), u(H + 1800, 105, 105, 101, 104), u(H + 2700, 104, 105, 103, 105)]

  it('echte Unterkerzen der Hauptkerze, sonst OHLC-Pfad', () => {
    expect(unterkerzenVon(haupt[0], H, unter)).toEqual(unter.slice(0, 4))
    expect(unterkerzenVon(haupt[1], H, unter)).toEqual(unter.slice(4))
    expect(unterkerzenVon(haupt[1], H, null)).toHaveLength(3)
    expect(unterkerzenVon(k(5, 1, 2, 0, 1), H, unter)).toHaveLength(3) // keine Unterkerzen für diese Zeit → Pfad
    expect(schritteJeKerze(H, unter)).toBe(4)
    expect(schritteJeKerze(H, null)).toBe(3)
  })

  it('Teilkerze wächst mit jeder Unterkerze und endet exakt in der echten Kerze', () => {
    const subs = unterkerzenVon(haupt[0], H, unter)
    expect(teilkerze(haupt[0], subs, 1)).toEqual({ time: 0, open: 100, high: 101, low: 98, close: 99, volume: 1 })
    expect(teilkerze(haupt[0], subs, 2)).toEqual({ time: 0, open: 100, high: 104, low: 98, close: 103, volume: 2 })
    expect(teilkerze(haupt[0], subs, 4)).toBe(haupt[0])
  })

  it('Schrittfolge: Kerze 0 fertig → vier Schritte durch Kerze 1 → Ende', () => {
    let stand = fertigerStand(haupt, H, unter, 0)
    expect(stand).toEqual({ cursor: 0, teil: 4 })
    expect(istKerzeFertig(haupt, H, unter, stand)).toBe(true)
    const folge: string[] = []
    for (;;) {
      const s = naechsterTeilschritt(haupt, H, unter, stand)
      if (!s) break
      stand = s.stand
      folge.push(`${s.stand.cursor}/${s.stand.teil}${s.neueKerze ? 'n' : ''}${s.kerzeFertig ? 'f' : ''}@${s.sub.time}`)
    }
    expect(folge).toEqual(['1/1n@3600', '1/2@4500', '1/3@5400', '1/4f@6300'])
    expect(stand).toEqual({ cursor: 1, teil: 4 })
  })

  it('sichtbare Kerzen, aktueller Stand und Unterkerzen-Basis folgen dem Teilstand', () => {
    const stand = { cursor: 1, teil: 2 }
    const sichtbar = sichtbareKerzen(haupt, H, unter, stand)
    expect(sichtbar).toHaveLength(2)
    expect(sichtbar[0]).toBe(haupt[0])
    expect(sichtbar[1]).toEqual({ time: H, open: 102, high: 106, low: 101, close: 105, volume: 2 })
    expect(aktuellerStand(haupt, H, unter, stand)).toEqual({ kerze: sichtbar[1], zeit: H + 900 })
    expect(unterkerzenBis(haupt, H, unter, stand)).toEqual(unter.slice(0, 6))
    // ohne Unterkerzen: OHLC-Pfad als Basis (3 je Kerze)
    expect(unterkerzenBis(haupt, H, null, { cursor: 1, teil: 1 })).toHaveLength(4)
  })
})

describe('Broker je Unterkerze: SL oder TP zuerst ergibt sich aus den Daten', () => {
  const long = { id: 'o', richtung: 'long' as const, typ: 'market' as const, stopLoss: 90, takeProfit: 110, menge: 1, erstelltBarIndex: 0 }
  const kerze = k(1, 100, 115, 85, 100) // berührt SL UND TP

  function spiele(unter: Candle[] | null): BrokerZustand {
    let b = marketSofort(neuerBroker(10000), long, 100, 0)
    let stand = fertigerStand([k(0, 100, 101, 99, 100), kerze], H, unter, 0)
    for (;;) {
      const s = naechsterTeilschritt([k(0, 100, 101, 99, 100), kerze], H, unter, stand)
      if (!s) break
      stand = s.stand
      b = barVerarbeiten(b, s.sub)
    }
    return b
  }

  it('Unterkerzen: erst das Hoch → TP', () => {
    const b = spiele([u(H, 100, 115, 99, 112), u(H + 900, 112, 113, 85, 90), u(H + 1800, 90, 100, 89, 100), u(H + 2700, 100, 101, 99, 100)])
    expect(b.trades[0].exitGrund).toBe('tp')
    expect(b.trades[0].exitTime).toBe(H)
  })
  it('Unterkerzen: erst das Tief → SL', () => {
    const b = spiele([u(H, 100, 101, 85, 88), u(H + 900, 88, 115, 87, 112), u(H + 1800, 112, 113, 99, 100), u(H + 2700, 100, 101, 99, 100)])
    expect(b.trades[0].exitGrund).toBe('sl')
  })
  it('ohne Unterkerzen, grüne Kerze (O→L→H→C) → SL zuerst', () => {
    expect(spiele(null).trades[0].exitGrund).toBe('sl')
  })
  it('ohne Unterkerzen, rote Kerze (O→H→L→C) → TP zuerst', () => {
    let b = marketSofort(neuerBroker(10000), long, 100, 0)
    for (const sub of ohlcPfad(k(1, 100, 115, 85, 95), H)) b = barVerarbeiten(b, sub)
    expect(b.trades[0].exitGrund).toBe('tp')
  })
  it('Funding wird je 8h-Grenze genau einmal gebucht, nicht je Unterkerze', () => {
    const tag: Candle[] = Array.from({ length: 24 }, (_, i) => k(i, 100, 101, 99, 100))
    const viertel: Candle[] = tag.flatMap((h) => [0, 900, 1800, 2700].map((d) => u(h.time + d, 100, 101, 99, 100)))
    const ohne = tag.reduce((b, h) => barVerarbeiten(b, h), marketSofort(neuerBroker(10000), { ...long, takeProfit: 0, stopLoss: 50 }, 100, 0))
    const mit = viertel.reduce((b, s) => barVerarbeiten(b, s), marketSofort(neuerBroker(10000), { ...long, takeProfit: 0, stopLoss: 50 }, 100, 0))
    expect(mit.position!.fundingKosten).toBeCloseTo(ohne.position!.fundingKosten, 9)
    expect(mit.position!.fundingKosten).toBeGreaterThan(0)
  })
})

describe('Fill-Zeiten aus Unterkerzen', () => {
  it('kerzenIndex findet die Hauptkerze, die den Zeitpunkt enthält', () => {
    const haupt = [k(0, 1, 1, 1, 1), k(1, 1, 1, 1, 1), k(2, 1, 1, 1, 1)]
    expect(kerzenIndex(haupt, H + 900)).toBe(1)
    expect(kerzenIndex(haupt, H)).toBe(1)
    expect(kerzenIndex(haupt, 3 * H + 5)).toBe(2)
    expect(kerzenIndex(haupt, -1)).toBe(-1)
  })
})

describe('Eingecheckte Unterkerzen der Szenarien', () => {
  const ordner = join(process.cwd(), 'public', 'szenarien')
  const lade = (name: string) => JSON.parse(readFileSync(join(ordner, `${name}.json`), 'utf8')) as CandleDatensatz

  for (const sz of Object.values(SZENARIEN)) {
    it(`${sz.datensatz}: ${UNTER_INTERVALL[sz.interval]}-Kerzen liegen vor und ergeben exakt die Hauptkerzen`, () => {
      const haupt = lade(sz.datensatz)
      const datei = join(ordner, `${sz.datensatz}-${UNTER_INTERVALL[sz.interval]}.json`)
      expect(existsSync(datei), datei).toBe(true)
      const unter = (JSON.parse(readFileSync(datei, 'utf8')) as CandleDatensatz).candles
      const sek = sz.interval === '4h' ? 14400 : 3600
      let geprueft = 0
      for (const h of haupt.candles) {
        const subs = unterkerzenVon(h, sek, unter)
        expect(subs.length, `Bar ${h.time}`).toBe(4)
        const z = zusammen(subs, h.time)
        expect(z.open).toBeCloseTo(h.open, 6)
        expect(z.high).toBeCloseTo(h.high, 6)
        expect(z.low).toBeCloseTo(h.low, 6)
        expect(z.close).toBeCloseTo(h.close, 6)
        geprueft++
      }
      expect(geprueft).toBe(haupt.candles.length)
    })
  }
})
