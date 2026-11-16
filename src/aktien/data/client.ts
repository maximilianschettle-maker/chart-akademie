// Aufrufe an den Cloudflare Worker. Die Adresse ist fest (config.ts), der Einladungscode kommt
// aus dem Store. Lesende Anfragen werden bei Netzfehlern und 5xx/429 mit Backoff wiederholt
// (3 Versuche); jede Antwort meldet sich beim Datenstatus (live / Fehler) für die Anzeige.
import { WORKER_URL } from '../config'
import { useAktienStore } from '../store'
import { datenStatus } from './status'

export class AktienFehler extends Error {
  status: number
  constructor(text: string, status: number) {
    super(text)
    this.status = status
  }
}

export const TEXT_KEIN_CODE = 'Kein Einladungscode eingetragen (Zugang einrichten).'

/** true, wenn ein Einladungscode im Browser liegt — ob er gilt, zeigt erst der Worker */
export function codeVorhanden(): boolean {
  return Boolean(useAktienStore.getState().code.trim())
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

function eigenerToken(init: RequestInit): string | null {
  const h = new Headers(init.headers)
  const a = h.get('Authorization')
  return a?.startsWith('Bearer ') ? a.slice(7).trim() : null
}

/**
 * GET/PUT/POST/DELETE gegen den Worker. 204 → null. Netzfehler und Fehlerantworten → AktienFehler.
 * Ein eigener Authorization-Header in `init` ersetzt den gespeicherten Code (Code prüfen vor dem Speichern).
 */
export async function anfrage<T>(pfad: string, init: RequestInit = {}): Promise<T | null> {
  const token = eigenerToken(init) ?? useAktienStore.getState().code.trim()
  if (!token) throw new AktienFehler(TEXT_KEIN_CODE, 0)
  const lesend = !init.method || init.method === 'GET'
  const versuche = lesend ? RETRY_PAUSEN_MS.length + 1 : 1

  for (let versuch = 0; ; versuch++) {
    try {
      const daten = await einmal<T>(WORKER_URL + pfad, init, token)
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

async function einmal<T>(url: string, init: RequestInit, token: string): Promise<T | null> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(ANFRAGE_LIMIT_MS), headers })
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
  if (status === 401) return 'Einladungscode ungültig'
  if (status === 403) return 'Einladungscode gesperrt'
  if (status === 429) return 'Zu viele Anfragen — kurz warten'
  if (status >= 500) return `Worker oder Cloudflare meldet HTTP ${status}`
  return `HTTP ${status}`
}
