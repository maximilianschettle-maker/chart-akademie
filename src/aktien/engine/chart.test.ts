import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BEREICHE, bereichDef, chartVeraenderung, kerzenAusChart, periodeAb, type ChartRoh } from './chart'

const roh = JSON.parse(readFileSync(new URL('./fixtures/yahoo-sap-chart.json', import.meta.url), 'utf8')) as ChartRoh

describe('Kursverlauf: Rohdaten → Kerzen', () => {
  it('nimmt alle vollständigen Zeilen, Zeit = Tagesanfang UTC, aufsteigend', () => {
    const k = kerzenAusChart(roh)
    expect(k.length).toBe(roh.quotes!.length)
    expect(k[0].time).toBe(Date.UTC(2025, 9, 1) / 1000)
    expect(k[0].open).toBeCloseTo(225.05, 2)
    expect(k[0].close).toBeCloseTo(227.8, 2)
    expect(k[0].volume).toBe(1257008)
    for (let i = 1; i < k.length; i++) expect(k[i].time).toBeGreaterThan(k[i - 1].time)
  })

  it('lässt Zeilen mit fehlenden Kursen weg und behält bei doppeltem Tag die letzte', () => {
    const k = kerzenAusChart({
      quotes: [
        { date: '2026-01-05T08:00:00.000Z', open: 10, high: 11, low: 9, close: 10.5, volume: 100 },
        { date: '2026-01-06T08:00:00.000Z', open: null, high: 11, low: 9, close: 10.5, volume: 100 },
        { date: '2026-01-05T15:00:00.000Z', open: 10, high: 12, low: 9, close: 11, volume: null },
        { date: 'kein datum', open: 1, high: 1, low: 1, close: 1, volume: 1 },
      ],
    })
    expect(k).toEqual([{ time: Date.UTC(2026, 0, 5) / 1000, open: 10, high: 12, low: 9, close: 11, volume: 0 }])
  })

  it('leere Antwort → keine Kerzen', () => {
    expect(kerzenAusChart({})).toEqual([])
  })
})

describe('Kursverlauf: Zeiträume', () => {
  const jetzt = Date.UTC(2026, 9, 21, 12)

  it('kennt die fünf Bereiche, unbekannte Eingaben liefern null', () => {
    expect(BEREICHE.map((b) => b.bereich)).toEqual(['1M', '6M', '1J', '5J', 'MAX'])
    expect(bereichDef('1j')?.intervall).toBe('1d')
    expect(bereichDef('5J')?.intervall).toBe('1wk')
    expect(bereichDef('max')?.intervall).toBe('1mo')
    expect(bereichDef('2J')).toBeNull()
  })

  it('Startdatum: 1J = ein Jahr zurück, MAX = Anfang der Zeitrechnung', () => {
    expect(periodeAb(bereichDef('1J')!, jetzt)).toBe('2025-10-20')
    expect(periodeAb(bereichDef('1M')!, jetzt)).toBe('2026-09-20')
    expect(periodeAb(bereichDef('MAX')!, jetzt)).toBe('1970-01-01')
  })
})

describe('Kursverlauf: Veränderung im Zeitraum', () => {
  it('Start- und Endschluss, Hoch/Tief über alle Kerzen', () => {
    const v = chartVeraenderung([
      { time: 1, open: 10, high: 12, low: 9, close: 10, volume: 0 },
      { time: 2, open: 10, high: 15, low: 8, close: 12, volume: 0 },
    ])!
    expect(v.start).toBe(10)
    expect(v.ende).toBe(12)
    expect(v.absolut).toBe(2)
    expect(v.prozent).toBeCloseTo(0.2, 6)
    expect(v.hoch).toBe(15)
    expect(v.tief).toBe(8)
  })

  it('ohne Kerzen null', () => {
    expect(chartVeraenderung([])).toBeNull()
  })
})
