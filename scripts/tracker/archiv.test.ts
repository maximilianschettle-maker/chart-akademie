import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { archivAktualisieren, archivPfad, mergeKompakt } from './archiv'
import type { Candle } from '../../src/types'

const k = (time: number, close: number): Candle => ({ time, open: close, high: close + 1, low: close - 1, close, volume: 1 })

describe('Kerzen-Archiv', () => {
  it('mischt nach Zeit, neue Kerze gewinnt, sortiert, kappt', () => {
    const alt = [[100, 1, 2, 0, 1, 1], [200, 1, 2, 0, 1, 1]]
    const neu = [[200, 5, 6, 4, 5, 1], [300, 1, 2, 0, 1, 1]]
    expect(mergeKompakt(alt, neu, 10).map((x) => [x[0], x[1]])).toEqual([[100, 1], [200, 5], [300, 1]])
    expect(mergeKompakt(alt, neu, 2).map((x) => x[0])).toEqual([200, 300])
  })

  it('schreibt neue Kerzen ohne die offene letzte, danach nichts mehr', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'ca-archiv-'))
    try {
      const kerzen = [k(900, 10), k(1800, 11), k(2700, 12), k(3600, 13)]
      const a = archivAktualisieren(wurzel, 'gold', '15m', kerzen)
      expect(a).toEqual({ geschrieben: true, anzahl: 3, neue: 3 })
      const datei = JSON.parse(readFileSync(archivPfad(wurzel, 'gold', '15m'), 'utf8')) as number[][]
      expect(datei.map((x) => x[0])).toEqual([900, 1800, 2700])
      // gleicher Lauf nochmal → nichts Neues
      expect(archivAktualisieren(wurzel, 'gold', '15m', kerzen).geschrieben).toBe(false)
      // eine Kerze weiter → die vorher offene wird fertig
      const b = archivAktualisieren(wurzel, 'gold', '15m', [...kerzen, k(4500, 14)])
      expect(b).toEqual({ geschrieben: true, anzahl: 4, neue: 1 })
    } finally {
      rmSync(wurzel, { recursive: true, force: true })
    }
  })

  it('Stundenarchiv nur bei neuem Tag schreiben', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'ca-archiv-'))
    try {
      const tag = 86_400
      const kerzen = [k(tag * 10 + 3600, 1), k(tag * 10 + 7200, 2), k(tag * 10 + 10800, 3)]
      expect(archivAktualisieren(wurzel, 'oel', '1h', kerzen, true).geschrieben).toBe(true)
      // neue Kerze am selben Tag → nicht schreiben
      expect(archivAktualisieren(wurzel, 'oel', '1h', [...kerzen, k(tag * 10 + 14400, 4)], true).geschrieben).toBe(false)
      // neue Kerze am nächsten Tag → schreiben, alles nachgetragen
      const c = archivAktualisieren(wurzel, 'oel', '1h', [...kerzen, k(tag * 10 + 14400, 4), k(tag * 11 + 3600, 5), k(tag * 11 + 7200, 6)], true)
      expect(c.geschrieben).toBe(true)
      expect(c.anzahl).toBe(5)
    } finally {
      rmSync(wurzel, { recursive: true, force: true })
    }
  })
})
