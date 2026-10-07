import type { Candle, ExitGrund, Order, Richtung, Scenario, SzenarioBewertung, Trade } from '../types'
import { BEWERTUNG_RANG, type SzenarioResultat, bewerteSzenario } from './szenarioGrader'
import { fmtR } from './format'

// Mehrere Trades pro Übung: jeder logische Trade (ein Einstieg, ggf. mehrere
// Teil-Exits) wird einzeln bewertet. Das Übungsergebnis für den Lernpfad ist der
// beste Trade; die Zusammenfassung zeigt Versuche, Treffer, Gesamt-R und ob der
// letzte Versuch besser war als der erste. Pur, damit alles testbar bleibt.

export interface LogischerTrade {
  /** entryTime|richtung — stabil über Teil-Exits hinweg */
  key: string
  entryTime: number
  richtung: Richtung
  trades: Trade[]
  rMultiple: number
  pnl: number
  /** Exit-Grund des letzten Teil-Exits */
  exitGrund: ExitGrund
}

export interface TradeBewertung extends LogischerTrade {
  /** 1-basierte Nummer in der Reihenfolge der Einstiege */
  nr: number
  resultat: SzenarioResultat
}

export interface Durchlauf {
  nr: number
  bewertungen: TradeBewertung[]
}

export interface Zusammenfassung {
  versuche: number
  /** perfekt oder gut */
  treffer: number
  gesamtR: number
  erste?: SzenarioBewertung
  letzte?: SzenarioBewertung
  verbesserung: 'besser' | 'gleich' | 'schlechter' | null
  text: string
}

/** Fasst Broker-Trades zu logischen Trades zusammen (Teil-Exits desselben Einstiegs addiert). */
export function logischeTrades(trades: Trade[]): LogischerTrade[] {
  const map = new Map<string, LogischerTrade>()
  for (const t of trades) {
    const key = `${t.entryTime}|${t.richtung}`
    const l = map.get(key)
    if (l) {
      l.trades.push(t)
      l.rMultiple += t.rMultiple
      l.pnl += t.pnl
      l.exitGrund = t.exitGrund
    } else {
      map.set(key, { key, entryTime: t.entryTime, richtung: t.richtung, trades: [t], rMultiple: t.rMultiple, pnl: t.pnl, exitGrund: t.exitGrund })
    }
  }
  return [...map.values()].sort((a, b) => a.entryTime - b.entryTime)
}

/** Bewertet jeden logischen Trade einzeln gegen das Szenario. */
export function bewerteAlleTrades(szenario: Scenario, candles: Candle[], trades: Trade[]): TradeBewertung[] {
  return logischeTrades(trades).map((l, i) => ({
    ...l,
    nr: i + 1,
    resultat: bewerteSzenario(szenario, candles, l.trades),
  }))
}

/** Bester Trade: höchster Rang, bei Gleichstand das höhere R. */
export function besterTrade(bewertungen: TradeBewertung[]): TradeBewertung | undefined {
  let best: TradeBewertung | undefined
  for (const b of bewertungen) {
    if (!best) {
      best = b
      continue
    }
    const dr = BEWERTUNG_RANG[b.resultat.bewertung] - BEWERTUNG_RANG[best.resultat.bewertung]
    if (dr > 0 || (dr === 0 && b.rMultiple > best.rMultiple)) best = b
  }
  return best
}

/**
 * Ergebnis einer Übung: alle Trades einzeln bewertet, Übungsergebnis = bester
 * Trade. Ohne Trade entscheidet das Szenario (verpasst / Order nie gefüllt /
 * Kein-Trade-Szenario perfekt).
 */
export function uebungsErgebnis(
  szenario: Scenario,
  candles: Candle[],
  trades: Trade[],
  offeneOrder: Order | null = null,
): { bewertungen: TradeBewertung[]; resultat: SzenarioResultat; bester: TradeBewertung | undefined } {
  const bewertungen = bewerteAlleTrades(szenario, candles, trades)
  const bester = besterTrade(bewertungen)
  const resultat = bester ? bester.resultat : bewerteSzenario(szenario, candles, [], offeneOrder)
  return { bewertungen, resultat, bester }
}

const istTreffer = (b: SzenarioBewertung) => b === 'perfekt' || b === 'gut'

/** Zusammenfassung über eine Liste von Trade-Bewertungen (ein Durchlauf oder alle). */
export function zusammenfassung(bewertungen: TradeBewertung[]): Zusammenfassung {
  const versuche = bewertungen.length
  const treffer = bewertungen.filter((b) => istTreffer(b.resultat.bewertung)).length
  const gesamtR = bewertungen.reduce((s, b) => s + b.rMultiple, 0)
  const erste = bewertungen[0]?.resultat.bewertung
  const letzte = bewertungen[bewertungen.length - 1]?.resultat.bewertung
  let verbesserung: Zusammenfassung['verbesserung'] = null
  if (erste && letzte && versuche > 1) {
    const d = BEWERTUNG_RANG[letzte] - BEWERTUNG_RANG[erste]
    verbesserung = d > 0 ? 'besser' : d < 0 ? 'schlechter' : 'gleich'
  }
  const teile = [
    `${versuche} ${versuche === 1 ? 'Versuch' : 'Versuche'}`,
    `${treffer} ${treffer === 1 ? 'Treffer' : 'Treffer'}`,
    `${fmtR(gesamtR)} gesamt`,
  ]
  if (verbesserung) teile.push(`Verlauf: ${erste} → ${letzte} (${verbesserung})`)
  return { versuche, treffer, gesamtR, erste, letzte, verbesserung, text: versuche === 0 ? 'Kein Trade.' : teile.join(' · ') }
}

/** Alle Trades aller Durchläufe in Reihenfolge (für die Gesamt-Zusammenfassung). */
export function alleBewertungen(durchlaeufe: Durchlauf[]): TradeBewertung[] {
  return durchlaeufe.flatMap((d) => d.bewertungen)
}
