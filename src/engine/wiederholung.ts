// Spaced Repetition für Quizfragen (vereinfachtes Leitner-System):
// Eine falsch beantwortete Frage landet in der Wiederholungs-Box. Jede richtige
// Wiederholung hebt sie eine Stufe (Intervall wächst), jede falsche setzt sie
// auf Stufe 0 zurück. Nach der letzten Stufe gilt sie als gelernt und fliegt raus.

export const INTERVALLE_TAGE = [1, 3, 7, 14, 30]
const TAG_MS = 24 * 3600 * 1000

export interface WiederholungsEintrag {
  lektionId: string
  frageIndex: number
  stufe: number
  faelligAm: number // Unix-ms
  fehlversuche: number
}

export function schluessel(lektionId: string, frageIndex: number): string {
  return `${lektionId}#${frageIndex}`
}

/** Neuer Eintrag nach einer falschen Antwort in der Lektion selbst. */
export function neuerEintrag(lektionId: string, frageIndex: number, jetzt = Date.now()): WiederholungsEintrag {
  return { lektionId, frageIndex, stufe: 0, faelligAm: jetzt + INTERVALLE_TAGE[0] * TAG_MS, fehlversuche: 1 }
}

/**
 * Eintrag nach einer Wiederholungs-Antwort. Gibt null zurück, wenn die Frage
 * als gelernt gilt (alle Stufen bestanden).
 */
export function nachWiederholung(
  e: WiederholungsEintrag,
  richtig: boolean,
  jetzt = Date.now(),
): WiederholungsEintrag | null {
  if (!richtig) {
    return { ...e, stufe: 0, faelligAm: jetzt + INTERVALLE_TAGE[0] * TAG_MS, fehlversuche: e.fehlversuche + 1 }
  }
  const stufe = e.stufe + 1
  if (stufe >= INTERVALLE_TAGE.length) return null
  return { ...e, stufe, faelligAm: jetzt + INTERVALLE_TAGE[stufe] * TAG_MS }
}

export function faellige(
  eintraege: Record<string, WiederholungsEintrag>,
  jetzt = Date.now(),
): WiederholungsEintrag[] {
  return Object.values(eintraege)
    .filter((e) => e.faelligAm <= jetzt)
    .sort((a, b) => a.faelligAm - b.faelligAm)
}

/** Nächster Fälligkeitszeitpunkt (für „nächste Wiederholung in …“), null wenn leer. */
export function naechsteFaelligkeit(eintraege: Record<string, WiederholungsEintrag>): number | null {
  const werte = Object.values(eintraege).map((e) => e.faelligAm)
  return werte.length ? Math.min(...werte) : null
}
