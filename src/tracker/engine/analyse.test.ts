import { describe, expect, it } from 'vitest'
import type { Candle } from '../../types'
import { analysiere, analysiereHistorie, findeTunnel, kerzenAusKompakt, kerzenKompakt } from './analyse'
import { normalisiereConfig, STANDARD_CONFIG } from './katalog'

const TAG = 86_400
const START = Date.parse('2026-01-05T00:00:00Z') / 1000
const ALLE = { ausbruch: true, tunnel: true, 'ema-kreuz': true, rsi: true, setup: true } as const

/** Kerzen aus Schlusskursen: Hoch/Tief ±0,4 % um den Schluss, Open = Vorschluss */
function kerzen(closes: number[], spanne = 0.004): Candle[] {
  return closes.map((close, i) => {
    const open = i > 0 ? closes[i - 1] : close
    return {
      time: START + i * TAG,
      open,
      high: Math.max(open, close) * (1 + spanne),
      low: Math.min(open, close) * (1 - spanne),
      close,
      volume: 1000,
    }
  })
}

function seitwaerts(n: number, mitte = 100, amplitude = 1.5): number[] {
  return Array.from({ length: n }, (_, i) => mitte + amplitude * Math.sin(i * 0.7))
}

describe('analyse', () => {
  it('meldet einen Breakout nur am ersten Tag über dem 20-Tage-Hoch', () => {
    const closes = [...seitwaerts(40), 104, 105]
    const c = kerzen(closes)
    const tag1 = analysiere(c.slice(0, 41), 'test', ALLE, new Date('2026-03-01'))!
    const tag2 = analysiere(c, 'test', ALLE, new Date('2026-03-01'))!
    expect(tag1.signale.some((s) => s.muster === 'ausbruch' && s.richtung === 'long')).toBe(true)
    expect(tag2.signale.some((s) => s.muster === 'ausbruch')).toBe(false)
    expect(tag1.analyse.hoch20).toBeGreaterThan(101)
    expect(tag1.analyse.vorlaeufig).toBe(false)
  })

  it('trägt Signale vergangener Kerzen nach, markiert sie und lässt die aktuelle Kerze aus', () => {
    // Breakout an Kerze 41 (Index 40), danach fünf ruhige Kerzen; die letzte Kerze gehört dem Live-Lauf
    const closes = [...seitwaerts(40), 104, 105, 105, 105, 105, 105]
    const c = kerzen(closes)
    const h = analysiereHistorie(c, 'test', ALLE, undefined, 10)
    const ausbruch = h.filter((s) => s.muster === 'ausbruch')
    expect(ausbruch).toHaveLength(1)
    expect(ausbruch[0]).toMatchObject({ nachgetragen: true, datum: new Date(c[40].time * 1000).toISOString().slice(0, 10) })
    expect(ausbruch[0].vorlaeufig).toBeUndefined()
    // Sichtung = Folgekerze, nicht "jetzt"
    expect(ausbruch[0].zeit).toBe(new Date(c[41].time * 1000).toISOString())
    // ein zu kurzes Fenster findet den Ausbruch nicht mehr
    expect(analysiereHistorie(c, 'test', ALLE, undefined, 3).some((s) => s.muster === 'ausbruch')).toBe(false)
    // nur abgeschlossene Kerzen vor der aktuellen: die letzte Kerze liefert keinen Eintrag
    expect(h.every((s) => s.datum <= new Date(c[c.length - 2].time * 1000).toISOString().slice(0, 10))).toBe(true)
  })

  it('erkennt einen Tunnel mit mehrfach berührten Rändern und den Rand', () => {
    const c = kerzen(seitwaerts(40))
    const i = c.length - 1
    // Sinus ±1,5 plus Dochte ergibt ~3,8 Höhe → mit ATR 1,2 (Rahmen 4,8) ein Tunnel, mit ATR 0,8 keiner
    expect(findeTunnel(c, i, 0.8)).toBeNull()
    const t = findeTunnel(c, i, 1.2)
    expect(t).not.toBeNull()
    expect(t!.seitTagen).toBeGreaterThanOrEqual(15)
    expect(t!.hoch).toBeGreaterThan(t!.tief)
    // Trend statt Tunnel: Höhe sprengt den ATR-Rahmen
    const trend = kerzen(Array.from({ length: 40 }, (_, k) => 100 + k * 0.8))
    expect(findeTunnel(trend, trend.length - 1, 1.2)).toBeNull()
  })

  it('markiert Signale der heutigen Kerze als vorläufig', () => {
    const c = kerzen([...seitwaerts(40), 105])
    const heute = new Date(c[c.length - 1].time * 1000)
    const r = analysiere(c, 'test', ALLE, heute)!
    expect(r.analyse.vorlaeufig).toBe(true)
    const ausbruch = r.signale.find((s) => s.muster === 'ausbruch')
    expect(ausbruch?.vorlaeufig).toBe(true)
    expect(ausbruch?.id).toBe(`test:ausbruch:long:${heute.toISOString().slice(0, 10)}`)
  })

  it('respektiert abgeschaltete Muster und nutzt den Live-Kurs', () => {
    const c = kerzen([...seitwaerts(40), 105])
    const r = analysiere(c, 'test', { ...ALLE, ausbruch: false }, new Date('2026-03-01'), { kurs: 106, zeit: '2026-03-01T10:00:00Z' })!
    expect(r.signale.some((s) => s.muster === 'ausbruch')).toBe(false)
    expect(r.analyse.kurs).toBe(106)
    expect(r.analyse.aenderungTag).toBeCloseTo(106 / c[c.length - 2].close - 1, 6)
  })

  it('meldet ein Golden Cross 20/50 genau einmal', () => {
    const closes = [...Array.from({ length: 60 }, (_, k) => 120 - k * 0.5), ...Array.from({ length: 40 }, (_, k) => 90 + k * 1.2)]
    const c = kerzen(closes)
    let treffer = 0
    for (let i = 60; i < c.length; i++) {
      const r = analysiere(c.slice(0, i + 1), 'test', { ...ALLE, ausbruch: false, tunnel: false, rsi: false, setup: false }, new Date('2027-01-01'))
      treffer += r?.signale.filter((s) => s.titel === 'Golden Cross 20/50').length ?? 0
    }
    expect(treffer).toBe(1)
  })

  it('liefert null bei zu wenig Kerzen', () => {
    expect(analysiere(kerzen(seitwaerts(10)), 'test', ALLE, new Date())).toBeNull()
  })

  it('wandelt Kerzen kompakt und zurück', () => {
    const c = kerzen(seitwaerts(5)).map((k) => ({ ...k, open: Math.round(k.open * 1e5) / 1e5, high: Math.round(k.high * 1e5) / 1e5, low: Math.round(k.low * 1e5) / 1e5, close: Math.round(k.close * 1e5) / 1e5 }))
    expect(kerzenAusKompakt(kerzenKompakt(c))).toEqual(c)
    expect(kerzenAusKompakt([[1, 2], ['x' as unknown as number, 1, 1, 1, 1, 1]])).toEqual([])
  })
})

describe('katalog', () => {
  it('normalisiert eine Konfiguration', () => {
    expect(normalisiereConfig(null)).toEqual(STANDARD_CONFIG)
    const n = normalisiereConfig({ instrumente: ['gold', 'unbekannt', 'gold'], muster: { rsi: false }, push: false, aktualisiertAm: 5 })
    expect(n.instrumente).toEqual(['gold'])
    expect(n.muster.rsi).toBe(false)
    expect(n.muster.ausbruch).toBe(true)
    expect(n.push).toBe(false)
    expect(n.aktualisiertAm).toBe(5)
  })
})

describe('stundenebene', () => {
  it('nutzt Stunden-Ids, Vorläufigkeit nach Intervall und eigene Texte', async () => {
    const { STUNDEN_OPTIONEN } = await import('./analyse')
    const closes = [...seitwaerts(40), 104, 105]
    // Stundenkerzen: Zeiten im Stundenraster
    const c = kerzen(closes).map((k, i) => ({ ...k, time: 1_700_000_000 + i * 3600 }))
    const letzte = c[c.length - 2]
    const r = analysiere(c.slice(0, -1), 'test', ALLE, new Date((letzte.time + 1800) * 1000), undefined, STUNDEN_OPTIONEN)!
    const a = r.signale.find((s) => s.muster === 'ausbruch')!
    expect(a.ebene).toBe('stunde')
    expect(a.vorlaeufig).toBe(true)
    expect(a.id).toBe(`test:ausbruch:long:stunde:${new Date(letzte.time * 1000).toISOString().slice(0, 13)}`)
    expect(a.text).toContain('20-Stunden-Hoch')
    const fertig = analysiere(c.slice(0, -1), 'test', ALLE, new Date((letzte.time + 7200) * 1000), undefined, STUNDEN_OPTIONEN)!
    expect(fertig.analyse.vorlaeufig).toBe(false)
  })
  it('normalisiert die Stunden-Einstellungen', () => {
    const n = normalisiereConfig({ musterStunde: { setup: false }, pushStunde: false })
    expect(n.musterStunde.setup).toBe(false)
    expect(n.musterStunde.ausbruch).toBe(true)
    expect(n.pushStunde).toBe(false)
    expect(normalisiereConfig({}).pushStunde).toBe(true)
  })
})
