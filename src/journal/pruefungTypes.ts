// Antwort der KI-Prüfung eines Trades. Ohne Importe, damit der Worker die Datei einbinden kann.

export type PruefUrteil = 'sauber' | 'mit Abstrichen' | 'herbeigesehnt'
export type PruefSetup = 'ja' | 'teilweise' | 'nein' | 'unklar'
export type PruefEinstieg = 'passend' | 'zu früh' | 'zu spät' | 'unklar'
export type PruefStop = 'sinnvoll' | 'zu eng' | 'zu weit' | 'ohne Struktur' | 'unklar'

export interface PruefungAntwort {
  urteil: PruefUrteil
  setupVorhanden: PruefSetup
  einstieg: PruefEinstieg
  stop: PruefStop
  /** Begründung in wenigen Sätzen, Deutsch, mit Gegenthese */
  text: string
  /** 2–3 konkrete Punkte für das nächste Mal */
  naechstesMal: string[]
  modell: string
}
