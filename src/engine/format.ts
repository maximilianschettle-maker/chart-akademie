// Preis-Formatierung, die auch bei kleinen Kursen (XRP, DOGE) genug Stellen zeigt.

/** Sinnvolle Nachkommastellen für einen Kurs dieser Größenordnung. */
export function preisStellen(preis: number): number {
  const p = Math.abs(preis)
  if (p >= 1000) return 1
  if (p >= 10) return 2
  if (p >= 1) return 3
  if (p >= 0.1) return 4
  return 5
}

export function rundePreis(preis: number, referenz = preis): number {
  const f = 10 ** preisStellen(referenz)
  return Math.round(preis * f) / f
}

export function fmtPreis(preis: number, referenz = preis): string {
  const stellen = preisStellen(referenz)
  return preis.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen })
}

/** Preis als Eingabefeld-Text (Punkt als Dezimaltrenner, ohne Tausenderpunkte). */
export function preisText(preis: number, referenz = preis): string {
  return rundePreis(preis, referenz).toFixed(preisStellen(referenz))
}

export function fmtGeld(betrag: number, stellen = 0): string {
  return `${betrag < 0 ? '−' : ''}${Math.abs(betrag).toLocaleString('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  })} $`
}

export function fmtGeldVz(betrag: number, stellen = 0): string {
  return `${betrag >= 0 ? '+' : '−'}${Math.abs(betrag).toLocaleString('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  })} $`
}

export function fmtR(r: number): string {
  return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}R`
}

/** Eingabetext → Zahl (Komma oder Punkt), 0 bei Unsinn. */
export function zahl(wert: string): number {
  const n = parseFloat(wert.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
