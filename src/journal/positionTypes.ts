// Vom Worker aus einem Broker-Screenshot (eToro) erkannte Positionen. Bewusst ohne Importe,
// damit der Worker die Datei mit einbinden kann (worker/tsconfig.json).

export interface ErkanntePosition {
  /** Positions-ID des Brokers (eToro „#3626300872“), ohne Raute */
  brokerId: string | null
  /** Instrument, wie es der Broker schreibt (NSDQ100, GOLD, OIL, BTC …) */
  instrument: string
  richtung: 'kaufen' | 'verkaufen' | null
  hebel: number | null
  /** Kontrakte/Einheiten */
  kontrakte: number | null
  /** Positionsgröße (Einsatz × Hebel) in Kontowährung */
  positionsgroesse: number | null
  /** Einsatz/Marge in Kontowährung */
  einsatz: number | null
  eroeffnungskurs: number | null
  /** Ortszeit wie angezeigt, 'YYYY-MM-DDTHH:mm' */
  eroeffnungsdatum: string | null
  stopLoss: number | null
  takeProfit: number | null
  /** aktueller bzw. realisierter Gewinn/Verlust in Kontowährung (negativ = Verlust) */
  gewinnVerlust: number | null
  uebernachtgebuehren: number | null
  status: 'offen' | 'geschlossen'
  schlusskurs: number | null
  schlussdatum: string | null
}

export interface ScreenshotErgebnis {
  positionen: ErkanntePosition[]
  /** Was nicht lesbar war; null wenn alles klar */
  hinweis: string | null
  modell: string
}

export const BILD_TYPEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type BildTyp = (typeof BILD_TYPEN)[number]
