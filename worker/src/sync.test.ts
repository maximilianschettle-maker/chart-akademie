import { describe, it, expect } from 'vitest'
import { anfrage, fakeEnv } from '../test/fakeKv'
import { syncRoute } from './sync'
import type { Zugang } from './zugang'

const z: Zugang = { nutzerId: 'n1', name: 'N', rolle: 'nutzer', kiLimitTag: 10 }
const trade = (id: string, exitTime: number) => ({ id, exitTime, entryTime: exitTime - 1, pnl: 1 })
const put = (body: unknown) => anfrage('/api/sync/journal', { method: 'PUT', body: JSON.stringify(body) })
const url = new URL('https://worker.test/api/sync/journal')

describe('Sync-Endpunkt Journal', () => {
  it('GET ohne Stand → null; PUT mergt und liefert den Stand', async () => {
    const { env, kv } = fakeEnv()
    const leer = await syncRoute(anfrage('/api/sync/journal'), env, url, z)
    expect(await leer!.json()).toBeNull()

    const a = await syncRoute(put({ tradeHistorie: [trade('a', 5)], rueckblicke: [], eintraege: [] }), env, url, z)
    expect(a!.status).toBe(200)
    const b = await syncRoute(put({ tradeHistorie: [trade('b', 3)] }), env, url, z)
    const stand = (await b!.json()) as { tradeHistorie: { id: string }[]; standAm: number }
    expect(stand.tradeHistorie.map((t) => t.id)).toEqual(['b', 'a'])
    expect(kv.schreibvorgaenge).toBe(2)

    // gleicher Stand nochmal → kein KV-Write
    await syncRoute(put({ tradeHistorie: [trade('a', 5), trade('b', 3)] }), env, url, z)
    expect(kv.schreibvorgaenge).toBe(2)
  })
  it('lehnt Müll ab', async () => {
    const { env } = fakeEnv()
    await expect(syncRoute(put([1, 2]), env, url, z)).rejects.toMatchObject({ status: 400 })
  })
  it('Nutzer sehen nur den eigenen Stand', async () => {
    const { env } = fakeEnv()
    await syncRoute(put({ tradeHistorie: [trade('a', 5)] }), env, url, z)
    const andere = await syncRoute(anfrage('/api/sync/journal'), env, url, { ...z, nutzerId: 'n2' })
    expect(await andere!.json()).toBeNull()
  })
})
