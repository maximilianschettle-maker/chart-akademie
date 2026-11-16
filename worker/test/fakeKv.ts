// Minimaler KV-Ersatz für Worker-Tests (vitest, Node): get/put/delete/list mit Metadata.

export class FakeKv {
  daten = new Map<string, { wert: string; metadata?: unknown }>()
  schreibvorgaenge = 0

  async get(key: string, typ?: 'json' | 'text'): Promise<unknown> {
    const e = this.daten.get(key)
    if (!e) return null
    return typ === 'json' ? JSON.parse(e.wert) : e.wert
  }
  async put(key: string, wert: string, opts?: { metadata?: unknown; expirationTtl?: number }): Promise<void> {
    this.schreibvorgaenge++
    this.daten.set(key, { wert, metadata: opts?.metadata })
  }
  async delete(key: string): Promise<void> {
    this.daten.delete(key)
  }
  async list(opts?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string; metadata?: unknown }[]; list_complete: boolean; cursor?: string }> {
    const prefix = opts?.prefix ?? ''
    const keys = [...this.daten.entries()].filter(([k]) => k.startsWith(prefix)).map(([name, e]) => ({ name, metadata: e.metadata }))
    return { keys, list_complete: true }
  }
}

export function fakeEnv(secret = 'dienst-geheim') {
  const kv = new FakeKv()
  return { env: { AKTIEN_KV: kv as unknown as KVNamespace, AKTIEN_SECRET: secret, SEC_USER_AGENT: 'test' }, kv }
}

export function anfrage(pfad: string, init: RequestInit & { token?: string } = {}): Request {
  const headers = new Headers(init.headers)
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return new Request(`https://worker.test${pfad}`, { ...init, headers })
}

export const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => {}), passThroughOnException: () => {} } as unknown as ExecutionContext
