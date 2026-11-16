import type { MusterId, TrackerConfig } from '../types'
import { normalisiereConfig } from './katalog'

// Vereinigung mehrerer Tracker-Konfigurationen: die GitHub Action holt alle
// Instrumente, die irgendein Nutzer beobachtet, und rechnet alle Muster, die
// irgendwer eingeschaltet hat. Die Push-Entscheidung fällt später je Nutzer.

function musterOder(configs: TrackerConfig[], feld: 'muster' | 'musterStunde'): Record<MusterId, boolean> {
  const out = { ...configs[0][feld] }
  for (const c of configs.slice(1)) for (const [id, an] of Object.entries(c[feld])) if (an) out[id as MusterId] = true
  return out
}

export function trackerUnion(configs: TrackerConfig[]): TrackerConfig {
  const sauber = configs.map((c) => normalisiereConfig(c))
  if (sauber.length === 0) return normalisiereConfig(null)
  return {
    instrumente: [...new Set(sauber.flatMap((c) => c.instrumente))],
    muster: musterOder(sauber, 'muster'),
    push: sauber.some((c) => c.push),
    musterStunde: musterOder(sauber, 'musterStunde'),
    pushStunde: sauber.some((c) => c.pushStunde),
    aktualisiertAm: Math.max(...sauber.map((c) => c.aktualisiertAm)),
  }
}
