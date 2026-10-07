/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, CandleDatensatz, Order, Scenario, Trade } from '../types'
import { SZENARIEN } from '../content/szenarien'
import { KRITERIEN, bewerteSzenario, idealTrade, textFuellen } from './szenarioGrader'
import { type BrokerZustand, barVerarbeiten, marketSofort, neuerBroker, orderPlatzieren, positionSchliessen } from './broker'
import { entwurfAuswerten, entwurfZuOrder, LEERER_ENTWURF } from './orderEntwurf'

// Spielt die gemeldeten Fälle und die Ideal-Trades aller Übungen gegen die
// eingecheckten ECHTEN Datensätze durch Broker und Bewertung.

const cache = new Map<string, Candle[]>()
function lade(name: string): Candle[] {
  let c = cache.get(name)
  if (!c) {
    c = (JSON.parse(readFileSync(join(process.cwd(), 'public', 'szenarien', `${name}.json`), 'utf8')) as CandleDatensatz).candles
    cache.set(name, c)
  }
  return c
}

/** Kerzen wie in der Übungsseite: bis endIndex abgeschnitten. */
function kerzen(sz: Scenario): Candle[] {
  return lade(sz.datensatz).slice(0, sz.endIndex + 1)
}

function order(teil: Partial<Order>): Order {
  return { id: 'o', richtung: 'long', typ: 'market', stopLoss: 0, takeProfit: 0, menge: 1, erstelltBarIndex: 0, ...teil }
}

/** Replay wie useReplay: Order an Bar `beiBar` platzieren, danach Kerze für Kerze bis zum Ende. */
function spiele(sz: Scenario, c: Candle[], beiBar: number, o: Order): BrokerZustand {
  let b = neuerBroker(10000)
  let cursor = sz.startIndex
  while (cursor < beiBar) b = barVerarbeiten(b, c[++cursor], sz.id)
  const ord = { ...o, erstelltBarIndex: beiBar }
  b = ord.typ === 'market' ? marketSofort(b, ord, c[cursor].close, c[cursor].time) : orderPlatzieren(b, ord)
  while (cursor < sz.endIndex) {
    cursor++
    b = barVerarbeiten(b, c[cursor], sz.id)
    if (cursor === sz.endIndex && b.position) {
      b = positionSchliessen(b, c[cursor].close, c[cursor].time, 'szenarioEnde', sz.id)
    }
  }
  return b
}

/** Order so, wie sie das Order-Ticket aus einem Preis-Entwurf baut (Limit/Stop aus der Lage zum Kurs). */
function ticketOrder(c: Candle[], beiBar: number, entry: number, sl: number, tp: number): Order {
  const e = { ...LEERER_ENTWURF, typ: 'preis' as const, entry: String(entry), sl: String(sl), tp: String(tp) }
  return entwurfZuOrder(e, entwurfAuswerten(e, c[beiBar].close, 10000, { tpPflicht: true }), beiBar, false)
}

const status = (r: ReturnType<typeof bewerteSzenario>) => Object.fromEntries(r.kriterien.map((k) => [k.id, k.status]))

describe('Gemeldete Fälle an echten Daten', () => {
  it('Fall 1 Trendfolge: Long 50.900 im Rücksetzer am 21.02. → perfekt', () => {
    const sz = SZENARIEN['s-trend-btc-feb24']
    const c = kerzen(sz)
    const b = spiele(sz, c, 281, order({ typ: 'limit', limitPreis: 50900, stopLoss: 49900, takeProfit: 52900 }))
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.details).toMatchObject({ richtung: 'long', entryPreis: 50900, entryIndex: 284 })
    expect(b.trades[0]?.exitGrund).toBe('tp')
    expect(r.bewertung).toBe('perfekt')
  })

  it('Fall 2 Breakout: Market ~28.400 in der Konsolidierung nach der Ausbruchskerze → perfekt', () => {
    const sz = SZENARIEN['s-breakout-btc-okt23']
    const c = kerzen(sz)
    const b = spiele(sz, c, 524, order({ typ: 'market', stopLoss: 27467.6, takeProfit: 30108.1 })) // 16.10. 20:00
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.details.entryIndex).toBe(524)
    expect(b.trades[0]?.exitGrund).toBe('tp')
    expect(r.bewertung).toBe('perfekt')
  })

  it('Fall 2 Breakout: Entry auf der Ausbruchskerze selbst → „Trigger nicht abgewartet“, nicht „falsche Richtung“', () => {
    const sz = SZENARIEN['s-breakout-btc-okt23']
    const c = kerzen(sz)
    const b = spiele(sz, c, 517, order({ typ: 'market', stopLoss: 27400, takeProfit: 30100 }))
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.bewertung).toBe('falsch')
    expect(r.grund).toBe('trigger')
    expect(r.kriterien.find((k) => k.id === 'trigger')!.text).toContain('Trigger nicht abgewartet')
    expect(status(r).richtung).toBe('ok')
  })

  it('Fall 3 Support-Bounce: Buy-Limit 25.348,7 füllt am 14.06. 20:00 — das ist VOR der Rückeroberung (Trigger)', () => {
    const sz = SZENARIEN['s-bounce-btc-juni23']
    const c = kerzen(sz)
    for (const beiBar of [400, 420, 427]) {
      const b = spiele(sz, c, beiBar, ticketOrder(c, beiBar, 25348.7, 24500, 27200))
      expect(b.trades[0]?.entryPreis).toBeCloseTo(25348.7, 1)
      expect(b.trades[0]?.entryTime).toBe(c[428].time)
      expect(b.trades[0]?.exitGrund).toBe('tp')
      const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
      expect(r.bewertung).toBe('falsch')
      expect(r.grund).toBe('trigger')
      expect(r.kriterien.find((k) => k.id === 'trigger')!.text).toContain('Rückeroberung: Stundenschluss wieder über 25.400 $ kam erst am 15.06.2023, 19:00')
      expect(r.bilanz.fazit).toContain('Glück gehabt')
    }
  })

  it('Fall 3: Limit nach der Rückeroberung → füllt im Rücksetzer am 16.06. 14:00 → perfekt', () => {
    const sz = SZENARIEN['s-bounce-btc-juni23']
    const c = kerzen(sz)
    const b = spiele(sz, c, 452, ticketOrder(c, 452, 25348.7, 24500, 27200))
    expect(b.trades[0]?.entryTime).toBe(c[470].time)
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.bewertung).toBe('perfekt')
  })

  it('Fall 3: Limit erst nach dem letzten Rücksetzer platziert → „Order nie gefüllt“ statt pauschal „kein Entry“', () => {
    const sz = SZENARIEN['s-bounce-btc-juni23']
    const c = kerzen(sz)
    const b = spiele(sz, c, 471, ticketOrder(c, 471, 25348.7, 24500, 27200)) // 16.06. 15:00, Kurs 25.840
    expect(b.trades).toHaveLength(0)
    expect(b.offeneOrder?.typ).toBe('limit')
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.bewertung).toBe('verpasst')
    expect(r.grund).toBe('orderNichtGefuellt')
    expect(r.text).toContain('Deine Limit-Order bei 25.348,7 $ wurde nie gefüllt.')
    expect(r.text).toContain('(16.06.2023, 15:00) fiel der Kurs nur bis')
  })

  it('Fall 4 Sweep: Long ~61.700 nach der Rückeroberung, SL unter dem Sweep-Tief → gut mit Warnung zur Entry-Lage', () => {
    const sz = SZENARIEN['s-sweep-btc-mai24']
    const c = kerzen(sz)
    const b = spiele(sz, c, 237, order({ typ: 'market', stopLoss: 56400, takeProfit: 70000 }))
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('preiszone')
    expect(status(r)).toEqual({ richtung: 'ok', trigger: 'ok', entryZeit: 'ok', entryPreis: 'warnung', stop: 'ok', crv: 'ok' })
    const e = r.kriterien.find((k) => k.id === 'entryPreis')!
    expect(e.text).toMatch(/^Entry 1\.203,1 \$ \(2 %\) über der Zone \(58\.500–60\.500 \$\) — dadurch CRV 1,6 statt ~4,2 am Ideal-Entry \(59\.000 \$\)\.$/)
    expect(r.text.toLowerCase()).not.toContain('short')
    expect(r.bilanz.prozess).toBe('gut')
    expect(r.bilanz.ergebnis).toContain('Ziel erreicht')
  })

  it('Sweep: Short unter dem Doppelboden → falsch mit Richtungs-Hinweis', () => {
    const sz = SZENARIEN['s-sweep-btc-mai24']
    const c = kerzen(sz)
    const b = spiele(sz, c, 223, order({ richtung: 'short', typ: 'market', stopLoss: 60500, takeProfit: 52000 }))
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.bewertung).toBe('falsch')
    expect(r.grund).toBe('richtung')
    expect(r.kriterien[0].text).toContain('Du bist Short gegangen, das Setup verlangte Long')
    expect(r.text).toContain('SHORT zu gehen')
  })

  it('Sweep: Long vor der Rückeroberung → falsch, „Trigger nicht abgewartet“', () => {
    const sz = SZENARIEN['s-sweep-btc-mai24']
    const c = kerzen(sz)
    const b = spiele(sz, c, 226, order({ typ: 'market', stopLoss: 56400, takeProfit: 64500 })) // 01.05. 16:00, Close 56.954
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.bewertung).toBe('falsch')
    expect(r.grund).toBe('trigger')
    const t = r.kriterien.find((k) => k.id === 'trigger')!
    expect(t.text).toContain('Trigger nicht abgewartet: Rückeroberung: 4h-Schluss wieder über 59.600 $ kam erst am 03.05.2024, 00:00')
    expect(t.text).toContain('dein Entry war schon am 01.05.2024, 16:00 — 8 Kerzen zu früh')
    expect(status(r).richtung).toBe('ok')
  })

  it('Guter Prozess + Stop getroffen → Prozess gut, Ergebnis negativ, „Pech gehabt“', () => {
    // Bounce nach der Rückeroberung, Stop aber über dem Tief des dritten Tests (24.800) → nur Warnung;
    // der Docht am 16.06. 14:00 (Tief 25.176) holt den Stop in derselben Kerze wie den Fill.
    const sz = SZENARIEN['s-bounce-btc-juni23']
    const c = kerzen(sz)
    const b = spiele(sz, c, 452, ticketOrder(c, 452, 25348.7, 25200, 27200))
    expect(b.trades[0]?.exitGrund).toBe('sl')
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('stopRegel')
    expect(r.rMultiple).toBeLessThan(0)
    expect(r.bilanz.prozess).toBe('gut')
    expect(r.bilanz.ergebnis).toContain('Stop getroffen')
    expect(r.bilanz.fazit).toContain('Richtig gehandelt, Pech gehabt')
  })

  it('Range: Entry beim späten Test am 10.09. → gut mit Warnung „zu spät“ (der Flush vom 11.09. holt den Stop)', () => {
    const sz = SZENARIEN['s-range-btc-sep23']
    const c = kerzen(sz)
    const b = spiele(sz, c, 520, order({ typ: 'market', stopLoss: 25150, takeProfit: 26350 }))
    const r = bewerteSzenario(sz, c, b.trades, b.offeneOrder)
    expect(b.trades[0]?.exitGrund).toBe('sl')
    expect(r.bewertung).toBe('gut')
    expect(r.grund).toBe('zuSpaet')
    expect(r.bilanz.fazit).toContain('Pech gehabt')
  })
})

describe('Konsistenz aller geführten Übungen', () => {
  const setups = Object.values(SZENARIEN).filter((s) => s.richtung !== 'keiner')

  it('Aufgabentext und Feedback nennen keine eigenen Zonen/Daten mehr — nur Platzhalter', () => {
    for (const sz of setups) {
      expect(sz.aufgabe, sz.id).not.toContain('{fenster}') // Fenster würde das Datum verraten
      for (const t of Object.values(sz.feedback)) expect(t, sz.id).not.toMatch(/\d{1,2}\.–\d{1,2}\. ?[A-Z][a-z]{2}/)
    }
  })

  it('jede kuratierte Setup-Übung hat Trigger und Stop-Regel, der Trigger liegt im Replay vor dem Fenster', () => {
    for (const sz of setups) {
      const k = sz.kriterien!
      expect(k.trigger, sz.id).toBeDefined()
      expect(k.stopRegel, sz.id).toBeDefined()
      expect(k.trigger!.bar, sz.id).toBeGreaterThanOrEqual(sz.startIndex)
      expect(k.trigger!.bar, sz.id).toBeLessThanOrEqual(sz.entryZone!.barVon)
      const long = sz.richtung === 'long'
      // Stop-Regel-Level liegt auf der richtigen Seite des Ideal-Entrys, Ideal-SL erfüllt die Regel
      expect(long ? k.stopRegel!.level < sz.idealEntry! : k.stopRegel!.level > sz.idealEntry!, sz.id).toBe(true)
      expect(long ? sz.idealStopLoss! < k.stopRegel!.level : sz.idealStopLoss! > k.stopRegel!.level, sz.id).toBe(true)
    }
  })

  it('Platzhalter werden aus Config und Kerzen gefüllt', () => {
    const sz = SZENARIEN['s-trend-btc-feb24']
    const c = kerzen(sz)
    expect(textFuellen(sz.aufgabe, sz)).toContain('50.400–51.600 $')
    expect(textFuellen(sz.feedback.verpasst, sz, c)).toContain('20.02.2024–26.02.2024')
    expect(textFuellen('{trigger}', sz, c)).toBe('20.02.2024, 16:00')
  })

  for (const sz of setups) {
    it(`${sz.id}: Ideal-Trade liegt in der Zone und geht ab seinem Entry (nach dem Trigger) auf`, () => {
      const c = kerzen(sz)
      const z = sz.entryZone!
      expect(sz.idealEntry).toBeGreaterThanOrEqual(z.preisVon)
      expect(sz.idealEntry).toBeLessThanOrEqual(z.preisBis)
      expect(z.barVon).toBeGreaterThanOrEqual(sz.startIndex)
      expect(z.barBis).toBeLessThanOrEqual(sz.endIndex)

      const ideal = idealTrade(sz, c)
      expect(ideal, 'Ideal-Entry wird im Fenster berührt').not.toBeNull()
      expect(ideal!.entryIndex).toBeGreaterThanOrEqual(sz.kriterien?.trigger?.bar ?? z.barVon)
      expect(ideal!.crv).toBeGreaterThanOrEqual(KRITERIEN.minCrv)
      expect(ideal!.exitGrund, `${sz.id}: Ideal-Trade ab Bar ${ideal!.entryIndex}`).toBe('tp')

      // Die Bewertung selbst hält den Ideal-Trade für perfekt
      const trade: Trade = {
        id: 'ideal',
        richtung: sz.richtung as 'long' | 'short',
        entryPreis: ideal!.entry,
        exitPreis: ideal!.takeProfit,
        entryTime: ideal!.entryTime,
        exitTime: ideal!.exitTime!,
        menge: 1,
        stopLoss: ideal!.stopLoss,
        takeProfit: ideal!.takeProfit,
        pnl: 1,
        rMultiple: ideal!.crv,
        exitGrund: 'tp',
      }
      const r = bewerteSzenario(sz, c, [trade])
      expect(r.bewertung, r.kriterien.map((k) => `${k.id}:${k.status}`).join(' ')).toBe('perfekt')
    })
  }
})
