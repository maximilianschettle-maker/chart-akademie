import { describe, it, expect, afterEach, vi } from 'vitest'
import { GitFehler, standHolen, standPushen, vonBase64, zuBase64 } from './githubClient'
import { dateiLesen, dateiText, type SyncStand } from '../engine/gitSync'
import type { Trade } from '../types'

function trade(id: string, notiz?: string): Trade {
  return {
    id,
    richtung: 'long',
    entryPreis: 100,
    exitPreis: 101,
    entryTime: 1,
    exitTime: 10,
    menge: 1,
    stopLoss: 90,
    takeProfit: 120,
    pnl: 5,
    rMultiple: 0.5,
    exitGrund: 'tp',
    notiz,
  }
}

const leer = { abgeschlosseneLektionen: {}, szenarioErgebnisse: {}, wiederholungen: {} }
const stand = (...ids: string[]): SyncStand => ({
  journal: { tradeHistorie: ids.map((id) => trade(id)), rueckblicke: [] },
  fortschritt: leer,
})
const ziel = { repo: 'max/daten', ordner: 'chartakademie', token: 't' }

/** Nachbau der Contents-API: Dateien im Speicher, sha zählt je Schreibvorgang hoch. */
function falschesGitHub(opts: { push?: boolean; existiert?: boolean } = {}) {
  const dateien = new Map<string, { text: string; sha: string }>()
  const commits: string[] = []
  let zaehler = 0
  let einmal409 = false
  const antwort = (status: number, body: unknown = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const pfad = new URL(url).pathname
    if (pfad === '/repos/max/daten') {
      return opts.existiert === false ? antwort(404) : antwort(200, { permissions: { push: opts.push ?? true } })
    }
    const name = decodeURIComponent(pfad.replace('/repos/max/daten/contents/', ''))
    if (init.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string; message: string }
      if (einmal409) {
        einmal409 = false
        return antwort(409)
      }
      if (dateien.get(name)?.sha !== body.sha) return antwort(409)
      // wie GitHub: unter einer Datei kann kein Ordner entstehen
      if (dateien.has(name.split('/')[0]) && name.includes('/')) return antwort(409)
      dateien.set(name, { text: vonBase64(body.content), sha: `sha${++zaehler}` })
      commits.push(body.message)
      return antwort(200)
    }
    const d = dateien.get(name)
    return d ? antwort(200, { content: zuBase64(d.text), sha: d.sha, size: d.text.length }) : antwort(404)
  })

  return {
    dateien,
    commits,
    lege: (name: string, text: string) => dateien.set(name, { text, sha: `sha${++zaehler}` }),
    konfliktBeimNaechstenPush: () => (einmal409 = true),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('GitHub-Client', () => {
  it('Base64 verträgt Umlaute und große Inhalte', () => {
    const text = 'Rücksetzer — „Retest“ ✓ '.repeat(5000)
    expect(vonBase64(zuBase64(text))).toBe(text)
  })

  it('Push legt die Dateien an, Holen liest sie zurück', async () => {
    const gh = falschesGitHub()
    const lokal = stand('a', 'b')
    lokal.journal.tradeHistorie[0].notiz = 'Rücksetzer an die Range-Decke'
    expect(await standPushen(ziel, ['journal', 'fortschritt'], lokal)).toEqual(['journal', 'fortschritt'])
    expect([...gh.dateien.keys()]).toEqual(['chartakademie/journal.json', 'chartakademie/fortschritt.json'])
    expect(gh.commits[0]).toBe('ChartAkademie: Journal (2 Trades)')
    expect(await standHolen(ziel, ['journal', 'fortschritt'])).toEqual(lokal)
  })

  it('unveränderter Stand ergibt keinen Commit', async () => {
    const gh = falschesGitHub()
    await standPushen(ziel, ['journal'], stand('a'))
    expect(await standPushen(ziel, ['journal'], stand('a'))).toEqual([])
    expect(gh.commits).toHaveLength(1)
  })

  it('Push führt mit dem Stand im Repository zusammen, „ersetzen“ überschreibt', async () => {
    const gh = falschesGitHub()
    await standPushen(ziel, ['journal'], stand('a'))
    await standPushen(ziel, ['journal'], stand('b'))
    const ids = () =>
      dateiLesen('journal', gh.dateien.get('chartakademie/journal.json')!.text)!.tradeHistorie.map((t) => t.id)
    expect(ids()).toEqual(['a', 'b'])
    await standPushen(ziel, ['journal'], stand('c'), true)
    expect(ids()).toEqual(['c'])
  })

  it('wiederholt den Push einmal, wenn ein anderes Gerät dazwischenkam', async () => {
    const gh = falschesGitHub()
    await standPushen(ziel, ['journal'], stand('a'))
    gh.konfliktBeimNaechstenPush()
    expect(await standPushen(ziel, ['journal'], stand('b'))).toEqual(['journal'])
    expect(gh.commits).toHaveLength(2)
  })

  it('Holen lässt fehlende Dateien aus und meldet fremde', async () => {
    const gh = falschesGitHub()
    expect(await standHolen(ziel, ['journal', 'fortschritt'])).toEqual({})
    gh.lege('chartakademie/fortschritt.json', dateiText('fortschritt', leer))
    expect(await standHolen(ziel, ['journal', 'fortschritt'])).toEqual({ fortschritt: leer })
    gh.lege('chartakademie/journal.json', '{"etwas":"anderes"}')
    await expect(standHolen(ziel, ['journal'])).rejects.toThrow(/keine ChartAkademie-Datei/)
    // …und ein Push mischt sich nicht in eine fremde Datei
    await expect(standPushen(ziel, ['journal'], stand('a'))).rejects.toThrow(GitFehler)
  })

  it('erklärt, wenn eine Datei den Ordner blockiert', async () => {
    const gh = falschesGitHub()
    gh.lege('chartakademie', ' ')
    await expect(standPushen(ziel, ['journal'], stand('a'))).rejects.toThrow(/Datei namens „chartakademie“/)
    expect(gh.commits).toHaveLength(0)
  })

  it('meldet fehlendes Repository und fehlendes Schreibrecht verständlich', async () => {
    falschesGitHub({ existiert: false })
    await expect(standHolen(ziel, ['journal'])).rejects.toThrow(/nicht gefunden/)
    falschesGitHub({ push: false })
    await expect(standPushen(ziel, ['journal'], stand('a'))).rejects.toThrow(/nicht schreiben/)
  })
})
