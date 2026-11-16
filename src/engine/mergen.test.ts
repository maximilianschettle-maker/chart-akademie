import { describe, it, expect } from 'vitest'
import { mergeUebungsLog, stabilJson } from './mergen'

const e = (am: number, szenarioId = 's1', strategieId = 'a') => ({ am, szenarioId, strategieId, bewertung: 'ok' as const, r: 1, gehandelt: true })

describe('mergeUebungsLog', () => {
  it('vereinigt ohne Doppelte, älteste zuerst', () => {
    const out = mergeUebungsLog([e(3), e(1)], [e(2), e(1)])
    expect(out.map((x) => x.am)).toEqual([1, 2, 3])
  })
  it('gleicher Zeitpunkt, anderes Szenario bleibt getrennt', () => {
    expect(mergeUebungsLog([e(1, 's1')], [e(1, 's2')])).toHaveLength(2)
  })
  it('kürzt auf max und behält die neuesten', () => {
    const out = mergeUebungsLog([e(1), e(2), e(3)], [e(4)], 2)
    expect(out.map((x) => x.am)).toEqual([3, 4])
  })
  it('ist kommutativ und idempotent', () => {
    const a = [e(1), e(5)]
    const b = [e(3), e(1)]
    expect(mergeUebungsLog(a, b)).toEqual(mergeUebungsLog(b, a))
    expect(mergeUebungsLog(a, a)).toEqual(a)
  })
})

describe('stabilJson', () => {
  it('sortiert Schlüssel auf allen Ebenen', () => {
    expect(stabilJson({ b: 1, a: { z: 1, y: [{ q: 1, p: 2 }] } }, 0)).toBe('{"a":{"y":[{"p":2,"q":1}],"z":1},"b":1}')
  })
})

describe('Sync-Stände (Fortschritt)', () => {
  it('liest, mergt und normalisiert den Text unabhängig von der Reihenfolge', async () => {
    const { syncStandLesen, syncStandMergen, syncStandText } = await import('./mergen')
    const a = syncStandLesen('fortschritt', { abgeschlosseneLektionen: { l1: { quizProzent: 50 } }, uebungsLog: [e(2), e(1)] })!
    const b = syncStandLesen('fortschritt', { abgeschlosseneLektionen: { l1: { quizProzent: 80 } }, szenarioErgebnisse: { s: { bewertung: 'gut' } }, uebungsLog: [e(1)] })!
    const m = syncStandMergen('fortschritt', a, b)
    expect(m.abgeschlosseneLektionen.l1.quizProzent).toBe(80)
    expect(m.uebungsLog.map((x) => x.am)).toEqual([1, 2])
    expect(syncStandText('fortschritt', m)).toBe(syncStandText('fortschritt', syncStandMergen('fortschritt', b, a)))
    expect(syncStandLesen('fortschritt', 'kaputt')).toBeNull()
  })
})
