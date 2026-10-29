// Daten des Makro-/Geopolitik-Boards (Phase 4). Erzeugt von scripts/board/hole-board.ts in der
// GitHub Action board.yml, gelesen von src/board/. Zwei Dateien: public/data/kalender.json
// (Wirtschaftskalender USA + Euroraum) und public/data/news.json (Geopolitik-Newsboard).

export type Region = 'us' | 'ez'
export type IndikatorId = 'cpi' | 'arbeitsmarkt' | 'bip'

export interface KalenderTermin {
  id: string
  region: Region
  indikator: IndikatorId
  titel: string
  /** Veröffentlichung (UTC, ISO) */
  zeitUtc: string
  /** z.B. „Oktober 2026“, „Q3 2026“ */
  periode?: string
  quelle: string
  link?: string
}

export interface IndikatorWert {
  region: Region
  indikator: IndikatorId
  titel: string
  /** Berichtsperiode, z.B. „2026-09“ oder „2026-Q3“ */
  periode: string
  wert: number
  /** Anzeigeeinheit: „% J/J“, „%“, „Tsd.“, „% Q/Q“, „% annualisiert“ */
  einheit: string
  vorher: number | null
  quelle: string
  link?: string
}

export type QuelleStatus = 'live' | 'fehler' | 'ohne-key' | 'alt'

export interface KalenderDaten {
  version: 1
  lastUpdated: string
  termine: KalenderTermin[]
  werte: IndikatorWert[]
  quellen: Record<string, QuelleStatus>
}

export type NewsKategorie = 'handel' | 'konflikte' | 'energie' | 'politik'
export type MarktTag = 'oel' | 'gas' | 'eurusd' | 'ruestung' | 'halbleiter' | 'gold' | 'aktien' | 'anleihen'

export interface NewsEintrag {
  id: string
  titel: string
  link: string
  quelle: string
  /** Veröffentlichung (UTC, ISO) */
  zeit: string
  kategorie: NewsKategorie
  maerkte: MarktTag[]
  text?: string
  sprache: 'de' | 'en'
}

export interface NewsDaten {
  version: 1
  lastUpdated: string
  eintraege: NewsEintrag[]
  /** je Feed: Anzahl übernommener Einträge oder Fehlertext */
  quellen: Record<string, number | string>
}

export const KATEGORIE_TEXT: Record<NewsKategorie, string> = {
  handel: 'Handel, Zölle & Sanktionen',
  konflikte: 'Konflikte',
  energie: 'Energie & Rohstoffe',
  politik: 'Wahlen & Politik',
}

export const MARKT_TEXT: Record<MarktTag, string> = {
  oel: 'Öl',
  gas: 'Gas',
  eurusd: 'EUR/USD',
  ruestung: 'Rüstung',
  halbleiter: 'Halbleiter',
  gold: 'Gold',
  aktien: 'Aktien',
  anleihen: 'Anleihen',
}

export const INDIKATOR_TEXT: Record<IndikatorId, string> = {
  cpi: 'Inflation (CPI/HVPI)',
  arbeitsmarkt: 'Arbeitsmarkt',
  bip: 'BIP',
}

export const REGION_TEXT: Record<Region, string> = { us: 'USA', ez: 'Euroraum' }
