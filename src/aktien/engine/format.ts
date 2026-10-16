// Zahlenformate für den Aktien-Bereich (de-DE). Die vorhandene src/engine/format.ts
// kennt nur $-Beträge und Krypto-Preise.

const WAEHRUNGS_ZEICHEN: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', CHF: 'CHF', JPY: '¥', SEK: 'kr', DKK: 'kr', NOK: 'kr' }

export function waehrungsZeichen(waehrung: string): string {
  return WAEHRUNGS_ZEICHEN[waehrung] ?? waehrung
}

function de(wert: number, stellen: number): string {
  return wert.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen })
}

/** Großbeträge als Mio/Mrd/Bio mit Währung: 36.800.000.000 EUR → "36,8 Mrd €" */
export function fmtBetrag(wert: number | null | undefined, waehrung = '', stellen = 1): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return '–'
  const vz = wert < 0 ? '−' : ''
  const abs = Math.abs(wert)
  const z = waehrung ? ` ${waehrungsZeichen(waehrung)}` : ''
  if (abs >= 1e12) return `${vz}${de(abs / 1e12, stellen)} Bio.${z}`
  if (abs >= 1e9) return `${vz}${de(abs / 1e9, stellen)} Mrd.${z}`
  if (abs >= 1e6) return `${vz}${de(abs / 1e6, stellen)} Mio.${z}`
  if (abs >= 1e3) return `${vz}${de(abs / 1e3, stellen)} Tsd.${z}`
  return `${vz}${de(abs, stellen)}${z}`
}

/** Stückzahlen (Aktien) als Mio/Mrd ohne Währung */
export function fmtStueck(wert: number | null | undefined): string {
  return fmtBetrag(wert, '', 2)
}

/** Kurs/Wert je Aktie mit 2 Stellen: 199,22 € */
export function fmtKurs(wert: number | null | undefined, waehrung = ''): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return '–'
  const z = waehrung ? ` ${waehrungsZeichen(waehrung)}` : ''
  return `${wert < 0 ? '−' : ''}${de(Math.abs(wert), 2)}${z}`
}

/** Anteil 0,2762 → "27,6 %"; mitVorzeichen: "+9,4 %" */
export function fmtProzent(anteil: number | null | undefined, stellen = 1, mitVorzeichen = false): string {
  if (anteil === null || anteil === undefined || !Number.isFinite(anteil)) return '–'
  const p = anteil * 100
  const vz = p < 0 ? '−' : mitVorzeichen && p > 0 ? '+' : ''
  return `${vz}${de(Math.abs(p), stellen)} %`
}

/** Vielfache wie KGV: 27,8 → "27,8×" */
export function fmtFaktor(wert: number | null | undefined, stellen = 1): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return '–'
  return `${wert < 0 ? '−' : ''}${de(Math.abs(wert), stellen)}×`
}

export function fmtDatum(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

export function fmtZeitpunkt(ms: number): string {
  return new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Eingabe mit Komma oder Punkt → Zahl, ungültig → null */
export function zahlAus(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
