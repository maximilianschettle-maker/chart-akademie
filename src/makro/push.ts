// Push-Abos je Nutzer im Worker (PUT/GET/DELETE /api/push/abo). Die GitHub Actions holen alle
// Abos über den Dienst-Endpunkt und schicken die Nachrichten; die App muss nichts mehr kopieren.
import { anfrage } from '../aktien/data/client'

export interface AboInfo {
  endpoint: string
  geraet?: string
  angelegtAm: number
}

export async function abosLaden(): Promise<AboInfo[]> {
  const r = await anfrage<{ abos: AboInfo[] }>('/api/push/abo')
  return r?.abos ?? []
}

export async function aboSchreiben(sub: PushSubscriptionJSON, geraet: string): Promise<number> {
  const r = await anfrage<{ anzahl: number }>('/api/push/abo', { method: 'PUT', body: JSON.stringify({ ...sub, geraet }) })
  return r?.anzahl ?? 0
}

export async function aboLoeschen(endpoint: string): Promise<number> {
  const r = await anfrage<{ anzahl: number }>('/api/push/abo', { method: 'DELETE', body: JSON.stringify({ endpoint }) })
  return r?.anzahl ?? 0
}

/** Grober Gerätename aus dem User-Agent, nur zur Anzeige in der Abo-Liste. */
export function geraeteName(ua = navigator.userAgent): string {
  const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Gerät'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return browser ? `${system} ${browser}` : system
}
