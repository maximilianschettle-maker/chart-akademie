// Datenvertrag des Markt-Trackers: Konfiguration (App ↔ Worker-KV ↔ Action) und
// Ausgabe der Action (public/data/tracker.json), die das Frontend liest.

export type Markt = 'aktien-us' | 'aktien-eu' | 'aktien-asien' | 'rohstoff' | 'krypto' | 'devisen'

export interface Instrument {
  id: string
  name: string
  /** Yahoo-Finance-Symbol, z.B. ^GSPC, GC=F, BTC-USD */
  symbol: string
  /** Coinbase-Produkt als Fallback (nur Krypto) */
  coinbase?: string
  waehrung: string
  dezimalen: number
  markt: Markt
}

export type MusterId = 'ausbruch' | 'tunnel' | 'ema-kreuz' | 'rsi' | 'setup'

export interface MusterDef {
  id: MusterId
  name: string
  beschreibung: string
}

/** Zeitebene: Tageskerzen (Swing) oder Stundenkerzen (Intraday) */
export type Ebene = 'tag' | 'stunde'

export interface TrackerConfig {
  /** Instrument-Ids aus dem Katalog, in Anzeige-Reihenfolge */
  instrumente: string[]
  /** Muster auf der Tagesebene */
  muster: Record<MusterId, boolean>
  /** Push-Nachrichten bei neuen Tages-Signalen */
  push: boolean
  /** Muster auf der Stundenebene */
  musterStunde: Record<MusterId, boolean>
  /** Push-Nachrichten bei neuen Stunden-Signalen */
  pushStunde: boolean
  /** Unix-ms der letzten Änderung – neuerer Stand gewinnt beim Sync */
  aktualisiertAm: number
}

export type Richtung = 'long' | 'short' | 'neutral'

export interface Signal {
  /** eindeutig je Instrument, Ebene, Muster, Richtung und Kerze */
  id: string
  instrument: string
  /** fehlt bei älteren Daten = Tagesebene */
  ebene?: Ebene
  muster: MusterId
  richtung: Richtung
  /** Tag der Kerze (ISO-Datum, UTC) */
  datum: string
  /** Beginn der Kerze (UTC-ISO) – auf der Stundenebene mit Uhrzeit */
  kerzeZeit?: string
  /** Lauf, der das Signal zuerst gesehen hat (UTC-ISO) */
  zeit: string
  preis: number
  titel: string
  text: string
  /** Tageskerze war beim Lauf noch nicht geschlossen – kann sich bis zum Schluss noch ändern */
  vorlaeufig?: boolean
}

export interface Tunnel {
  tief: number
  hoch: number
  seitTagen: number
  lage: 'unten' | 'oben' | 'mitte'
}

export interface Analyse {
  kurs: number
  /** Zeitpunkt des Kurses (UTC-ISO) */
  kursZeit: string
  /** Veränderung zum Vortagesschluss als Anteil (0.012 = +1,2 %) */
  aenderungTag: number
  hoch20: number
  tief20: number
  hoch52w: number
  tief52w: number
  ema20: number | null
  ema50: number | null
  ema200: number | null
  rsi14: number | null
  atr14: number | null
  tunnel: Tunnel | null
  trend: 'auf' | 'ab' | 'seitwaerts'
  /** letzte Kerze noch offen */
  vorlaeufig: boolean
}

/** Kerzen, Analyse und Signale einer Zeitebene */
export interface EbeneDaten {
  quelle: 'yahoo' | 'coinbase' | 'alt'
  /** Kerzen als [time (Unix-Sek), open, high, low, close, volume] */
  kerzen: number[][]
  analyse: Analyse | null
  /** Signale der letzten 30 Tage, neueste zuerst */
  signale: Signal[]
  fehler?: string
}

export interface InstrumentDaten {
  id: string
  name: string
  symbol: string
  waehrung: string
  dezimalen: number
  quelle: 'yahoo' | 'coinbase' | 'alt'
  /** Tageskerzen als [time (Unix-Sek, UTC-Tagesanfang), open, high, low, close, volume], die letzten ~2 Jahre */
  kerzen: number[][]
  analyse: Analyse | null
  /** Tages-Signale der letzten 30 Tage, neueste zuerst */
  signale: Signal[]
  fehler?: string
  /** Stundenebene (fehlt bei älteren Daten) */
  stunde?: EbeneDaten
}

export interface TrackerDaten {
  version: 1
  /** letzter erfolgreicher Lauf (UTC-ISO) */
  lastUpdated: string
  /** Konfiguration, die der Lauf benutzt hat (Worker-KV oder Fallback-Datei) */
  config: TrackerConfig
  configQuelle: 'worker' | 'datei' | 'standard'
  instrumente: InstrumentDaten[]
}
