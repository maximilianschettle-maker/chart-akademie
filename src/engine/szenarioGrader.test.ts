import { describe, it, expect } from 'vitest'
import { bewerteSzenario, besseresErgebnis, fensterText, idealTrade, textFuellen, zoneText } from './szenarioGrader'
import type { Candle, Order, Scenario, Trade } from '../types'

// 50 Stundenkerzen ab 01.01.2024 00:00 UTC, Kurs pendelt 99–101
const START = Date.UTC(2024, 0, 1) / 1000
const candles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
  time: START + i * 3600,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1,
}))

const feedback = {
  perfekt: 'P',
  gut: 'G',
  verpasst: 'V {fenster}',
  falsch: 'F {zone}',
  falscheRichtung: 'R',
}

const setup: Scenario = {
  id: 's',
  titel: 't',
  strategieId: 'range-trading',
  datensatz: '',
  symbol: 'X',
  interval: '1h',
  startIndex: 5,
  endIndex: 49,
  aufgabe: 'Zone {zone}',
  richtung: 'long',
  entryZone: { preisVon: 98, preisBis: 102, barVon: 10, barBis: 30 },
  kriterien: {
    trigger: { beschreibung: 'Rückeroberung über 99', bar: 10 },
    stopRegel: { beschreibung: 'unter dem Tief', level: 97.5 },
  },
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
    entryTime: candles[20].time,
    exitTime: candles[30].time,
    menge: 1,
    stopLoss: 97,
    takeProfit: 106,
    pnl: 6,
    rMultiple: 2,
    exitGrund: 'tp',
    ...teil,
  }
}

const status = (r: ReturnType<typeof bewerteSzenario>) => Object.fromEntries(r.kriterien.map((k) => [k.id, k.status]))

describe('Szenario-Bewertung: jedes Kriterium einzeln', () => {
  it('perfekt: alle sechs Kriterien ok', () => {
    const r = bewerteSzenario(setup, candles, [trade({})])
    expect(r.bewertung).toBe('perfekt')
    expect(r.grund).toBe('alleKriterien')
    expect(status(r)).toEqual({ richtung: 'ok', trigger: 'ok', entryZeit: 'ok', entryPreis: 'ok', stop: 'ok', crv: 'ok' })
    expect(r.details).toMatchObject({ richtung: 'long', entryPreis: 100, entryIndex: 20, crv: 2, triggerBar: 10 })
    expect(r.text).toBe('P')
  })

  it('falsche Richtung → falsch, Richtungs-Lehrtext statt Zonen-Text', () => {
    const r = bewerteSzenario(setup, candles, [trade({ richtung: 'short', stopLoss: 103, takeProfit: 94 })])
    expect(r.bewertung).toBe('falsch')
    expect(r.grund).toBe('richtung')
    expect(r.kriterien[0]).toMatchObject({ id: 'richtung', status: 'fehler', soll: 'Long', ist: 'Short' })
    expect(r.kriterien[0].text).toBe('Falsche Richtung: Du bist Short gegangen, das Setup verlangte Long.')
    expect(r.text).toBe('R')
  })

  it('Entry vor dem Trigger → falsch, „Trigger nicht abgewartet“ mit beiden Zeitpunkten', () => {
    const r = bewerteSzenario(setup, candles, [trade({ entryTime: candles[5].time })])
    expect(r.bewertung).toBe('falsch')
    expect(r.grund).toBe('trigger')
    const t = r.kriterien.find((k) => k.id === 'trigger')!
    expect(t.status).toBe('fehler')
    expect(t.text).toBe(
      'Trigger nicht abgewartet: Rückeroberung über 99 kam erst am 01.01.2024, 10:00, dein Entry war schon am 01.01.2024, 05:00 — 5 Kerzen zu früh.',
    )
    expect(r.text).toBe('F 98–102 $')
  })

  it('Entry nach dem Fenster → gut mit Warnung „zu spät“', () => {
    const r = bewerteSzenario(setup, candles, [trade({ entryTime: candles[40].time })])
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('zuSpaet')
    expect(status(r).entryZeit).toBe('warnung')
    expect(r.kriterien.find((k) => k.id === 'entryZeit')!.text).toContain('Zu spät: Dein Entry am 02.01.2024, 16:00')
    expect(r.text).toBe('G')
  })

  it('Entry außerhalb der Toleranz → gut mit Warnung inkl. CRV-Folge gegen den Ideal-Entry', () => {
    const r = bewerteSzenario(setup, candles, [trade({ entryPreis: 104, stopLoss: 97, takeProfit: 110 })])
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('preiszone')
    const e = r.kriterien.find((k) => k.id === 'entryPreis')!
    expect(e.status).toBe('warnung')
    // 2 $ / 2 % über 102; mit demselben SL/TP am Ideal-Entry 100: 10/3 = 3,3 statt 6/7 = 0,9
    expect(e.text).toBe('Entry 2 $ (2 %) über der Zone (98–102 $) — dadurch CRV 0,9 statt ~3,3 am Ideal-Entry (100 $).')
  })

  it('Entry knapp außerhalb, innerhalb der Toleranz von 1 % → ok', () => {
    const r = bewerteSzenario(setup, candles, [trade({ entryPreis: 102.5, stopLoss: 97, takeProfit: 111 })])
    expect(status(r).entryPreis).toBe('ok')
    expect(r.kriterien.find((k) => k.id === 'entryPreis')!.text).toContain('innerhalb der Toleranz von 1 %')
    expect(r.bewertung).toBe('perfekt')
  })

  it('Stop auf der falschen Seite → falsch', () => {
    const r = bewerteSzenario(setup, candles, [trade({ stopLoss: 103 })])
    expect(r.bewertung).toBe('falsch')
    expect(r.grund).toBe('stopSeite')
    expect(r.kriterien.find((k) => k.id === 'stop')!.text).toBe('Stop auf der falschen Seite: SL 103 $ liegt über deinem Entry (100 $).')
  })

  it('Stop richtige Seite, aber über dem Struktur-Level → gut mit Warnung', () => {
    const r = bewerteSzenario(setup, candles, [trade({ stopLoss: 98, takeProfit: 106 })])
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('stopRegel')
    const s = r.kriterien.find((k) => k.id === 'stop')!
    expect(s.status).toBe('warnung')
    expect(s.text).toContain('Stop ohne Struktur: SL 98 $ liegt über 97,5 $ (unter dem Tief)')
    expect(s.soll).toBe('unter dem Tief (unter 97,5 $)')
  })

  it('CRV zu klein → gut mit Zahlen', () => {
    const r = bewerteSzenario(setup, candles, [trade({ takeProfit: 103 })])
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('crv')
    expect(r.kriterien.find((k) => k.id === 'crv')!.text).toContain('CRV 1 statt mindestens 1,5')
  })

  it('ohne Take-Profit → Warnung beim CRV', () => {
    const r = bewerteSzenario(setup, candles, [trade({ takeProfit: 0 })])
    expect(r.bewertung).toBe('gut')
    expect(r.kriterien.find((k) => k.id === 'crv')).toMatchObject({ status: 'warnung', ist: 'kein Ziel' })
  })

  it('Fehler schlägt Warnung: falsche Richtung + schlechtes CRV → falsch', () => {
    const r = bewerteSzenario(setup, candles, [trade({ richtung: 'short', stopLoss: 103, takeProfit: 98 })])
    expect(r.bewertung).toBe('falsch')
    expect(status(r).crv).toBe('warnung')
  })

  it('ohne Kriterien-Config (generierte Übung): nur Zone, Stop-Seite, CRV', () => {
    const ohne: Scenario = { ...setup, kriterien: undefined }
    const r = bewerteSzenario(ohne, candles, [trade({ entryTime: candles[5].time })])
    expect(r.kriterien.map((k) => k.id)).toEqual(['richtung', 'entryZeit', 'entryPreis', 'stop', 'crv'])
    expect(r.bewertung).toBe('gut') // zu früh ist ohne Trigger nur eine Warnung
    expect(r.grund).toBe('zuFrueh')
  })

  it('verpasst ohne Order', () => {
    const r = bewerteSzenario(setup, candles, [])
    expect(r.bewertung).toBe('verpasst')
    expect(r.grund).toBe('keinTrade')
    expect(r.text).toBe('V 01.01.2024–02.01.2024')
    expect(r.kriterien).toEqual([])
    expect(r.bilanz).toEqual({ prozess: 'kein Trade', ergebnis: '', fazit: '' })
  })

  it('verpasst mit nie gefüllter Limit-Order → sagt Orderpreis und erreichtes Tief', () => {
    const order: Order = {
      id: 'o',
      richtung: 'long',
      typ: 'limit',
      limitPreis: 95,
      stopLoss: 90,
      takeProfit: 110,
      menge: 1,
      erstelltBarIndex: 12,
    }
    const r = bewerteSzenario(setup, candles, [], order)
    expect(r.bewertung).toBe('verpasst')
    expect(r.grund).toBe('orderNichtGefuellt')
    expect(r.text).toContain('Deine Limit-Order bei 95 $ wurde nie gefüllt.')
    expect(r.text).toContain('(01.01.2024, 12:00) fiel der Kurs nur bis 99 $')
    expect(r.details).toMatchObject({ orderTyp: 'limit', orderPreis: 95 })
  })

  it('addiert Teil-Trades desselben Einstiegs zum Gesamt-R', () => {
    const r = bewerteSzenario(setup, candles, [
      trade({ id: 'a', rMultiple: 0.5, exitGrund: 'teil' }),
      trade({ id: 'b', rMultiple: 1.2 }),
    ])
    expect(r.rMultiple).toBeCloseTo(1.7, 6)
  })

  describe('Kein-Trade-Szenario', () => {
    const keinTrade: Scenario = { ...setup, richtung: 'keiner', alternativRichtung: 'short', entryZone: undefined, kriterien: undefined }
    it('kein Trade → perfekt', () => {
      expect(bewerteSzenario(keinTrade, candles, []).bewertung).toBe('perfekt')
    })
    it('Trade in Alternativrichtung → gut', () => {
      expect(bewerteSzenario(keinTrade, candles, [trade({ richtung: 'short' })]).bewertung).toBe('gut')
    })
    it('anderer Trade → falsch mit Kriterium', () => {
      const r = bewerteSzenario(keinTrade, candles, [trade({})])
      expect(r.bewertung).toBe('falsch')
      expect(r.grund).toBe('tradeStattWarten')
      expect(r.kriterien[0]).toMatchObject({ status: 'fehler', soll: 'kein Trade', ist: 'Long' })
    })
  })
})

describe('Prozess und Ergebnis getrennt', () => {
  it('guter Prozess + Stop getroffen → „Pech gehabt“', () => {
    const r = bewerteSzenario(setup, candles, [trade({ exitPreis: 97, exitGrund: 'sl', pnl: -3, rMultiple: -1 })])
    expect(r.bewertung).toBe('perfekt')
    expect(r.bilanz.prozess).toBe('perfekt')
    expect(r.bilanz.ergebnis).toBe('−1.00R (Stop getroffen)')
    expect(r.bilanz.fazit).toContain('Richtig gehandelt, Pech gehabt')
  })
  it('gut + Gewinn → passt zusammen', () => {
    const r = bewerteSzenario(setup, candles, [trade({ takeProfit: 103, exitPreis: 103, pnl: 3, rMultiple: 1 })])
    expect(r.bilanz).toMatchObject({ prozess: 'gut', ergebnis: '+1.00R (Ziel erreicht)' })
    expect(r.bilanz.fazit).toBe('Prozess und Ergebnis passen zusammen.')
  })
  it('schlechter Prozess + Gewinn → „Glück gehabt“', () => {
    const r = bewerteSzenario(setup, candles, [trade({ richtung: 'short', stopLoss: 103, takeProfit: 94, exitPreis: 94, pnl: 6, rMultiple: 2 })])
    expect(r.bilanz.prozess).toBe('fehlerhaft')
    expect(r.bilanz.fazit).toContain('Glück gehabt')
  })
  it('schlechter Prozess + Verlust', () => {
    const r = bewerteSzenario(setup, candles, [trade({ stopLoss: 103, exitGrund: 'sl', pnl: -3, rMultiple: -1 })])
    expect(r.bilanz.fazit).toContain('Prozessfehler und Verlust')
  })
})

describe('Ideal-Trade an den Kerzen', () => {
  it('Entry als Limit an der ersten Kerze ab Trigger, Exit am TP', () => {
    const c = candles.map((k, i) => (i === 25 ? { ...k, high: 107 } : k))
    const ideal = idealTrade(setup, c)!
    expect(ideal).toMatchObject({ entryIndex: 10, entry: 100, exitIndex: 25, exitGrund: 'tp', crv: 2 })
    expect(ideal.entryTime).toBe(c[10].time)
  })
  it('SL zuerst, wenn beide in derselben Kerze liegen', () => {
    const c = candles.map((k, i) => (i === 25 ? { ...k, high: 107, low: 96 } : k))
    expect(idealTrade(setup, c)!.exitGrund).toBe('sl')
  })
  it('offen, wenn weder SL noch TP erreicht werden', () => {
    expect(idealTrade(setup, candles)!.exitGrund).toBe('offen')
  })
  it('null, wenn der Ideal-Entry im Fenster nie berührt wird', () => {
    expect(idealTrade({ ...setup, idealEntry: 90 }, candles)).toBeNull()
  })
  it('Bewertung liefert den Ideal-Trade mit', () => {
    expect(bewerteSzenario(setup, candles, []).ideal?.entryIndex).toBe(10)
  })
})

describe('Platzhalter aus der Config', () => {
  it('{zone}, {fenster} und {trigger} kommen aus entryZone, Kerzen und Trigger', () => {
    expect(zoneText(setup)).toBe('98–102 $')
    expect(fensterText(setup, candles)).toBe('01.01.2024–02.01.2024')
    expect(textFuellen('Zone {zone}, Fenster {fenster}, Trigger {trigger}', setup, candles)).toBe(
      'Zone 98–102 $, Fenster 01.01.2024–02.01.2024, Trigger 01.01.2024, 10:00',
    )
  })
  it('große Kurse ohne Nachkommastellen, kleine mit', () => {
    expect(zoneText({ ...setup, entryZone: { preisVon: 50400, preisBis: 51600, barVon: 0, barBis: 1 } })).toBe('50.400–51.600 $')
    expect(zoneText({ ...setup, entryZone: { preisVon: 124, preisBis: 142.5, barVon: 0, barBis: 1 } })).toBe('124–142,5 $')
  })
})

describe('Bester Versuch zählt', () => {
  it('erst falsch, dann perfekt → perfekt', () => {
    const a = besseresErgebnis({ bewertung: 'falsch' as const, rMultiple: -1 }, { bewertung: 'perfekt' as const, rMultiple: 2 })
    expect(a.bewertung).toBe('perfekt')
  })
  it('erst perfekt, dann falsch → bleibt perfekt', () => {
    const a = besseresErgebnis({ bewertung: 'perfekt' as const, rMultiple: 2 }, { bewertung: 'falsch' as const, rMultiple: -1 })
    expect(a).toEqual({ bewertung: 'perfekt', rMultiple: 2 })
  })
  it('perfekt > gut > ok > verpasst > falsch', () => {
    expect(besseresErgebnis({ bewertung: 'verpasst' as const }, { bewertung: 'falsch' as const }).bewertung).toBe('verpasst')
    expect(besseresErgebnis({ bewertung: 'verpasst' as const }, { bewertung: 'gut' as const }).bewertung).toBe('gut')
    expect(besseresErgebnis({ bewertung: 'gut' as const }, { bewertung: 'ok' as const }).bewertung).toBe('gut')
    expect(besseresErgebnis({ bewertung: 'gut' as const }, { bewertung: 'perfekt' as const }).bewertung).toBe('perfekt')
    expect(besseresErgebnis(undefined, { bewertung: 'falsch' as const }).bewertung).toBe('falsch')
  })
})
