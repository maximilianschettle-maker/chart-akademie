import { describe, it, expect } from 'vitest'
import { aufraeumen, endpointHash, gesendetFuer, markiere, type Status } from './push-status'

describe('push-status je Gerät', () => {
  const h1 = endpointHash('https://push.test/1')
  const h2 = endpointHash('https://push.test/2')

  it('Hash ist stabil und kurz', () => {
    expect(h1).toHaveLength(10)
    expect(endpointHash('https://push.test/1')).toBe(h1)
    expect(h1).not.toBe(h2)
  })

  it('Legacy-Einträge gelten für alle Geräte, neue nur für das eigene', () => {
    const status: Status = { gesendet: { 'fed-x:vortag': '2026-01-01T00:00:00Z' } }
    markiere(status, 'fed-x:ergebnis', h1, '2026-01-02T00:00:00Z')
    expect(gesendetFuer(status, h1)).toEqual({ 'fed-x:vortag': '2026-01-01T00:00:00Z', 'fed-x:ergebnis': '2026-01-02T00:00:00Z' })
    expect(gesendetFuer(status, h2)).toEqual({ 'fed-x:vortag': '2026-01-01T00:00:00Z' })
  })

  it('räumt alte Einträge auf, auch Fehler-Einträge', () => {
    const status: Status = { gesendet: { alt: '2026-01-01T00:00:00Z', [`neu|${h1}`]: '2026-03-01T00:00:00Z', [`f|${h1}`]: 'fehler 404 2026-01-01T00:00:00Z' } }
    aufraeumen(status, Date.parse('2026-03-02T00:00:00Z'), 30 * 86_400_000)
    expect(Object.keys(status.gesendet)).toEqual([`neu|${h1}`])
  })
})
