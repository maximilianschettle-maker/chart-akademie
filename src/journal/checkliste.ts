// Checkliste vor dem Trade: fünf Fragen aus dem eigenen Regelwerk. Ja/Nein je Frage; daraus
// folgt „Im Plan“ – alle Ja = im Plan, ein Nein = außerhalb, offen solange etwas unbeantwortet ist.
// Die Antworten gehen als Fakten in die KI-Prüfung.

export interface CheckPunkt {
  id: string
  text: string
  kurz: string
}

export const CHECKLISTE: CheckPunkt[] = [
  { id: 'richtung', kurz: 'Tagesrichtung', text: 'Tagesrichtung geprüft – der Trade läuft mit ihr oder hat einen klaren Grund dagegen' },
  { id: 'zone', kurz: 'Zone', text: 'Einstieg an einer vorher markierten Zone, nicht mitten im Nichts' },
  { id: 'bestaetigung', kurz: 'Bestätigung', text: 'Bestätigungskerze abgewartet, nicht vorab in die Zone gekauft' },
  { id: 'risiko', kurz: 'Risiko', text: 'Stop gesetzt, Risiko höchstens 1 % des Kontos, CRV mindestens 1,5' },
  { id: 'ruhe', kurz: 'Kein Revanche-Trade', text: 'Kein zweiter Trade direkt nach einem Verlust heute, kein Trade aus Langeweile' },
]

export type ChecklisteStand = Record<string, boolean>

/** alle Ja → true, ein Nein → false, sonst null (unvollständig) */
export function imPlanAus(stand: ChecklisteStand | undefined): boolean | null {
  if (!stand) return null
  const antworten = CHECKLISTE.map((p) => stand[p.id])
  if (antworten.some((a) => a === false)) return false
  if (antworten.every((a) => a === true)) return true
  return null
}

/** Punkte, die mit Nein beantwortet wurden */
export function verletzt(stand: ChecklisteStand | undefined): CheckPunkt[] {
  if (!stand) return []
  return CHECKLISTE.filter((p) => stand[p.id] === false)
}

/** Für die KI-Fakten: Text und Antwort je Punkt */
export function checklisteFakten(stand: ChecklisteStand | undefined): { text: string; ok: boolean | null }[] {
  return CHECKLISTE.map((p) => ({ text: p.text, ok: stand && p.id in stand ? stand[p.id] : null }))
}
