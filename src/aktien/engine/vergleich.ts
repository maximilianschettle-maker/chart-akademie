// Firmenvergleich: welche Kennzahlen nebeneinander stehen, wie sie formatiert werden und
// welche Spalte je Zeile die „beste“ ist. Reine Funktionen, die Seite rendert nur.
import type { Fundamentaldaten } from '../types'
import { fmtBetrag, fmtFaktor, fmtKurs, fmtProzent } from './format'
import { letzteJahre, type Kennzahlen } from './kennzahlen'

/** Welche Richtung „besser“ ist. niedrigPositiv: nur Werte > 0 zählen (negatives KGV = Verlust). */
export type Richtung = 'hoch' | 'niedrig' | 'niedrigPositiv' | 'keine'

export interface VergleichZeile {
  id: string
  titel: string
  richtung: Richtung
  hinweis?: string
  wert: (d: Fundamentaldaten, k: Kennzahlen) => number | null
  /** `waehrung` gesetzt: Anzeige in dieser (umgerechneten) Währung statt der Originalwährung */
  format: (wert: number | null, d: Fundamentaldaten, waehrung?: string) => string
  /** Originalwährung des Betrags; nur bei Geldbeträgen gesetzt (die Seite rechnet sie ggf. um) */
  waehrung?: (d: Fundamentaldaten) => string
}

export interface VergleichGruppe {
  titel: string
  zeilen: VergleichZeile[]
}

export const MAX_FIRMEN = 6

const prozent = (v: number | null) => fmtProzent(v)
const prozentVz = (v: number | null) => fmtProzent(v, 1, true)
const faktor = (v: number | null) => fmtFaktor(v)

export const VERGLEICH_GRUPPEN: VergleichGruppe[] = [
  {
    titel: 'Größe',
    zeilen: [
      { id: 'kurs', titel: 'Kurs', richtung: 'keine', wert: (d) => d.kurs?.preis ?? null, format: (v, d, w) => fmtKurs(v, w ?? d.kurs?.waehrung), waehrung: (d) => d.kurs?.waehrung ?? '' },
      { id: 'marktkap', titel: 'Marktkapitalisierung', richtung: 'keine', wert: (d) => d.kurs?.marktkap ?? null, format: (v, d, w) => fmtBetrag(v, w ?? d.kurs?.waehrung), waehrung: (d) => d.kurs?.waehrung ?? '' },
      { id: 'umsatz', titel: 'Umsatz (letztes GJ)', richtung: 'keine', wert: (d) => letzteJahre(d.jahre, 1)[0]?.umsatz ?? null, format: (v, d, w) => fmtBetrag(v, w ?? d.firma.waehrung), waehrung: (d) => d.firma.waehrung },
      { id: 'gewinn', titel: 'Nettogewinn (letztes GJ)', richtung: 'keine', wert: (d) => letzteJahre(d.jahre, 1)[0]?.nettogewinn ?? null, format: (v, d, w) => fmtBetrag(v, w ?? d.firma.waehrung), waehrung: (d) => d.firma.waehrung },
    ],
  },
  {
    titel: 'Bewertung',
    zeilen: [
      { id: 'kgv', titel: 'KGV', richtung: 'niedrigPositiv', hinweis: 'TTM', wert: (_, k) => k.kgv, format: faktor },
      { id: 'kbv', titel: 'KBV', richtung: 'niedrigPositiv', wert: (_, k) => k.kbv, format: faktor },
      { id: 'kuv', titel: 'KUV', richtung: 'niedrigPositiv', wert: (_, k) => k.kuv, format: faktor },
      { id: 'evEbitda', titel: 'EV / EBITDA', richtung: 'niedrigPositiv', wert: (_, k) => k.evEbitda, format: faktor },
      { id: 'fcfRendite', titel: 'FCF-Rendite', richtung: 'hoch', wert: (_, k) => k.fcfRendite, format: prozent },
      { id: 'divRendite', titel: 'Dividendenrendite', richtung: 'hoch', wert: (_, k) => k.dividendenrendite, format: (v) => fmtProzent(v, 2) },
    ],
  },
  {
    titel: 'Profitabilität',
    zeilen: [
      { id: 'bruttomarge', titel: 'Bruttomarge', richtung: 'hoch', wert: (_, k) => k.bruttomarge, format: prozent },
      { id: 'ebitMarge', titel: 'EBIT-Marge', richtung: 'hoch', wert: (_, k) => k.ebitMarge, format: prozent },
      { id: 'nettomarge', titel: 'Nettomarge', richtung: 'hoch', wert: (_, k) => k.nettomarge, format: prozent },
      { id: 'fcfMarge', titel: 'FCF-Marge', richtung: 'hoch', wert: (_, k) => k.fcfMarge, format: prozent },
      { id: 'ekr', titel: 'Eigenkapitalrendite', richtung: 'hoch', wert: (_, k) => k.eigenkapitalrendite, format: prozent },
      { id: 'gkr', titel: 'Gesamtkapitalrendite', richtung: 'hoch', wert: (_, k) => k.gesamtkapitalrendite, format: prozent },
    ],
  },
  {
    titel: 'Wachstum (p.a.)',
    zeilen: [
      { id: 'umsatz1', titel: 'Umsatz 1 J.', richtung: 'hoch', wert: (_, k) => k.umsatzWachstum1, format: prozentVz },
      { id: 'umsatz3', titel: 'Umsatz 3 J.', richtung: 'hoch', wert: (_, k) => k.umsatzWachstum3, format: prozentVz },
      { id: 'umsatz5', titel: 'Umsatz 5 J.', richtung: 'hoch', wert: (_, k) => k.umsatzWachstum5, format: prozentVz },
      { id: 'gewinn3', titel: 'Gewinn 3 J.', richtung: 'hoch', wert: (_, k) => k.gewinnWachstum3, format: prozentVz },
      { id: 'gewinn5', titel: 'Gewinn 5 J.', richtung: 'hoch', wert: (_, k) => k.gewinnWachstum5, format: prozentVz },
      { id: 'eps5', titel: 'EPS 5 J.', richtung: 'hoch', wert: (_, k) => k.epsWachstum5, format: prozentVz },
      { id: 'aktien5', titel: 'Aktienzahl 5 J.', richtung: 'niedrig', hinweis: 'sinkend = Rückkäufe', wert: (_, k) => k.aktienVeraenderung5, format: prozentVz },
    ],
  },
  {
    titel: 'Bilanz & Ausschüttung',
    zeilen: [
      { id: 'ekQuote', titel: 'Eigenkapitalquote', richtung: 'hoch', wert: (_, k) => k.eigenkapitalquote, format: prozent },
      { id: 'nettoschuldenEbitda', titel: 'Nettoschulden / EBITDA', richtung: 'niedrig', hinweis: 'negativ = Nettokasse', wert: (_, k) => k.nettoverschuldungZuEbitda, format: faktor },
      { id: 'ausschuettung', titel: 'Ausschüttungsquote', richtung: 'keine', wert: (_, k) => k.ausschuettungsquote, format: prozent },
      { id: 'rueckfuehrung', titel: 'Rückführung / FCF', richtung: 'keine', wert: (_, k) => k.kapitalrueckfuehrungZuFcf, format: prozent },
    ],
  },
]

/** Symbole aus Freitext oder URL-Parameter: Komma/Leerzeichen getrennt, Großschreibung, ohne Doppelte, höchstens MAX_FIRMEN. */
export function symboleAusText(text: string): string[] {
  const aus: string[] = []
  for (const roh of text.split(/[\s,;]+/)) {
    const s = roh.trim().toUpperCase()
    if (!s || !/^[A-Z0-9.\-^=]{1,20}$/.test(s) || aus.includes(s)) continue
    aus.push(s)
    if (aus.length >= MAX_FIRMEN) break
  }
  return aus
}

/**
 * Index der besten Spalte einer Zeile; null, wenn weniger als zwei vergleichbare Werte vorliegen
 * oder die Zeile keine Richtung hat.
 */
export function besteSpalte(werte: (number | null)[], richtung: Richtung): number | null {
  if (richtung === 'keine') return null
  let bester: number | null = null
  let anzahl = 0
  werte.forEach((w, i) => {
    if (w === null || !Number.isFinite(w)) return
    if (richtung === 'niedrigPositiv' && w <= 0) return
    anzahl++
    if (bester === null) {
      bester = i
      return
    }
    const b = werte[bester] as number
    if (richtung === 'hoch' ? w > b : w < b) bester = i
  })
  if (anzahl < 2 || bester === null) return null
  // Gleichstand (z.B. zweimal 0 % Dividende): niemand ist „besser“
  const b = werte[bester] as number
  const gleich = werte.filter((w, i) => i !== bester && w !== null && w === b).length
  return gleich > 0 ? null : bester
}
