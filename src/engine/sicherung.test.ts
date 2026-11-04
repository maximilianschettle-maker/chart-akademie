import { describe, it, expect } from 'vitest'
import {
  sicherungErstellen,
  istSicherung,
  sicherungZusammenfuehren,
  kontostandAus,
  mergeRueckblicke,
} from './sicherung'
import type { Trade } from '../types'

function trade(id: string, pnl: number, exitTime = 10): Trade {
  return {
    id,
    richtung: 'long',
    entryPreis: 100,
    exitPreis: 101,
    entryTime: 1,
    exitTime,
    menge: 1,
    stopLoss: 90,
    takeProfit: 120,
    pnl,
    rMultiple: pnl / 10,
    exitGrund: 'tp',
  }
}

const leer = { abgeschlosseneLektionen: {}, szenarioErgebnisse: {}, wiederholungen: {} }

describe('Sicherung', () => {
  it('erstellt eine erkennbare Sicherung', () => {
    const s = sicherungErstellen([trade('a', 5)], leer, new Date(0))
    expect(istSicherung(s)).toBe(true)
    expect(istSicherung({ foo: 1 })).toBe(false)
    expect(istSicherung(JSON.parse(JSON.stringify(s)))).toBe(true)
  })

  it('Import dedupliziert Trades per Id und zählt neue', () => {
    const aktuell = { tradeHistorie: [trade('a', 5), trade('b', -3)], fortschritt: leer }
    const imp = sicherungErstellen([trade('b', -3), trade('c', 7, 20)], leer)
    const r = sicherungZusammenfuehren(aktuell, imp)
    expect(r.tradeHistorie.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(r.neueTrades).toBe(1)
    expect(kontostandAus(10000, r.tradeHistorie)).toBe(10009)
  })

  it('behält je Lektion/Übung das bessere Ergebnis', () => {
    const aktuell = {
      tradeHistorie: [],
      fortschritt: {
        abgeschlosseneLektionen: { 'l1-01': { quizProzent: 70, abgeschlossenAm: 1 } },
        szenarioErgebnisse: { s1: { bewertung: 'ok' as const, rMultiple: 0.5 } },
        wiederholungen: { 'l1-01#0': { lektionId: 'l1-01', frageIndex: 0, stufe: 1, faelligAm: 500, fehlversuche: 1 } },
      },
    }
    const imp = sicherungErstellen([], {
      abgeschlosseneLektionen: { 'l1-01': { quizProzent: 100, abgeschlossenAm: 2 }, 'l1-02': { quizProzent: 80, abgeschlossenAm: 3 } },
      szenarioErgebnisse: { s1: { bewertung: 'falsch', rMultiple: -1 }, s2: { bewertung: 'perfekt', rMultiple: 2 } },
      wiederholungen: { 'l1-01#0': { lektionId: 'l1-01', frageIndex: 0, stufe: 0, faelligAm: 100, fehlversuche: 2 } },
    })
    const r = sicherungZusammenfuehren(aktuell, imp)
    expect(r.fortschritt.abgeschlosseneLektionen['l1-01'].quizProzent).toBe(100)
    expect(Object.keys(r.fortschritt.abgeschlosseneLektionen)).toHaveLength(2)
    expect(r.fortschritt.szenarioErgebnisse.s1.bewertung).toBe('ok')
    expect(r.fortschritt.szenarioErgebnisse.s2.bewertung).toBe('perfekt')
    expect(r.fortschritt.wiederholungen['l1-01#0'].stufe).toBe(1)
  })
})

describe('Setup-Rückblicke in der Sicherung', () => {
  const rb = (sitzungId: string, erstelltAm: number, trades = 0) => ({
    sitzungId,
    symbol: 'BTCUSDT',
    interval: '1h',
    erstelltAm,
    kerzen: 100,
    eintraege: [],
    trades,
    tradesOhneSetup: 0,
  })

  it('landen im Export und überstehen JSON', () => {
    const s = sicherungErstellen([], leer, new Date(0), [rb('a', 1)])
    expect(JSON.parse(JSON.stringify(s)).simulator.rueckblicke).toHaveLength(1)
  })

  it('werden je Sitzung zusammengeführt — der neuere Stand gewinnt', () => {
    const r = mergeRueckblicke([rb('a', 1, 1), rb('b', 2)], [rb('a', 5, 7), rb('c', 3)])
    expect(r.map((x) => x.sitzungId)).toEqual(['b', 'c', 'a'])
    expect(r.find((x) => x.sitzungId === 'a')?.trades).toBe(7)
  })
})

describe('Echte Trades in der Sicherung', () => {
  it('landen im Export, fehlen in alten Dateien ohne Fehler', async () => {
    const { sicherungEintraege, sicherungErstellen, istSicherung } = await import('./sicherung')
    const { neuerEintrag } = await import('../journal/engine')
    const e = neuerEintrag(
      { markt: 'Gold', symbol: 'GC=F', waehrung: 'USD', richtung: 'long', entryTime: 1, entryPreis: 4000, stopLoss: 3980, takeProfit: 4040, risikoProzent: 1, strategieId: 'sr-bounce', zeitrahmen: '1h', imPlan: null },
      7,
    )
    const s = sicherungErstellen([], { abgeschlosseneLektionen: {}, szenarioErgebnisse: {}, wiederholungen: {} }, new Date(0), [], [e])
    const wieder = JSON.parse(JSON.stringify(s))
    expect(istSicherung(wieder)).toBe(true)
    expect(sicherungEintraege(wieder)).toHaveLength(1)
    delete wieder.journal
    expect(istSicherung(wieder)).toBe(true)
    expect(sicherungEintraege(wieder)).toEqual([])
  })
})
