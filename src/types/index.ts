// Zentrale Datentypen der ChartAkademie.
// time ist überall Unix-Zeit in SEKUNDEN (Konvention von lightweight-charts).

// ── Marktdaten ────────────────────────────────────────────────────────────────

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CandleDatensatz {
  symbol: string
  interval: string
  candles: Candle[]
}

// ── Chart-Annotationen (für Lektions-Demos und Übungs-Auflösungen) ───────────

export type ChartAnnotation =
  | {
      typ: 'marker'
      time: number
      position: 'aboveBar' | 'belowBar'
      form: 'arrowUp' | 'arrowDown' | 'circle'
      text: string
      farbe?: string
    }
  | { typ: 'preislinie'; preis: number; text?: string; farbe?: string }

// ── Lektionen & Curriculum ───────────────────────────────────────────────────

export interface QuizFrage {
  frage: string
  antworten: string[]
  richtigIndex: number
  erklaerung: string // wird nach dem Beantworten angezeigt
}

export type LessonBlock =
  | { typ: 'text'; html: string }
  | { typ: 'callout'; variante: 'tipp' | 'warnung' | 'merke'; html: string }
  | { typ: 'begriffe'; eintraege: { begriff: string; erklaerung: string }[] }
  | { typ: 'demo'; demoId: string; config?: Record<string, unknown> }
  | {
      typ: 'chart'
      titel?: string
      symbol: string
      interval: string
      von: number // Unix-Sekunden
      bis: number
      annotationen?: ChartAnnotation[]
      beschreibung?: string
    }
  | { typ: 'quiz'; fragen: QuizFrage[] }
  | { typ: 'uebung'; szenarioId: string }

export interface Lesson {
  id: string // z.B. 'l1-02'
  level: number
  titel: string
  untertitel: string
  dauerMin: number
  bloecke: LessonBlock[]
}

export interface LevelDef {
  level: number
  titel: string
  beschreibung: string
  lektionIds: string[]
  geplant?: string[] // Titel noch nicht gebauter Lektionen (nur Anzeige)
}

// ── Simulator (Broker & Replay) ──────────────────────────────────────────────

export type Richtung = 'long' | 'short'

export interface Order {
  id: string
  richtung: Richtung
  typ: 'market' | 'limit'
  limitPreis?: number
  stopLoss: number
  takeProfit: number
  menge: number // in Basiswährung (z.B. BTC)
  erstelltBarIndex: number
}

export interface Position {
  richtung: Richtung
  entryPreis: number
  entryTime: number
  menge: number
  stopLoss: number
  takeProfit: number
}

export interface Trade {
  id: string
  richtung: Richtung
  entryPreis: number
  exitPreis: number
  entryTime: number
  exitTime: number
  menge: number
  stopLoss: number
  takeProfit: number
  pnl: number
  rMultiple: number
  exitGrund: 'sl' | 'tp' | 'manuell' | 'szenarioEnde'
  szenarioId?: string
}

// ── Geführte Übungs-Szenarien ────────────────────────────────────────────────

export type SzenarioBewertung = 'perfekt' | 'ok' | 'verpasst' | 'falsch'

export interface Scenario {
  id: string
  titel: string
  strategieId: string // z.B. 'breakout-retest'
  datensatz: string // Dateiname unter public/szenarien/
  symbol: string
  interval: string
  startIndex: number // Replay beginnt hier (Kontext davor sichtbar)
  endIndex: number
  aufgabe: string
  richtung: Richtung
  entryZone: { preisVon: number; preisBis: number; barVon: number; barBis: number }
  idealEntry: number
  idealStopLoss: number
  idealTakeProfit: number
  feedback: { perfekt: string; ok: string; verpasst: string; falsch: string }
  datumVerdeckt: boolean
}
