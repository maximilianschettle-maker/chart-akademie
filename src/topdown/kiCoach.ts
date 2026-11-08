import type { Candle, Richtung } from '../types'
import type { JournalEintrag } from '../journal/types'
import { faktenSammeln, type TradeFakten, type UebungsKontext } from '../journal/fakten'

// KI-Coach für Übungs-Trades (Top-Down-Replay, Simulator): aus Entscheidung, Kerzen und den
// vorberechneten Kriterien dieselben Fakten bauen wie fürs Journal, plus Übungskontext.
// Das Modell bekommt keine Kerzen, nur Zahlen und Aussagen – wie bei echten Trades.

export interface UebungsTrade {
  markt: string
  symbol: string
  waehrung: string
  richtung: Richtung
  entryTime: number
  entryPreis: number
  stopLoss: number
  takeProfit: number
  strategieId: string
  /** Kerzenintervall des Replays ('15m', '1h' …) */
  zeitrahmen: string
  exitTime?: number
  exitPreis?: number
  exitGrund?: 'ziel' | 'stop' | 'manuell'
}

/** Pseudo-Journal-Eintrag, damit `faktenSammeln` unverändert rechnen kann */
export function alsEintrag(t: UebungsTrade, jetztMs = Date.now()): JournalEintrag {
  const geschlossen = t.exitPreis !== undefined && t.exitTime !== undefined
  return {
    id: `uebung-${t.entryTime}`,
    markt: t.markt,
    symbol: t.symbol,
    waehrung: t.waehrung,
    richtung: t.richtung,
    entryTime: t.entryTime,
    entryPreis: t.entryPreis,
    stopLoss: t.stopLoss,
    takeProfit: t.takeProfit,
    risikoProzent: 1,
    strategieId: t.strategieId,
    zeitrahmen: (['1m', '5m', '15m', '1h', '4h', '1d'].includes(t.zeitrahmen) ? t.zeitrahmen : '1h') as JournalEintrag['zeitrahmen'],
    imPlan: null,
    status: geschlossen ? 'geschlossen' : 'offen',
    exitTime: t.exitTime,
    exitPreis: t.exitPreis,
    exitGrund: t.exitGrund,
    erstelltAm: jetztMs,
    geaendertAm: jetztMs,
  }
}

/** Fakten für den Coach: Kerzen bis zum Einstieg (und Ergebnis, wenn gewünscht) plus Übungskontext */
export function uebungsFakten(t: UebungsTrade, kerzen: Candle[], uebung: UebungsKontext, mitErgebnis: boolean): TradeFakten {
  const e = alsEintrag(t)
  const fakten = faktenSammeln(e, kerzen, [], t.zeitrahmen, mitErgebnis)
  return { ...fakten, uebung }
}
