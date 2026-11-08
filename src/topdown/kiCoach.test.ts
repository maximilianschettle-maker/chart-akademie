import { describe, expect, it } from 'vitest'
import { alsEintrag, uebungsFakten } from './kiCoach'
import type { Candle } from '../types'

const k = (time: number, p: number): Candle => ({ time, open: p, high: p + 1, low: p - 1, close: p + 0.5, volume: 1 })

describe('KI-Coach für Übungs-Trades', () => {
  const kerzen = Array.from({ length: 200 }, (_, i) => k(1000 + i * 900, 100 + i * 0.1))

  it('baut einen Pseudo-Eintrag mit Status aus dem Ausstieg', () => {
    const offen = alsEintrag({ markt: 'Gold', symbol: 'GC=F', waehrung: 'USD', richtung: 'long', entryTime: 1000 + 150 * 900, entryPreis: 115, stopLoss: 113, takeProfit: 119, strategieId: 'range-trading', zeitrahmen: '15m' })
    expect(offen.status).toBe('offen')
    expect(offen.zeitrahmen).toBe('15m')
    const zu = alsEintrag({ markt: 'Gold', symbol: 'GC=F', waehrung: 'USD', richtung: 'long', entryTime: 1, entryPreis: 115, stopLoss: 113, takeProfit: 119, strategieId: 'range-trading', zeitrahmen: '3m', exitTime: 2, exitPreis: 119, exitGrund: 'ziel' })
    expect(zu.status).toBe('geschlossen')
    expect(zu.zeitrahmen).toBe('1h') // unbekanntes Intervall → Stunde
  })

  it('Fakten enthalten Kerzen bis zum Einstieg und den Übungskontext', () => {
    const f = uebungsFakten(
      { markt: 'Gold', symbol: 'GC=F', waehrung: 'USD', richtung: 'long', entryTime: 1000 + 150 * 900 + 10, entryPreis: 115, stopLoss: 113, takeProfit: 119, strategieId: 'range-trading', zeitrahmen: '15m', exitTime: 1000 + 160 * 900, exitPreis: 119, exitGrund: 'ziel' },
      kerzen,
      { art: 'top-down', tagesRichtung: 'auf', kriterien: [{ titel: 'Zone', ok: true, text: 'liegt an Zone' }] },
      true,
    )
    expect(f.kerzen).toEqual({ intervall: '15m', vorEinstieg: 151, nachEinstieg: 49 })
    expect(f.uebung?.art).toBe('top-down')
    expect(f.uebung?.kriterien?.[0].ok).toBe(true)
    expect(f.ergebnis?.r).toBe(2)
    expect(f.heute).toEqual({ tradesVorher: 0, verlusteVorher: 0 })
    expect(uebungsFakten({ markt: 'Gold', symbol: 'GC=F', waehrung: 'USD', richtung: 'long', entryTime: 5, entryPreis: 115, stopLoss: 113, takeProfit: 119, strategieId: 'range-trading', zeitrahmen: '15m' }, kerzen, { art: 'simulator' }, false).ergebnis).toBeNull()
  })
})
