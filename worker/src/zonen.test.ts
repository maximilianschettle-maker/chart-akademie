import { describe, it, expect } from 'vitest'
import { anfrage, fakeEnv } from '../test/fakeKv'
import { dienstRoute } from './dienst'
import { pushRoute } from './push'
import { zonenAktiv, zonenRoute } from './zonen'
import { trackerLauf } from './cron'
import { DIENST, type Zugang } from './zugang'
import { neueZone } from '../../src/zonen/engine'
import type { ZonenStand } from '../../src/zonen/types'

const u = (p: string) => new URL(`https://worker.test${p}`)
const nutzer = (id: string): Zugang => ({ nutzerId: id, name: id, rolle: 'nutzer', kiLimitTag: 10 })
const stand = (am: number, ...zonen: ZonenStand['zonen']): ZonenStand => ({ zonen, annaeherungProzent: 0.3, aktualisiertAm: am })
const put = (env: ReturnType<typeof fakeEnv>['env'], id: string, s: unknown) =>
  zonenRoute(anfrage('/api/zonen', { method: 'PUT', body: JSON.stringify(s) }), env, u('/api/zonen'), nutzer(id))

describe('Preiszonen im Worker', () => {
  it('speichert bereinigt, neuerer Stand gewinnt', async () => {
    const { env } = fakeEnv()
    const z = neueZone('gold', '1h', 4180, 4195, 4250, 5, 'z1')
    let r = await put(env, 'n1', { ...stand(10, z), zonen: [z, { id: 'kaputt' }] })
    expect(((await r!.json()) as ZonenStand).zonen.map((x) => x.id)).toEqual(['z1'])
    r = await put(env, 'n1', stand(5))
    expect(r!.status).toBe(409)
    expect(((await r!.json()) as ZonenStand).zonen).toHaveLength(1)
    r = await zonenRoute(anfrage('/api/zonen'), env, u('/api/zonen'), nutzer('n1'))
    expect(((await r!.json()) as ZonenStand).aktualisiertAm).toBe(10)
    r = await zonenRoute(anfrage('/api/zonen'), env, u('/api/zonen'), nutzer('n2'))
    expect(await r!.json()).toBeNull()
    await expect(put(env, 'n1', { zonen: 'x' })).rejects.toMatchObject({ status: 400 })
  })

  it('Dienst: nur Nutzer mit Alarm-Zonen, Status schreiben und in der App lesen', async () => {
    const { env } = fakeEnv()
    await put(env, 'n1', stand(1, neueZone('bitcoin', '1h', 90000, 91000, 95000, 5, 'b1')))
    await put(env, 'n2', stand(1, { ...neueZone('gold', '1h', 4180, 4195, 4250, 5, 'g1'), alarm: false }))
    await pushRoute(anfrage('/api/push/abo', { method: 'PUT', body: JSON.stringify({ endpoint: 'https://push.test/1', keys: { p256dh: 'p', auth: 'a' } }) }), env, u('/api/push/abo'), nutzer('n1'))

    let r = await dienstRoute(anfrage('/api/dienst/zonen'), env, u('/api/dienst/zonen'), DIENST)
    const d = (await r!.json()) as { nutzer: { nutzerId: string; status: unknown; abos: unknown[] }[] }
    expect(d.nutzer.map((n) => [n.nutzerId, n.status, n.abos.length])).toEqual([['n1', null, 1]])

    const status = { zustand: { b1: { kanten: '90000|91000', nah: true, drin: false, bruchKerze: 7 } }, alarme: [], aktualisiertAm: 99 }
    r = await dienstRoute(anfrage('/api/dienst/zonen/status', { method: 'POST', body: JSON.stringify({ nutzer: [{ nutzerId: 'n1', status }, { nutzerId: '../x', status }] }) }), env, u('/api/dienst/zonen/status'), DIENST)
    expect(await r!.json()).toEqual({ gespeichert: 1 })
    r = await zonenRoute(anfrage('/api/zonen/status'), env, u('/api/zonen/status'), nutzer('n1'))
    expect(await r!.json()).toEqual(status)
    r = await zonenRoute(anfrage('/api/zonen/status'), env, u('/api/zonen/status'), nutzer('n2'))
    expect(await r!.json()).toMatchObject({ zustand: {}, alarme: [] })

    await expect(dienstRoute(anfrage('/api/dienst/zonen'), env, u('/api/dienst/zonen'), nutzer('n1'))).rejects.toMatchObject({ status: 403 })
  })

  it('zonenAktiv: nur Märkte mit eingeschaltetem Alarm zählen', async () => {
    const { env } = fakeEnv()
    expect(await zonenAktiv(env, ['bitcoin'])).toBe(false)
    await put(env, 'n1', stand(1, neueZone('gold', '1h', 4180, 4195, 4250, 5, 'g1'), { ...neueZone('bitcoin', '1h', 90000, 91000, 95000, 5, 'b1'), alarm: false }))
    expect(await zonenAktiv(env, ['bitcoin'])).toBe(false)
    await put(env, 'n2', stand(1, neueZone('bitcoin', '1h', 90000, 91000, 95000, 5, 'b2')))
    expect(await zonenAktiv(env, ['bitcoin'])).toBe(true)
  })

  it('Tracker-Cron: voller Lauf zu den bisherigen Zeiten, sonst nur Zonen', () => {
    const t = (iso: string) => trackerLauf(new Date(iso))
    expect(t('2026-11-17T07:00:00Z')).toBe('voll') // Dienstag
    expect(t('2026-11-17T22:45:00Z')).toBe('voll')
    expect(t('2026-11-17T23:00:00Z')).toBe('zonen')
    expect(t('2026-11-17T06:45:00Z')).toBe('zonen')
    expect(t('2026-11-21T10:00:00Z')).toBe('voll') // Samstag, gerade Stunde
    expect(t('2026-11-21T10:15:00Z')).toBe('zonen')
    expect(t('2026-11-22T11:00:00Z')).toBe('zonen') // Sonntag, ungerade Stunde
  })
})
