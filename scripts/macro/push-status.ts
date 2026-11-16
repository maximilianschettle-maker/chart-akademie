// Sendestatus je Gerät: data/push-status.json führt `<nachricht-key>|<endpoint-hash>` → Zeitpunkt.
// Alte Einträge ohne Hash (vor dem Umbau auf mehrere Nutzer) zählen weiter für jedes Gerät,
// damit das Gerät des Owners alte Nachrichten nicht ein zweites Mal bekommt.
import { createHash } from 'node:crypto'

export interface Status {
  gesendet: Record<string, string>
}

export function endpointHash(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 10)
}

export function statusKey(key: string, hash: string): string {
  return `${key}|${hash}`
}

/** Sicht eines Geräts auf den Status: eigene Einträge plus Legacy-Einträge ohne Hash. */
export function gesendetFuer(status: Status, hash: string): Record<string, string> {
  const out: Record<string, string> = {}
  const suffix = `|${hash}`
  for (const [k, v] of Object.entries(status.gesendet)) {
    if (!k.includes('|')) out[k] = v
    else if (k.endsWith(suffix)) out[k.slice(0, -suffix.length)] = v
  }
  return out
}

export function markiere(status: Status, key: string, hash: string, wert: string): void {
  status.gesendet[statusKey(key, hash)] = wert
}

/** Einträge älter als `aufbewahrungMs` entfernen (Zeitpunkt steckt im Wert, auch bei „fehler <code> <iso>“). */
export function aufraeumen(status: Status, jetztMs: number, aufbewahrungMs: number): void {
  const grenze = jetztMs - aufbewahrungMs
  for (const [key, wert] of Object.entries(status.gesendet)) {
    const zeit = Date.parse(wert.replace(/^fehler \d+ /, ''))
    if (Number.isFinite(zeit) && zeit < grenze) delete status.gesendet[key]
  }
}
