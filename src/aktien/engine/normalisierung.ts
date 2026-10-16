// Zusammenführen der Abschlüsse beider Quellen: SEC zuerst, Yahoo füllt Lücken.
// Läuft im Browser (Client baut Fundamentaldaten aus zwei Worker-Antworten).

import { ABSCHLUSS_FELDER, type Abschluss, type Fundamentaldaten, type Kurs, type Quelle, type SecTeil, type YahooTeil } from '../types'

function schluessel(a: Abschluss): string {
  return a.zeitraum === 'FY' ? `${a.geschaeftsjahr}` : `${a.geschaeftsjahr}Q${a.quartal}`
}

/**
 * Je Periode ein Abschluss. Felder: SEC-Wert, sonst Yahoo-Wert. Bei unterschiedlicher
 * Währung werden Yahoo-Beträge nicht übernommen (nur Stückzahlen), stattdessen ein Hinweis.
 */
export function abschluesseVereinen(sec: Abschluss[], yahoo: Abschluss[], hinweise: string[]): Abschluss[] {
  const jePeriode = new Map<string, Abschluss>()
  for (const a of sec) jePeriode.set(schluessel(a), { ...a, quellen: ['sec'] })
  let waehrungsKonflikt = false
  for (const y of yahoo) {
    const k = schluessel(y)
    const s = jePeriode.get(k)
    if (!s) {
      jePeriode.set(k, { ...y, quellen: ['yahoo'] })
      continue
    }
    const gleicheWaehrung = s.waehrung === y.waehrung
    let ergaenzt = false
    for (const f of ABSCHLUSS_FELDER) {
      if (s[f] !== null || y[f] === null) continue
      const stueck = f === 'aktienVerwaessert' || f === 'aktienAusstehend'
      if (!gleicheWaehrung && !stueck) {
        waehrungsKonflikt = true
        continue
      }
      s[f] = y[f]
      ergaenzt = true
    }
    if (ergaenzt && !s.quellen.includes('yahoo')) s.quellen.push('yahoo')
  }
  if (waehrungsKonflikt) hinweise.push('SEC und Yahoo berichten in verschiedenen Währungen — Lücken wurden nicht aus Yahoo gefüllt.')
  return [...jePeriode.values()].sort((x, y) => x.ende.localeCompare(y.ende))
}

export function fundamentaldatenBauen(yahoo: YahooTeil | null, sec: SecTeil | null, kurs: Kurs | null, standAm: number, veraltet = false): Fundamentaldaten | null {
  if (!yahoo && !sec) return null
  const hinweise: string[] = []
  const firma = yahoo
    ? { ...yahoo.firma, cik: sec?.cik ?? yahoo.firma.cik }
    : { symbol: '', name: sec!.name, waehrung: sec!.jahre[0]?.waehrung ?? 'USD', kursWaehrung: 'USD', boerse: '', cik: sec!.cik }
  const jahre = abschluesseVereinen(sec?.jahre ?? [], yahoo?.jahre ?? [], hinweise)
  const quartale = abschluesseVereinen(sec?.quartale ?? [], yahoo?.quartale ?? [], hinweise)
  const quellen: Quelle[] = []
  if (sec && sec.jahre.length > 0) quellen.push('sec')
  if (yahoo) quellen.push('yahoo')
  if (!sec) hinweise.push('Keine SEC-Daten: Firma reicht nicht bei der SEC ein oder konnte nicht zugeordnet werden. Bilanzen stammen von Yahoo (ca. 4 Jahre).')
  if (kurs && kurs.waehrung !== firma.waehrung) hinweise.push(`Kurs in ${kurs.waehrung}, Abschlüsse in ${firma.waehrung} — Kennzahlen mit Kursbezug werden nicht berechnet.`)
  return { firma, kurs, jahre, quartale, quellen, secZuordnung: sec?.zuordnung, standAm, veraltet: veraltet || undefined, hinweise }
}
