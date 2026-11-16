import { describe, it, expect, beforeEach } from 'vitest'
import { anfrage, fakeEnv } from '../test/fakeKv'
import { adminRoute } from './admin'
import { codeCacheLeeren, zugangPruefen, DIENST, type Zugang } from './zugang'
import { CODE_REGEX } from '../../src/zugang/code'

const nutzer: Zugang = { nutzerId: 'n1', name: 'N', rolle: 'nutzer', kiLimitTag: 10 }
const u = (p: string) => new URL(`https://worker.test${p}`)

describe('Admin-Codes', () => {
  beforeEach(() => codeCacheLeeren())

  it('Nutzer dürfen nicht', async () => {
    const { env } = fakeEnv()
    await expect(adminRoute(anfrage('/api/admin/codes'), env, u('/api/admin/codes'), nutzer)).rejects.toMatchObject({ status: 403 })
  })

  it('anlegen → Code funktioniert, Liste zeigt ihn, sperren → 403, löschen → 401', async () => {
    const { env } = fakeEnv()
    const r = await adminRoute(
      anfrage('/api/admin/codes', { method: 'POST', body: JSON.stringify({ name: 'Anna Müller', kiLimitTag: 3 }) }),
      env,
      u('/api/admin/codes'),
      DIENST,
    )
    expect(r!.status).toBe(201)
    const { code, eintrag } = (await r!.json()) as { code: string; eintrag: { nutzerId: string } }
    expect(code).toMatch(CODE_REGEX)
    expect(eintrag.nutzerId).toMatch(/^anna-mueller-[a-z0-9]{4}$/)

    const z = await zugangPruefen(anfrage('/', { token: code }), env)
    expect(z).toMatchObject({ name: 'Anna Müller', kiLimitTag: 3 })

    const l = await adminRoute(anfrage('/api/admin/codes'), env, u('/api/admin/codes'), DIENST)
    const { codes } = (await l!.json()) as { codes: { nutzerId: string; kiLimitTag?: number }[] }
    expect(codes).toHaveLength(1)
    expect(codes[0]).toMatchObject({ nutzerId: eintrag.nutzerId, kiLimitTag: 3 })

    const pfad = `/api/admin/codes/${eintrag.nutzerId}`
    await adminRoute(anfrage(pfad, { method: 'PATCH', body: JSON.stringify({ gesperrt: true }) }), env, u(pfad), DIENST)
    await expect(zugangPruefen(anfrage('/', { token: code }), env)).rejects.toMatchObject({ status: 403 })

    await adminRoute(anfrage(pfad, { method: 'DELETE' }), env, u(pfad), DIENST)
    await expect(zugangPruefen(anfrage('/', { token: code }), env)).rejects.toMatchObject({ status: 401 })
  })

  it('feste Id, doppelte Id → 409', async () => {
    const { env } = fakeEnv()
    const body = JSON.stringify({ name: 'Max', nutzerId: 'admin', rolle: 'admin' })
    const r = await adminRoute(anfrage('/api/admin/codes', { method: 'POST', body }), env, u('/api/admin/codes'), DIENST)
    expect(((await r!.json()) as { eintrag: { nutzerId: string; rolle: string } }).eintrag).toMatchObject({ nutzerId: 'admin', rolle: 'admin' })
    await expect(adminRoute(anfrage('/api/admin/codes', { method: 'POST', body }), env, u('/api/admin/codes'), DIENST)).rejects.toMatchObject({ status: 409 })
  })
})
