import type { Candle } from '../types'
import type { ChartBereich } from '../aktien/engine/chart'
import { AktienFehler } from '../aktien/data/client'
import { ladeChart } from '../aktien/data/service'
import type { ZeiteinheitDef } from './types'

// Kerzen für die Zonen-Seite über den Worker (/api/chart, Bereiche Z15/Z1H/Z1D).
// Kennt ein älterer Worker diese Bereiche noch nicht (400), wird auf die Aktien-Bereiche
// ausgewichen: weniger Historie, aber die Seite bleibt benutzbar.

export interface ZonenKerzen {
  kerzen: Candle[]
  /** im Chart zu größeren Kerzen bündeln */
  bucketSek?: number
  standAm: number
  veraltet?: boolean
  /** gesetzt, wenn auf die kürzere Ersatz-Historie ausgewichen wurde */
  ersatz?: boolean
}

const ERSATZ: Record<string, { bereich: ChartBereich; bucketSek?: number }> = {
  '15m': { bereich: '5T' },
  '1h': { bereich: '5T', bucketSek: 3600 },
  '4h': { bereich: '5T', bucketSek: 4 * 3600 },
  '1d': { bereich: '1J' },
}

export async function ladeZonenKerzen(symbol: string, einheit: ZeiteinheitDef, frisch = false): Promise<ZonenKerzen> {
  try {
    const c = await ladeChart(symbol, einheit.bereich, frisch)
    return { kerzen: c.kerzen as Candle[], bucketSek: einheit.bucketSek, standAm: c.standAm, veraltet: c.veraltet }
  } catch (e) {
    if (!(e instanceof AktienFehler) || e.status !== 400) throw e
    const ersatz = ERSATZ[einheit.id]
    const c = await ladeChart(symbol, ersatz.bereich, frisch)
    return { kerzen: c.kerzen as Candle[], bucketSek: ersatz.bucketSek, standAm: c.standAm, veraltet: c.veraltet, ersatz: true }
  }
}
