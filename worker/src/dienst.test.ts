import { describe, it, expect } from 'vitest'
import { anfrage, fakeEnv } from '../test/fakeKv'
import { dienstRoute } from './dienst'
import { pushRoute } from './push'
import { nutzerSchreiben } from './nutzerDaten'
import { kvSchreiben } from './cache'
import { DIENST, type Zugang } from './zugang'
import { STANDARD_CONFIG } from '../../src/tracker/engine/katalog'

const u = (p: string) => new URL(`https://worker.test${p}`)
const nutzer = (id: string): Zugang => ({ nutzerId: id, name: id, rolle: 'nutzer', kiLimitTag: 10 })
const abo = (n: number) => ({ endpoint: `https://push.test/${n}`, keys: { p256dh: 'p', auth: 'a' }, geraet: 'Handy' })

describe('Dienst-Endpunkte', () => {
  it('Tracker-Union über Nutzer-Keys und den Legacy-Key des Owners', async () => {
    const { env } = fakeEnv()
    const [a, b, c] = STANDARD_CONFIG.instrumente
    await kvSchreiben(env, 'tracker', { ...STANDARD_CONFIG, instrumente: [a], aktualisiertAm: 1 }) // alt: global = Owner
    await nutzerSchreiben(env, 'tracker', 'n1', { ...STANDARD_CONFIG, instrumente: [b, c], aktualisiertAm: 2 })
    const r = await dienstRoute(anfrage('/api/dienst/tracker'), env, u('/api/dienst/tracker'), DIENST)
    const d = (await r!.json()) as { config: { instrumente: string[] }; nutzer: number }
    expect(d.nutzer).toBe(2)
    expect(d.config.instrumente.sort()).toEqual([a, b, c].sort())
  })

  it('Push-Abos je Nutzer, abgelaufene entfernen', async () => {
    const { env } = fakeEnv()
    const put = (id: string, n: number) =>
      pushRoute(anfrage('/api/push/abo', { method: 'PUT', body: JSON.stringify(abo(n)) }), env, u('/api/push/abo'), nutzer(id))
    await put('n1', 1)
    await put('n1', 2)
    await put('n2', 3)
    let r = await dienstRoute(anfrage('/api/dienst/push'), env, u('/api/dienst/push'), DIENST)
    let d = (await r!.json()) as { nutzer: { nutzerId: string; abos: unknown[] }[] }
    expect(d.nutzer.map((n) => [n.nutzerId, n.abos.length])).toEqual([
      ['n1', 2],
      ['n2', 1],
    ])

    const body = JSON.stringify({ abgelaufen: [{ nutzerId: 'n1', endpoint: 'https://push.test/1' }] })
    r = await dienstRoute(anfrage('/api/dienst/push/abgelaufen', { method: 'POST', body }), env, u('/api/dienst/push/abgelaufen'), DIENST)
    expect(await r!.json()).toEqual({ entfernt: 1 })
    r = await dienstRoute(anfrage('/api/dienst/push'), env, u('/api/dienst/push'), DIENST)
    d = (await r!.json()) as typeof d
    expect(d.nutzer.find((n) => n.nutzerId === 'n1')!.abos).toHaveLength(1)
  })

  it('Nutzer kommen nicht an Dienst-Endpunkte', async () => {
    const { env } = fakeEnv()
    await expect(dienstRoute(anfrage('/api/dienst/push'), env, u('/api/dienst/push'), nutzer('n1'))).rejects.toMatchObject({ status: 403 })
  })
})
