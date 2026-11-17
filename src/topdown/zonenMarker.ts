import type { ChartMarker } from '../components/chart/HandelsChart'
import type { Zone } from '../engine/zonen'

const DURCHLAUF_FARBE = '#94A3B8'

/** Marker für den Chart: grüner Pfeil = gehalten, roter Pfeil = abgewiesen, graues Quadrat = durchgelaufen */
export function zonenMarker(z: Zone): ChartMarker[] {
  return z.kontakte.flatMap((k, i): ChartMarker[] => {
    const text = String(i + 1)
    if (k.art === 'gehalten') return [{ time: k.time, art: 'long', text }]
    if (k.art === 'abgewiesen') return [{ time: k.time, art: 'short', text }]
    if (k.art === 'durchlauf') return [{ time: k.time, art: 'hinweis', text, farbe: DURCHLAUF_FARBE, oben: false }]
    return []
  })
}
