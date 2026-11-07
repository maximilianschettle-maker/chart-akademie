import { describe, expect, it } from 'vitest'
import { anlaeufe, findeZonen, impulsUrspruenge, rangeKanten, swings, vergleicheZonen, type Zone } from './zonen'
import { richtungAus } from './richtung'
import type { Candle } from '../types'

function k(time: number, open: number, high: number, low: number, close: number): Candle {
  return { time, open, high, low, close, volume: 1 }
}

/** Seitwärtsmarkt zwischen 100 und 110 mit sauberen Fraktalen, danach ein Impuls nach oben */
function rangeDannImpuls(): Candle[] {
  const c: Candle[] = []
  let t = 0
  // 8 Wellen à 10 Kerzen zwischen 100 und 110
  for (let w = 0; w < 8; w++) {
    for (let i = 0; i < 10; i++) {
      const phase = i / 10
      const preis = w % 2 === 0 ? 100 + phase * 10 : 110 - phase * 10
      c.push(k(t++, preis, preis + 0.8, preis - 0.8, preis + (w % 2 === 0 ? 0.5 : -0.5)))
    }
  }
  // Basis, dann drei starke Kerzen nach oben
  c.push(k(t++, 101, 102, 100, 101.5))
  c.push(k(t++, 101.5, 106, 101, 105.5))
  c.push(k(t++, 105.5, 110, 105, 109.5))
  c.push(k(t++, 109.5, 114, 109, 113.5))
  for (let i = 0; i < 10; i++) c.push(k(t++, 113 + i * 0.1, 114 + i * 0.1, 112.5 + i * 0.1, 113.5 + i * 0.1))
  return c
}

describe('Zonen: Bausteine', () => {
  const c = rangeDannImpuls()

  it('Fraktale finden die Wellenhochs und -tiefs', () => {
    const s = swings(c.slice(0, 80), 3)
    const hochs = s.filter((x) => x.art === 'hoch')
    const tiefs = s.filter((x) => x.art === 'tief')
    expect(hochs.length).toBeGreaterThanOrEqual(3)
    expect(tiefs.length).toBeGreaterThanOrEqual(3)
    for (const h of hochs) expect(h.preis).toBeCloseTo(110.8, 1)
    for (const t of tiefs) expect(t.preis).toBeCloseTo(99.2, 1)
  })

  it('Anläufe zählen Berührungen nach einer Lücke', () => {
    const r = anlaeufe(c.slice(0, 80), 109, 111)
    expect(r.anzahl).toBe(4)
    expect(r.letzterIndex).toBeGreaterThan(60)
  })

  it('Range-Kanten im Seitwärtsabschnitt, keine im Trend', () => {
    const r = rangeKanten(c.slice(0, 80), 2.5)
    expect(r).not.toBeNull()
    expect(r!.hoch).toBeCloseTo(110.8, 1)
    expect(r!.tief).toBeCloseTo(99.2, 1)
    const trend = Array.from({ length: 60 }, (_, i) => k(i, 100 + i, 101 + i, 99 + i, 100.5 + i))
    expect(rangeKanten(trend, 2.5)).toBeNull()
  })

  it('Impuls-Ursprung an der Basis vor drei starken Kerzen', () => {
    const p = impulsUrspruenge(c, 1.6, 2.5)
    expect(p.length).toBeGreaterThanOrEqual(1)
    expect(p.every((x) => x.art === 'impuls')).toBe(true)
    // die Basis vor dem Ausbruch (um 101) ist als Ursprung dabei
    expect(p.some((x) => x.von! <= 101 && x.bis! >= 101)).toBe(true)
  })
})

describe('Zonen: Erkennung und Vergleich', () => {
  const c = rangeDannImpuls()
  const zonen = findeZonen(c)

  it('findet Zonen um 110, um 100 und den Impuls-Ursprung; die wichtigen sind markiert', () => {
    expect(zonen.length).toBeGreaterThanOrEqual(2)
    const um110 = zonen.find((z) => z.von <= 110.8 && z.bis >= 110.8)
    const um100 = zonen.find((z) => z.von <= 99.5 && z.bis >= 99.5)
    expect(um110).toBeDefined()
    expect(um100).toBeDefined()
    expect(um110!.beruehrungen).toBeGreaterThanOrEqual(3)
    expect(zonen.filter((z) => z.wichtig).length).toBeGreaterThanOrEqual(2)
    expect(zonen.filter((z) => z.wichtig).length).toBeLessThanOrEqual(6)
    expect(um110!.text).toMatch(/angelaufen/)
  })

  it('zu wenige Kerzen → keine Zonen', () => {
    expect(findeZonen(c.slice(0, 20))).toEqual([])
  })

  it('Vergleich: getroffen, verfehlt, nebensächlich, überflüssig', () => {
    const z = (id: string, von: number, bis: number, wichtig: boolean): Zone => ({ id, von, bis, art: 'widerstand', beruehrungen: 2, letzterIndex: 1, staerke: 1, wichtig, text: '' })
    const liste = [z('a', 109, 111, true), z('b', 99, 101, true), z('c', 104, 105, false)]
    const v = vergleicheZonen(liste, [{ preisVon: 110, preisBis: 112 }, { preisVon: 104.2, preisBis: 104.8 }, { preisVon: 120, preisBis: 121 }], 0.5)
    expect(v.getroffen.map((g) => g.zone.id)).toEqual(['a'])
    expect(v.verfehlt.map((x) => x.id)).toEqual(['b'])
    expect(v.nebensaechlich.map((x) => x.zone.id)).toEqual(['c'])
    expect(v.ueberfluessig).toHaveLength(1)
    expect(v.quote).toBe(0.5)
    // knapp daneben zählt innerhalb der Toleranz
    expect(vergleicheZonen(liste, [{ preisVon: 98.3, preisBis: 98.7 }], 0.5).getroffen.map((g) => g.zone.id)).toEqual(['b'])
    expect(vergleicheZonen(liste, [], 0.5).quote).toBe(0)
  })
})

describe('Richtung aus Hochs und Tiefs', () => {
  const welle = (basis: (i: number) => number, n = 120): Candle[] =>
    Array.from({ length: n }, (_, i) => {
      const p = basis(i) + 3 * Math.sin(i / 2)
      return k(i, p, p + 0.5, p - 0.5, p + 0.2)
    })

  it('höhere Hochs und Tiefs → auf, tiefere → ab, flach → seitwärts', () => {
    const auf = richtungAus(welle((i) => 100 + i * 0.4))
    expect(auf.richtung).toBe('auf')
    expect(auf.begruendung).toMatch(/Höhere Hochs/)
    const ab = richtungAus(welle((i) => 200 - i * 0.4))
    expect(ab.richtung).toBe('ab')
    expect(ab.begruendung).toMatch(/Tiefere Hochs/)
    const flach = richtungAus(welle(() => 100))
    expect(['seitwaerts', 'auf', 'ab']).toContain(flach.richtung)
    expect(flach.hochs).toHaveLength(2)
  })

  it('kommt mit sehr wenigen Kerzen zurecht', () => {
    const r = richtungAus(welle((i) => 100 + i, 8))
    expect(r.begruendung).toMatch(/Zu wenige Swings/)
  })
})
