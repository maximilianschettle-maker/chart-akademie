// Antworten, CORS und Zugangsschutz des Workers.

export interface Env {
  AKTIEN_KV: KVNamespace
  /** Geheimnis, das die App als Bearer-Token mitschickt (wrangler secret) */
  AKTIEN_SECRET: string
  /** Pflicht bei der SEC: "Name E-Mail" (wrangler secret, weil das Repo öffentlich ist) */
  SEC_USER_AGENT: string
}

const ERLAUBTE_ORIGINS = ['https://maximilianschettle-maker.github.io']

export function corsHeader(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const erlaubt = ERLAUBTE_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  return {
    'Access-Control-Allow-Origin': erlaubt ? origin : ERLAUBTE_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(req: Request, daten: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeader(req), ...extra },
  })
}

export class HttpFehler extends Error {
  status: number
  constructor(text: string, status: number) {
    super(text)
    this.status = status
  }
}

export function fehler(req: Request, e: unknown): Response {
  if (e instanceof HttpFehler) return json(req, { fehler: e.message }, e.status)
  const text = e instanceof Error ? e.message : String(e)
  return json(req, { fehler: text }, 500)
}

export function pruefeZugang(req: Request, env: Env): void {
  if (!env.AKTIEN_SECRET) throw new HttpFehler('AKTIEN_SECRET ist im Worker nicht gesetzt', 500)
  const kopf = req.headers.get('Authorization') ?? ''
  const token = kopf.startsWith('Bearer ') ? kopf.slice(7).trim() : ''
  if (!token || !zeitkonstantGleich(token, env.AKTIEN_SECRET)) throw new HttpFehler('Zugang verweigert — Geheimnis prüfen', 401)
}

function zeitkonstantGleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Mehrere Aufgaben mit begrenzter Parallelität (SEC erlaubt 10 Anfragen/s). */
export async function parallelBegrenzt<T>(aufgaben: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const ergebnisse: T[] = new Array(aufgaben.length)
  let naechste = 0
  async function arbeiter() {
    while (naechste < aufgaben.length) {
      const i = naechste++
      ergebnisse[i] = await aufgaben[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, aufgaben.length) }, arbeiter))
  return ergebnisse
}
