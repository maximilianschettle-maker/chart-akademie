// Datentypen des Aktien-Bereichs (Fundamentalanalyse). Bewusst getrennt von
// src/types/index.ts, damit der Trainingsteil unberührt bleibt.
// Beträge sind in der Berichtswährung der Firma (waehrung), Datumswerte ISO 'YYYY-MM-DD'.

export type Quelle = 'sec' | 'yahoo'

export interface Firma {
  /** Yahoo-Symbol, z.B. 'AAPL' oder 'SAP.DE' — Schlüssel überall im Modul */
  symbol: string
  name: string
  /** Berichtswährung der Abschlüsse (Yahoo financialCurrency) */
  waehrung: string
  /** Handelswährung des Kurses (kann abweichen, z.B. ADR in USD) */
  kursWaehrung: string
  boerse: string
  land?: string
  sektor?: string
  branche?: string
  beschreibung?: string
  website?: string
  mitarbeiter?: number
  /** SEC-Kennung, falls die Firma bei der SEC einreicht (auch 20-F-Filer aus Europa) */
  cik?: string
}

export interface Kurs {
  preis: number
  waehrung: string
  /** Unix-Sekunden der Kursfeststellung */
  zeit: number
  marktkap?: number
  aktienAnzahl?: number
  enterpriseValue?: number
  kgvTtm?: number
  kgvForward?: number
  kbv?: number
  kuv?: number
  evEbitda?: number
  dividendenrendite?: number
  /** Analysten-Kursziel (Mittel) */
  kursziel?: number
  hoch52w?: number
  tief52w?: number
}

export type Zeitraum = 'FY' | 'Q'

/** Ein Geschäftsjahr oder Quartal, Beträge in `waehrung`. Fehlende Posten = null. */
export interface Abschluss {
  /** Jahr des Bilanzstichtags (Apple: GJ endet Ende September → 2025) */
  geschaeftsjahr: number
  /** Nur bei Quartalen: 1–4 */
  quartal?: number
  /** Bilanzstichtag ISO */
  ende: string
  zeitraum: Zeitraum
  waehrung: string
  umsatz: number | null
  bruttogewinn: number | null
  ebit: number | null
  ebitda: number | null
  nettogewinn: number | null
  epsVerwaessert: number | null
  aktienVerwaessert: number | null
  bilanzsumme: number | null
  eigenkapital: number | null
  finanzschulden: number | null
  zahlungsmittel: number | null
  operativerCashflow: number | null
  /** Investitionen in Sachanlagen, als positiver Betrag */
  capex: number | null
  freierCashflow: number | null
  /** Gezahlte Dividenden, positiver Betrag */
  dividenden: number | null
  /** Aktienrückkäufe, positiver Betrag */
  rueckkaeufe: number | null
  /** Ausstehende Aktien zum Stichtag */
  aktienAusstehend: number | null
  quellen: Quelle[]
}

export const ABSCHLUSS_FELDER = [
  'umsatz',
  'bruttogewinn',
  'ebit',
  'ebitda',
  'nettogewinn',
  'epsVerwaessert',
  'aktienVerwaessert',
  'bilanzsumme',
  'eigenkapital',
  'finanzschulden',
  'zahlungsmittel',
  'operativerCashflow',
  'capex',
  'freierCashflow',
  'dividenden',
  'rueckkaeufe',
  'aktienAusstehend',
] as const

export type AbschlussFeld = (typeof ABSCHLUSS_FELDER)[number]

/** Antwort des Workers für den Yahoo-Teil einer Firma */
export interface YahooTeil {
  firma: Firma
  jahre: Abschluss[]
  quartale: Abschluss[]
  standAm: number
  /** vom Worker gesetzt, wenn die Quelle nicht erreichbar war und der alte Stand kam */
  veraltet?: boolean
}

/** Antwort des Workers für den SEC-Teil einer Firma */
export interface SecTeil {
  cik: string
  name: string
  /** wie die Zuordnung Symbol → CIK zustande kam */
  zuordnung: 'ticker' | 'name' | 'manuell'
  jahre: Abschluss[]
  quartale: Abschluss[]
  standAm: number
  veraltet?: boolean
}

export interface Fundamentaldaten {
  firma: Firma
  kurs: Kurs | null
  jahre: Abschluss[]
  quartale: Abschluss[]
  quellen: Quelle[]
  secZuordnung?: SecTeil['zuordnung']
  standAm: number
  /** gesetzt, wenn ein Teil nur aus dem alten Cache kam */
  veraltet?: boolean
  hinweise: string[]
}

export interface Suchtreffer {
  symbol: string
  name: string
  boerse: string
  typ: string
}

// ── DCF ──────────────────────────────────────────────────────────────────────

export interface DcfAnnahmen {
  /** Basis-FCF: Durchschnitt der letzten n Jahre (1 = letztes Jahr) */
  basisJahre: number
  /** Wachstum Phase 1 in % p.a. */
  wachstum1: number
  /** Dauer Phase 1 in Jahren */
  jahre1: number
  /** Wachstum Phase 2 in % p.a. */
  wachstum2: number
  /** Dauer Phase 2 in Jahren */
  jahre2: number
  /** Diskontsatz in % */
  diskontsatz: number
  /** Ewiges Wachstum für den Endwert in % */
  endwachstum: number
  /** Sicherheitsmarge in % */
  sicherheitsmarge: number
}

export interface DcfErgebnis {
  basisFcf: number
  /** je Jahr: Jahr-Index, FCF, Barwert */
  jahre: { jahr: number; fcf: number; barwert: number }[]
  summeBarwerte: number
  endwert: number
  endwertBarwert: number
  unternehmenswert: number
  nettoschulden: number
  eigenkapitalwert: number
  fairerWertJeAktie: number
  kaufkursMitMarge: number
  /** Anteil des Endwerts am Unternehmenswert, 0–1 */
  endwertAnteil: number
}

// ── Geräte-Sync (Worker-KV) ──────────────────────────────────────────────────

export interface WatchlistEintrag {
  symbol: string
  name: string
  hinzugefuegtAm: number
}

export interface SyncZustand {
  watchlist: WatchlistEintrag[]
  dcfAnnahmen: Record<string, DcfAnnahmen>
  /** manuelle CIK-Zuordnungen je Symbol */
  cikManuell: Record<string, string>
  aktualisiertAm: number
}

// ── Kursverlauf (Yahoo chart über den Worker) ────────────────────────────────

/** Eine Kerze; strukturgleich mit `Candle` des Trainingsteils, damit das ChartPanel sie zeichnen kann. */
export interface Kerze {
  /** Unix-Sekunden, Tagesanfang UTC */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface KursChart {
  symbol: string
  /** Handelswährung laut Yahoo */
  waehrung: string
  bereich: string
  kerzen: Kerze[]
  standAm: number
}
