import { describe, it, expect } from 'vitest'
import { AKTIEN_STORE_VERSION, migriereAktienStand } from './store'

describe('Aktien-Store Migration', () => {
  it('v1: secret wird zum Code, workerUrl fällt weg, Rest bleibt', () => {
    const alt = { workerUrl: 'https://alt.workers.dev', secret: ' geheim ', watchlist: [{ symbol: 'AAPL' }], vergleichsWaehrung: 'EUR' }
    const neu = migriereAktienStand(alt, 1)
    expect(neu).toEqual({ code: 'geheim', watchlist: [{ symbol: 'AAPL' }], vergleichsWaehrung: 'EUR' })
    expect('workerUrl' in neu).toBe(false)
  })
  it('v1 ohne secret → leerer Code', () => {
    expect(migriereAktienStand({ workerUrl: 'x' }, 1)).toEqual({ code: '' })
  })
  it('aktuelle Version bleibt unverändert', () => {
    const g = { code: 'CA-AAAA-BBBB-CCCC', watchlist: [] }
    expect(migriereAktienStand(g, AKTIEN_STORE_VERSION)).toBe(g)
  })
})
