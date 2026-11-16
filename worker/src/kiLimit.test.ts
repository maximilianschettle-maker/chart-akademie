import { describe, it, expect } from 'vitest'
import { fakeEnv } from '../test/fakeKv'
import { berlinTag, kiPruefen, kiVerbrauch, kiZaehlen } from './kiLimit'
import type { Zugang } from './zugang'

const nutzer: Zugang = { nutzerId: 'n1', name: 'N', rolle: 'nutzer', kiLimitTag: 2 }
const admin: Zugang = { nutzerId: 'admin', name: 'A', rolle: 'admin', kiLimitTag: null }

describe('KI-Limit', () => {
  it('Berliner Tag wechselt um Mitternacht Berlin, nicht UTC', () => {
    expect(berlinTag(Date.UTC(2026, 10, 16, 22, 30))).toBe('2026-11-16')
    expect(berlinTag(Date.UTC(2026, 10, 16, 23, 30))).toBe('2026-11-17')
  })
  it('zählt und sperrt ab dem Limit', async () => {
    const { env } = fakeEnv()
    await kiPruefen(env, nutzer, 't')
    expect(await kiZaehlen(env, 'n1', 't')).toBe(1)
    await kiPruefen(env, nutzer, 't')
    expect(await kiZaehlen(env, 'n1', 't')).toBe(2)
    await expect(kiPruefen(env, nutzer, 't')).rejects.toMatchObject({ status: 429 })
    expect(await kiVerbrauch(env, 'n1', 'anderer-tag')).toBe(0)
  })
  it('Admin ohne Limit', async () => {
    const { env } = fakeEnv()
    for (let i = 0; i < 5; i++) await kiZaehlen(env, 'admin', 't')
    await expect(kiPruefen(env, admin, 't')).resolves.toBeUndefined()
  })
})
