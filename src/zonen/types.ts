import type { ChartBereich } from '../aktien/engine/chart'

// Preiszonen mit Alarm: der Nutzer zeichnet je Markt Bänder (Unter- und Oberkante) in den Chart;
// die Tracker-Action prüft sie und verschickt Push-Nachrichten (Annäherung, in der Zone, gebrochen).

export type ZonenMarktId = 'nasdaq' | 'gold' | 'oel' | 'bitcoin'
export type ZonenZeiteinheit = '15m' | '1h' | '4h' | '1d'
export type ZonenTyp = 'support' | 'resistance'

export interface ZonenMarkt {
  id: ZonenMarktId
  name: string
  /** Yahoo-Symbol; Nasdaq als Future (NQ=F), weil der fast rund um die Uhr handelt */
  symbol: string
  hinweis?: string
}

export const ZONEN_MAERKTE: ZonenMarkt[] = [
  { id: 'nasdaq', name: 'Nasdaq', symbol: 'NQ=F', hinweis: 'Nasdaq-100-Future (NQ) – Kurse weichen leicht vom Index ab.' },
  { id: 'gold', name: 'Gold', symbol: 'GC=F', hinweis: 'Gold-Future (GC).' },
  { id: 'oel', name: 'Öl', symbol: 'CL=F', hinweis: 'WTI-Future (CL).' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC-USD' },
]

export const ZONEN_MARKT_NACH_ID = Object.fromEntries(ZONEN_MAERKTE.map((m) => [m.id, m])) as Record<ZonenMarktId, ZonenMarkt>

export interface ZeiteinheitDef {
  id: ZonenZeiteinheit
  text: string
  /** Kursbereich des Workers (/api/chart) */
  bereich: ChartBereich
  /** Kerzen im Chart zu größeren Kerzen bündeln (4h aus 1h) */
  bucketSek?: number
}

export const ZONEN_ZEITEINHEITEN: ZeiteinheitDef[] = [
  { id: '15m', text: '15 min', bereich: 'Z15' },
  { id: '1h', text: '1 h', bereich: 'Z1H' },
  { id: '4h', text: '4 h', bereich: 'Z1H', bucketSek: 4 * 3600 },
  { id: '1d', text: 'Tag', bereich: 'Z1D' },
]

export interface PreisZone {
  id: string
  markt: ZonenMarktId
  /** Zeiteinheit, auf der die Zone gilt – „gebrochen“ heißt: Kerze dieser Einheit schließt jenseits der Zone */
  zeiteinheit: ZonenZeiteinheit
  typ: ZonenTyp
  /** Unterkante */
  von: number
  /** Oberkante */
  bis: number
  notiz: string
  /** im Chart eingeblendet */
  sichtbar: boolean
  /** Push-Alarm für diese Zone */
  alarm: boolean
  erstelltAm: number
  geaendertAm: number
}

export interface ZonenStand {
  zonen: PreisZone[]
  /** „Nähert sich“: Abstand zur Zone in Prozent des Kurses */
  annaeherungProzent: number
  aktualisiertAm: number
}

/** Märkte, die rund um die Uhr handeln: ihre Zonen prüft die Action auch nachts und am Wochenende alle 15 Minuten */
export const RUND_UM_DIE_UHR: readonly ZonenMarktId[] = ['bitcoin']

export const ANNAEHERUNG_STANDARD = 0.3
export const ANNAEHERUNG_MIN = 0.05
export const ANNAEHERUNG_MAX = 3
/** Obergrenze je Nutzer (KV-Größe, Laufzeit der Action) */
export const ZONEN_MAX = 60
export const NOTIZ_MAX = 300
