// Chance-Risiko-Rechner (Trader-Ansicht): aus Einstieg, Stop und Ziel werden Risiko je Stück,
// Stückzahl fürs gewünschte Kontorisiko, Positionswert und CRV. Reine Funktion, getestet.

export type Richtung = 'long' | 'short'

export interface CrvEingabe {
  richtung: Richtung
  konto: number
  /** Risiko je Trade in Prozent des Kontos, z.B. 1 */
  risikoProzent: number
  entry: number
  stop: number
  ziel: number
}

export interface CrvErgebnis {
  /** Betrag, der bei Stop verloren geht (Konto × Risiko) */
  risikoBetrag: number
  /** Abstand Einstieg → Stop je Stück */
  risikoJeStueck: number
  chanceJeStueck: number
  /** ganze Stücke, die ins Risiko passen (0, wenn der Stop auf der falschen Seite liegt) */
  stueck: number
  positionswert: number
  /** Anteil des Kontos, der im Trade steckt */
  positionAnteil: number
  crv: number
  /** Gewinn, wenn das Ziel erreicht wird (mit ganzer Stückzahl) */
  gewinnBeiZiel: number
  verlustBeiStop: number
  stopProzent: number
  zielProzent: number
  /** Hinweise auf unsinnige Eingaben */
  probleme: string[]
}

export function crvBerechnen(e: CrvEingabe): CrvErgebnis {
  const probleme: string[] = []
  const vz = e.richtung === 'long' ? 1 : -1
  const risikoJeStueck = (e.entry - e.stop) * vz
  const chanceJeStueck = (e.ziel - e.entry) * vz
  if (!(e.entry > 0)) probleme.push('Einstieg fehlt')
  if (!(risikoJeStueck > 0)) probleme.push(e.richtung === 'long' ? 'Stop muss unter dem Einstieg liegen' : 'Stop muss über dem Einstieg liegen')
  if (!(chanceJeStueck > 0)) probleme.push(e.richtung === 'long' ? 'Ziel muss über dem Einstieg liegen' : 'Ziel muss unter dem Einstieg liegen')
  if (!(e.konto > 0) || !(e.risikoProzent > 0)) probleme.push('Konto und Risiko müssen größer als 0 sein')

  const risikoBetrag = Math.max(0, e.konto) * Math.max(0, e.risikoProzent) / 100
  const stueck = risikoJeStueck > 0 ? Math.floor(risikoBetrag / risikoJeStueck) : 0
  const positionswert = stueck * e.entry
  const crv = risikoJeStueck > 0 && chanceJeStueck > 0 ? chanceJeStueck / risikoJeStueck : 0
  return {
    risikoBetrag,
    risikoJeStueck: Math.max(0, risikoJeStueck),
    chanceJeStueck: Math.max(0, chanceJeStueck),
    stueck,
    positionswert,
    positionAnteil: e.konto > 0 ? positionswert / e.konto : 0,
    crv,
    gewinnBeiZiel: stueck * Math.max(0, chanceJeStueck),
    verlustBeiStop: stueck * Math.max(0, risikoJeStueck),
    stopProzent: e.entry > 0 ? (risikoJeStueck / e.entry) * 100 : 0,
    zielProzent: e.entry > 0 ? (chanceJeStueck / e.entry) * 100 : 0,
    probleme,
  }
}

/** Stop in Prozent vom Einstieg (Richtung beachtet) */
export function stopAusProzent(entry: number, prozent: number, richtung: Richtung): number {
  return richtung === 'long' ? entry * (1 - prozent / 100) : entry * (1 + prozent / 100)
}

/** Ziel als Vielfaches des Risikos (R) */
export function zielAusR(entry: number, stop: number, r: number, richtung: Richtung): number {
  const abstand = Math.abs(entry - stop) * r
  return richtung === 'long' ? entry + abstand : entry - abstand
}

/** Rundung wie die Preisachse: große Kurse 2 Stellen, kleine mehr */
export function rundePreis(p: number): number {
  const stellen = p >= 100 ? 2 : p >= 1 ? 3 : 5
  return Number(p.toFixed(stellen))
}
