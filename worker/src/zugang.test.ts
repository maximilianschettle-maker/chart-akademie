import { describe, it, expect, beforeEach } from 'vitest'
import { anfrage, fakeEnv } from '../test/fakeKv'
import { codeCacheLeeren, codeHash, codeKey, nutzerKey, zugangPruefen, type CodeEintrag } from './zugang'
import { HttpFehler } from './http'

const CODE = 'CA-ABCD-EFGH-JK23'

async function mitCode(kv: ReturnType<typeof fakeEnv>['kv'], eintrag: Partial<CodeEintrag> = {}) {
  const hash = await codeHash(CODE)
  const voll: CodeEintrag = { nutzerId: 'anna-x1', name: 'Anna', rolle: 'nutzer', angelegtAm: 1, ...eintrag }
  await kv.put(codeKey(hash), JSON.stringify(voll), { metadata: { nutzerId: voll.nutzerId, name: voll.name, rolle: voll.rolle } })
  await kv.put(nutzerKey(voll.nutzerId), JSON.stringify({ codeHash: hash }))
}

async function fehler(p: Promise<unknown>): Promise<HttpFehler> {
  try {
    await p
  } catch (e) {
    return e as HttpFehler
  }
  throw new Error('kein Fehler')
}

describe('zugangPruefen', () => {
  beforeEach(() => codeCacheLeeren())

  it('Dienst-Token → Rolle dienst, unbegrenzt', async () => {
    const { env } = fakeEnv('geheim')
    const z = await zugangPruefen(anfrage('/api/status', { token: 'geheim' }), env)
    expect(z).toMatchObject({ nutzerId: 'admin', rolle: 'dienst', kiLimitTag: null })
  })

  it('ohne Token 401', async () => {
    const { env } = fakeEnv()
    expect((await fehler(zugangPruefen(anfrage('/api/status'), env))).status).toBe(401)
  })

  it('gültiger Code, auch klein und ohne Striche', async () => {
    const { env, kv } = fakeEnv()
    await mitCode(kv)
    const z = await zugangPruefen(anfrage('/api/ich', { token: 'ca abcd efgh jk23' }), env)
    expect(z).toMatchObject({ nutzerId: 'anna-x1', name: 'Anna', rolle: 'nutzer', kiLimitTag: 10 })
  })

  it('eigenes Limit und Admin ohne Limit', async () => {
    const { env, kv } = fakeEnv()
    await mitCode(kv, { kiLimitTag: 25 })
    expect((await zugangPruefen(anfrage('/', { token: CODE }), env)).kiLimitTag).toBe(25)
    codeCacheLeeren()
    await mitCode(kv, { rolle: 'admin' })
    expect((await zugangPruefen(anfrage('/', { token: CODE }), env)).kiLimitTag).toBeNull()
  })

  it('unbekannter Code 401, gesperrt 403', async () => {
    const { env, kv } = fakeEnv()
    expect((await fehler(zugangPruefen(anfrage('/', { token: 'CA-ZZZZ-ZZZZ-ZZZZ' }), env))).status).toBe(401)
    expect((await fehler(zugangPruefen(anfrage('/', { token: 'kein-code' }), env))).status).toBe(401)
    await mitCode(kv, { gesperrt: true })
    expect((await fehler(zugangPruefen(anfrage('/', { token: CODE }), env))).status).toBe(403)
  })

  it('Cache: zweite Prüfung liest KV nicht erneut', async () => {
    const { env, kv } = fakeEnv()
    await mitCode(kv)
    await zugangPruefen(anfrage('/', { token: CODE }), env)
    kv.daten.clear()
    expect((await zugangPruefen(anfrage('/', { token: CODE }), env)).nutzerId).toBe('anna-x1')
  })
})
