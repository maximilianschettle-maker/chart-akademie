import type { Candle, Scenario, Trade } from '../types'
import type { ChartBox, ChartLinie, ChartMarker } from '../components/chart/HandelsChart'
import type { IdealTrade } from './szenarioGrader'
import { logischeTrades } from './uebungsVerlauf'
import { fmtR } from './format'

// Review-Ansicht nach einer geführten Übung: eigener Trade und Ideal-Trade
// gleichzeitig im Chart, farblich getrennt, plus Entry-Fenster und Trigger.
// Bei mehreren Trades: Marker für alle (#1, #2 …), Linien für den ausgewählten.
// Pur (kein React), damit die Darstellung testbar ist.

export const REVIEW_FARBEN = {
  eigenEntry: '#F59E0B',
  eigenSl: '#EF4444',
  eigenTp: '#22C55E',
  ideal: '#3B82F6',
  trigger: '#A855F7',
  fensterFuellung: 'rgba(59, 130, 246, 0.12)',
  fensterRand: 'rgba(59, 130, 246, 0.55)',
} as const

export interface ReviewAnzeige {
  linien: ChartLinie[]
  boxen: ChartBox[]
  marker: ChartMarker[]
}

/** Marker für alle (auch noch laufenden) Trades — Einstieg mit Nummer, Exits mit R. */
export function tradeMarker(trades: Trade[]): ChartMarker[] {
  const marker: ChartMarker[] = []
  for (const [i, l] of logischeTrades(trades).entries()) {
    marker.push({ time: l.entryTime, art: l.richtung, text: `#${i + 1}` })
    for (const t of l.trades) marker.push({ time: t.exitTime, art: 'exit', text: fmtR(t.rMultiple), gewinn: t.pnl > 0 })
  }
  return marker
}

export function reviewAnzeige(
  szenario: Scenario,
  candles: Candle[],
  trades: Trade[],
  ideal: IdealTrade | null,
  /** key des ausgewählten logischen Trades (entryTime|richtung); fehlt → der erste */
  auswahl?: string,
): ReviewAnzeige {
  const linien: ChartLinie[] = []
  const boxen: ChartBox[] = []
  const marker: ChartMarker[] = tradeMarker(trades)
  const long = szenario.richtung !== 'short'

  // Ausgewählter eigener Trade: durchgezogener Entry, gestrichelte SL/TP
  const gruppen = logischeTrades(trades)
  const eigener = (auswahl ? gruppen.find((g) => g.key === auswahl) : undefined) ?? gruppen[0]
  const t = eigener?.trades[0]
  if (t) {
    linien.push({ id: 'eigen-entry', preis: t.entryPreis, farbe: REVIEW_FARBEN.eigenEntry, titel: 'Dein Entry', fest: true, imBlick: true })
    linien.push({ id: 'eigen-sl', preis: t.stopLoss, farbe: REVIEW_FARBEN.eigenSl, titel: 'Dein SL', imBlick: true })
    if (t.takeProfit > 0) {
      linien.push({ id: 'eigen-tp', preis: t.takeProfit, farbe: REVIEW_FARBEN.eigenTp, titel: 'Dein TP', imBlick: true })
    }
  }

  // Ideal-Trade: blau gepunktet, Marker an der Ideal-Entry-Kerze und am SL-/TP-Treffer
  if (ideal) {
    linien.push({ id: 'ideal-entry', preis: ideal.entry, farbe: REVIEW_FARBEN.ideal, titel: 'Ideal-Entry', stil: 'gepunktet', imBlick: true })
    linien.push({ id: 'ideal-sl', preis: ideal.stopLoss, farbe: REVIEW_FARBEN.ideal, titel: 'Ideal-SL', stil: 'gepunktet', imBlick: true })
    linien.push({ id: 'ideal-tp', preis: ideal.takeProfit, farbe: REVIEW_FARBEN.ideal, titel: 'Ideal-TP', stil: 'gepunktet', imBlick: true })
    marker.push({ time: ideal.entryTime, art: 'hinweis', text: 'Ideal-Entry', farbe: REVIEW_FARBEN.ideal, oben: !long })
    if (ideal.exitTime !== null && ideal.exitGrund !== 'offen') {
      marker.push({
        time: ideal.exitTime,
        art: 'hinweis',
        text: ideal.exitGrund === 'tp' ? 'Ideal-TP' : 'Ideal-SL',
        farbe: REVIEW_FARBEN.ideal,
        oben: long,
      })
    }
  } else if (szenario.idealEntry && szenario.idealStopLoss && szenario.idealTakeProfit) {
    linien.push({ id: 'ideal-entry', preis: szenario.idealEntry, farbe: REVIEW_FARBEN.ideal, titel: 'Ideal-Entry', stil: 'gepunktet', imBlick: true })
    linien.push({ id: 'ideal-sl', preis: szenario.idealStopLoss, farbe: REVIEW_FARBEN.ideal, titel: 'Ideal-SL', stil: 'gepunktet', imBlick: true })
    linien.push({ id: 'ideal-tp', preis: szenario.idealTakeProfit, farbe: REVIEW_FARBEN.ideal, titel: 'Ideal-TP', stil: 'gepunktet', imBlick: true })
  }

  // Entry-Fenster als Box: Preiszone × Zeitraum
  const z = szenario.entryZone
  const von = z ? candles[z.barVon] : undefined
  const bis = z ? candles[z.barBis] : undefined
  if (z && von && bis) {
    boxen.push({
      id: 'entry-fenster',
      zeitVon: von.time,
      zeitBis: bis.time,
      preisVon: z.preisVon,
      preisBis: z.preisBis,
      fuellung: REVIEW_FARBEN.fensterFuellung,
      rand: REVIEW_FARBEN.fensterRand,
    })
  }

  // Trigger-Kerze
  const trigger = szenario.kriterien?.trigger
  const triggerKerze = trigger ? candles[trigger.bar] : undefined
  if (triggerKerze) {
    marker.push({ time: triggerKerze.time, art: 'hinweis', text: 'Trigger', farbe: REVIEW_FARBEN.trigger, oben: true })
  }

  return { linien, boxen, marker }
}
