// Aufrufe an den Cloudflare Worker. Basis-URL und Geheimnis kommen aus dem Store.
import { useAktienStore } from '../store'

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

/** GET/PUT gegen den Worker. 204 → null. Netzfehler und Fehlerantworten → AktienFehler. */
export async function anfrage<T>(pfad: string, init: RequestInit = {}): Promise<T | null> {
  const { workerUrl, secret } = useAktienStore.getState()
  if (!workerUrl.trim() || !secret.trim()) throw new AktienFehler('Worker-URL und Geheimnis sind nicht eingetragen (Einstellungen unten).', 0)
  const basis = workerUrl.trim().replace(/\/+$/, '')
  let res: Response
  try {
    res = await fetch(basis + pfad, {
      ...init,
      headers: { Authorization: `Bearer ${secret.trim()}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch {
    throw new AktienFehler('Worker nicht erreichbar — läuft er, stimmt die URL, bist du online?', 0)
  }
  if (res.status === 204) return null
  let daten: unknown = null
  try {
    daten = await res.json()
  } catch {
    // keine JSON-Antwort
  }
  if (!res.ok) {
    const text = daten && typeof daten === 'object' && 'fehler' in daten ? String((daten as { fehler: unknown }).fehler) : `HTTP ${res.status}`
    throw new AktienFehler(text, res.status)
  }
  return daten as T
}
