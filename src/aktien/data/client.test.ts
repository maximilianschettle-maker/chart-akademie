import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _pauseSetzen, AktienFehler, anfrage, RETRY_PAUSEN_MS, TEXT_NICHT_ERREICHBAR } from './client'
import { useDatenStatus } from './status'
import { useAktienStore } from '../store'

function antwort(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('anfrage (Worker-Client)', () => {
  const pausen: number[] = []
  beforeEach(() => {
    useAktienStore.setState({ workerUrl: 'https://w.test', secret: 'geheim' })
    useDatenStatus.setState({ lage: 'unbekannt', letzterErfolg: null, standVeraltet: null, letzterFehler: null, fehlerSeit: null })
    pausen.length = 0
    _pauseSetzen(async (ms) => {
      pausen.push(ms)
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('wiederholt Netzfehler mit Backoff und meldet dann Erfolg', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(antwort(503, { fehler: 'Yahoo bremst' }))
      .mockResolvedValueOnce(antwort(200, { preis: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(anfrage('/api/kurs/AAPL')).resolves.toEqual({ preis: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(pausen).toHaveLength(2)
    expect(pausen[0]).toBeGreaterThanOrEqual(RETRY_PAUSEN_MS[0])
    expect(pausen[1]).toBeGreaterThanOrEqual(RETRY_PAUSEN_MS[1])
    expect(fetchMock.mock.calls[0][0]).toBe('https://w.test/api/kurs/AAPL')
    expect(useDatenStatus.getState().lage).toBe('live')
  })

  it('gibt nach dem letzten Versuch einen verständlichen Fehler und meldet ihn', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(anfrage('/api/kurs/AAPL')).rejects.toMatchObject({ message: TEXT_NICHT_ERREICHBAR, status: 0 })
    expect(pausen).toHaveLength(RETRY_PAUSEN_MS.length)
    expect(useDatenStatus.getState().lage).toBe('fehler')
    expect(useDatenStatus.getState().letzterFehler).toBe(TEXT_NICHT_ERREICHBAR)
  })

  it('wiederholt 4xx-Fehler nicht und wiederholt PUT nie', async () => {
    const f401 = vi.fn<typeof fetch>().mockResolvedValue(antwort(401, { fehler: 'Zugang verweigert' }))
    vi.stubGlobal('fetch', f401)
    await expect(anfrage('/api/status')).rejects.toBeInstanceOf(AktienFehler)
    expect(f401).toHaveBeenCalledTimes(1)

    const fPut = vi.fn<typeof fetch>().mockResolvedValue(antwort(503, { fehler: 'kaputt' }))
    vi.stubGlobal('fetch', fPut)
    await expect(anfrage('/api/zustand', { method: 'PUT', body: '{}' })).rejects.toMatchObject({ status: 503 })
    expect(fPut).toHaveBeenCalledTimes(1)
    expect(pausen).toHaveLength(0)
  })

  it('übersetzt eine Cloudflare-Fehlerseite ohne JSON in einen lesbaren Text', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>error 1102</html>', { status: 500 })))
    await expect(anfrage('/api/kurs/AAPL')).rejects.toMatchObject({ message: 'Worker oder Cloudflare meldet HTTP 500', status: 500 })
  })

  it('liefert null bei 204', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(anfrage('/api/sec/X')).resolves.toBeNull()
  })
})
