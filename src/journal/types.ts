import type { Richtung } from '../types'
import type { PruefungAntwort } from './pruefungTypes'

// Journal für echte Trades (eToro). Getrennt vom Simulator-Trade (`Trade`), weil ein echter
// Eintrag einen Lebenszyklus hat (offen → geschlossen), Ergebnis und Gebühren vom Broker kommen
// und Freitext-Felder trägt. Für die Auswertung wird er auf `Trade` abgebildet (engine.ts).

export type EintragStatus = 'offen' | 'geschlossen'
export type AusstiegGrund = 'ziel' | 'stop' | 'manuell'
export type Zeitrahmen = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export const ZEITRAHMEN: { id: Zeitrahmen; text: string }[] = [
  { id: '5m', text: '5 min' },
  { id: '15m', text: '15 min' },
  { id: '1h', text: '1 h' },
  { id: '4h', text: '4 h' },
  { id: '1d', text: 'Tag' },
]

export const GEFUEHLE = ['ruhig', 'fokussiert', 'unsicher', 'gierig', 'ängstlich', 'genervt', 'müde'] as const

export interface JournalEintrag {
  id: string
  /** Anzeigename, z.B. „Nasdaq 100“ */
  markt: string
  /** Yahoo-Symbol für Kerzen, z.B. ^NDX */
  symbol: string
  waehrung: string
  richtung: Richtung
  /** Einstieg, Unix-Sekunden */
  entryTime: number
  entryPreis: number
  stopLoss: number
  /** 0 = kein Ziel gesetzt */
  takeProfit: number
  /** Risiko in Prozent vom Konto (eToro: Betrag × Stop-Abstand) */
  risikoProzent: number
  /** Risiko in Kontowährung, falls bekannt – Grundlage für Ergebnis in $ ohne Broker-Angabe */
  risikoBetrag?: number
  hebel?: number
  /** Positions-ID des Brokers (eToro) – Schlüssel für den Screenshot-Import */
  brokerId?: string
  /** Kontrakte/Einheiten und Einsatz (Marge) laut Broker */
  kontrakte?: number
  einsatz?: number
  /** Setup-Id aus STRATEGIEN oder 'sonstiges' */
  strategieId: string
  setupFrei?: string
  zeitrahmen: Zeitrahmen
  /** null = noch nicht beantwortet */
  imPlan: boolean | null
  gefuehlVorher?: string
  gefuehlNachher?: string
  begruendung?: string
  lehre?: string
  status: EintragStatus
  exitTime?: number
  exitPreis?: number
  exitGrund?: AusstiegGrund
  /** Netto-Ergebnis laut Broker in Kontowährung (nach Gebühren) */
  ergebnisBetrag?: number
  gebuehren?: number
  /** KI-Prüfungen: „vorher“ (ohne Ergebnis) und „nachher“ (mit Ergebnis), älteste zuerst */
  pruefungen?: Pruefung[]
  erstelltAm: number
  geaendertAm: number
}

export interface Pruefung extends PruefungAntwort {
  erstelltAm: number
  mitErgebnis: boolean
}

/** Kerzen rund um den Einstieg, gerätelokal in IndexedDB */
export interface Snapshot {
  eintragId: string
  symbol: string
  /** Kerzenintervall der Kerzen (Yahoo: 5m, 15m, 1d …) */
  intervall: string
  kerzen: { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  standAm: number
}
