// Aufrufe an den Cloudflare Worker. Basis-URL und Geheimnis kommen aus dem Store.
// Lesende Anfragen werden bei Netzfehlern und 5xx/429 mit Backoff wiederholt (3 Versuche);
// jede Antwort meldet sich beim Datenstatus (live / Fehler) für die Anzeige.
import { useAktienStore } from '../store'
import { datenStatus } from './status'

export class AktienFehler extends Error {
  status: number
  constructor(text: string, status: number) {
    super(text)
    this.status = status
  }
}

export function workerKonfiguriert(): boolean {
  const { workerUrl, secret } = useAktienStore.getState()
  return Boolean(workerUrl.trim() && secret.trim())
}

/** Pausen zwischen den Versuchen (ms); je Versuch kommt etwas Zufall dazu, damit parallele Anfragen nicht im Takt wiederholen */
export const RETRY_PAUSEN_MS = [600, 1800]
const ANFRAGE_LIMIT_MS = 20_000

export const TEXT_NICHT_ERREICHBAR = 'Daten-Worker nicht erreichbar — offline, Cloudflare-Störung oder Worker-Fehler'

function wiederholbar(e: AktienFehler): boolean {
  return e.status === 0 || e.status === 429 || (e.status >= 500 && e.status <= 504)
}

let pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
/** Nur für Tests: Pausen ersetzen */
export function _pauseSetzen(fn: typeof pause): void {
  pause = fn
}

/** GET/PUT gegen den Worker. 204 → null. Netzfehler und Fehlerantworten → AktienFehler. */
export async function anfrage<T>(pfad: string, init: RequestInit = {}): Promise<T | null> {
  const { workerUrl, secret } = useAktienStore.getState()
  if (!workerUrl.trim() || !secret.trim()) throw new AktienFehler('Worker-URL und Geheimnis sind nicht eingetragen (Einstellungen unten).', 0)
  const basis = workerUrl.trim().replace(/\/+$/, '')
  const lesend = !init.method || init.method === 'GET'
  const versuche = lesend ? RETRY_PAUSEN_MS.length + 1 : 1

  for (let versuch = 0; ; versuch++) {
    try {
      const daten = await einmal<T>(basis + pfad, init, secret.trim())
      datenStatus.erfolg()
      return daten
    } catch (e) {
      const f = e instanceof AktienFehler ? e : new AktienFehler(e instanceof Error ? e.message : String(e), 0)
      if (versuch < versuche - 1 && wiederholbar(f)) {
        await pause(RETRY_PAUSEN_MS[versuch] + Math.random() * 300)
        continue
      }
      datenStatus.fehler(f.message)
      throw f
    }
  }
}

async function einmal<T>(url: string, init: RequestInit, secret: string): Promise<T | null> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(ANFRAGE_LIMIT_MS),
      headers: { Authorization: `Bearer ${secret}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch (e) {
    const zeitlimit = e instanceof Error && e.name === 'TimeoutError'
    throw new AktienFehler(zeitlimit ? `Daten-Worker antwortet nicht (${ANFRAGE_LIMIT_MS / 1000} s)` : TEXT_NICHT_ERREICHBAR, 0)
  }
  if (res.status === 204) return null
  let daten: unknown = null
  try {
    daten = await res.json()
  } catch {
    // keine JSON-Antwort (z.B. Cloudflare-Fehlerseite)
  }
  if (!res.ok) {
    const text = daten && typeof daten === 'object' && 'fehler' in daten ? String((daten as { fehler: unknown }).fehler) : httpText(res.status)
    throw new AktienFehler(text, res.status)
  }
  return daten as T
}

function httpText(status: number): string {
  if (status === 401) return 'Zugang verweigert — Geheimnis prüfen'
  if (status === 429) return 'Zu viele Anfragen — kurz warten'
  if (status >= 500) return `Worker oder Cloudflare meldet HTTP ${status}`
  return `HTTP ${status}`
}
