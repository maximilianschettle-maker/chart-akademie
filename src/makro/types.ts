// Datenvertrag zwischen dem Datenskript (scripts/macro/, GitHub Action) und dem
// Frontend: public/data/macro.json. Das Frontend liest nur diese Datei.

export interface ZinsTermin {
  /** Entscheidungstag als ISO-Datum (Ortszeit der Bank), z.B. 2026-10-28 */
  datum: string
  /** erster Sitzungstag bei zweitägigen Sitzungen */
  beginn?: string
  /** Veröffentlichung der Entscheidung als UTC-Zeitpunkt (ISO) */
  entscheidungUtc: string
  /** Fed: Sitzung mit Projektionen (Summary of Economic Projections) */
  sep?: boolean
  /** Link zum Statement bzw. zur Pressemitteilung, sobald bekannt */
  statementUrl?: string
  /** Besonderheit, z.B. „notation vote“ */
  hinweis?: string
}

export interface FedZinsPunkt {
  /** gültig ab (ISO-Datum) */
  datum: string
  oben: number
  unten: number
}

export interface EzbZinsPunkt {
  /** gültig ab (ISO-Datum) */
  datum: string
  einlage: number
}

export interface Meldung {
  titel: string
  /** Veröffentlichung als UTC-Zeitpunkt (ISO) */
  datum: string
  link: string
}

export interface Entscheidung {
  /** Entscheidungstag (ISO-Datum) */
  datum: string
  link?: string
  /** fertiger Kurztext, z.B. „unverändert 3,75–4,00 %“ */
  text: string
  aenderungBp?: number
}

export interface FedZins {
  oben: number
  unten: number
  gueltigAb: string
  letzteAenderungBp: number
  letzteAenderungAm: string
}

export interface EzbZins {
  einlage: number
  gueltigAb: string
  letzteAenderungBp: number
  letzteAenderungAm: string
}

export interface FedDaten {
  zins: FedZins | null
  historie: FedZinsPunkt[]
  termine: ZinsTermin[]
  meldungen: Meldung[]
  letzteEntscheidung: Entscheidung | null
}

export interface EzbDaten {
  zins: EzbZins | null
  historie: EzbZinsPunkt[]
  termine: ZinsTermin[]
  meldungen: Meldung[]
  letzteEntscheidung: Entscheidung | null
}

/** Herkunft je Teil: live geholt, aus der Fallback-Datei, alter Stand übernommen oder fehlgeschlagen */
export type QuellenStatus = 'live' | 'fallback' | 'alt' | 'fehler'

export interface MakroDaten {
  version: 1
  /** letzter erfolgreicher Lauf des Datenskripts (UTC, ISO) */
  lastUpdated: string
  quellen: Record<string, QuellenStatus>
  fed: FedDaten
  ezb: EzbDaten
  /** VAPID Public Key für Web Push (öffentlich, kein Geheimnis) */
  push?: { publicKey: string }
}

export type Bank = 'fed' | 'ezb'
