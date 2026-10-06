import { describe, it, expect } from 'vitest'
import {
  dateiLesen,
  dateiText,
  ordnerNormalisieren,
  repoNormalisieren,
  teilZusammenfuehren,
  type FortschrittStand,
} from './gitSync'
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

const leer: FortschrittStand = { abgeschlosseneLektionen: {}, szenarioErgebnisse: {}, wiederholungen: {} }

describe('Git-Sync: Ziel', () => {
  it('nimmt konto/name und GitHub-Adressen', () => {
    expect(repoNormalisieren(' max/daten ')).toBe('max/daten')
    expect(repoNormalisieren('https://github.com/max/chart-akademie-daten.git')).toBe('max/chart-akademie-daten')
    expect(repoNormalisieren('github.com/max/daten/')).toBe('max/daten')
    expect(repoNormalisieren('daten')).toBeNull()
    expect(repoNormalisieren('max/daten/tree/main')).toBeNull()
  })

  it('räumt den Ordner auf', () => {
    expect(ordnerNormalisieren('/chartakademie/')).toBe('chartakademie')
    expect(ordnerNormalisieren(' sicherung \\ pc ')).toBe('sicherung/pc')
    expect(ordnerNormalisieren('')).toBe('')
  })
})

describe('Git-Sync: Dateien', () => {
  it('Journal übersteht Schreiben und Lesen', () => {
    const stand = { tradeHistorie: [trade('a', 5), trade('b', -3, 20)], rueckblicke: [] }
    expect(dateiLesen('journal', dateiText('journal', stand))).toEqual(stand)
  })

  it('gleicher Stand ergibt denselben Text — unabhängig von der Reihenfolge', () => {
    const a = dateiText('journal', { tradeHistorie: [trade('a', 5), trade('b', 1)], rueckblicke: [] })
    const b = dateiText('journal', { tradeHistorie: [trade('b', 1), trade('a', 5)], rueckblicke: [] })
    expect(a).toBe(b)

    const l1 = { quizProzent: 80, abgeschlossenAm: 1 }
    const l2 = { abgeschlossenAm: 2, quizProzent: 100 }
    const x = dateiText('fortschritt', { ...leer, abgeschlosseneLektionen: { 'l1-01': l1, 'l1-02': l2 } })
    const y = dateiText('fortschritt', { ...leer, abgeschlosseneLektionen: { 'l1-02': l2, 'l1-01': l1 } })
    expect(x).toBe(y)
  })

  it('weist fremde und vertauschte Dateien ab', () => {
    expect(dateiLesen('journal', 'kein json')).toBeNull()
    expect(dateiLesen('journal', '{"foo":1}')).toBeNull()
    expect(dateiLesen('journal', dateiText('fortschritt', leer))).toBeNull()
    expect(dateiLesen('fortschritt', dateiText('fortschritt', leer))).toEqual(leer)
  })

  it('führt zusammen wie der Datei-Import', () => {
    const j = teilZusammenfuehren(
      'journal',
      { tradeHistorie: [trade('a', 5)], rueckblicke: [] },
      { tradeHistorie: [trade('a', 5), trade('c', 7, 20)], rueckblicke: [] },
    )
    expect(j.tradeHistorie.map((t) => t.id)).toEqual(['a', 'c'])

    const f = teilZusammenfuehren(
      'fortschritt',
      { ...leer, abgeschlosseneLektionen: { 'l1-01': { quizProzent: 70, abgeschlossenAm: 1 } } },
      { ...leer, abgeschlosseneLektionen: { 'l1-01': { quizProzent: 100, abgeschlossenAm: 2 } } },
    )
    expect(f.abgeschlosseneLektionen['l1-01'].quizProzent).toBe(100)
  })
})
