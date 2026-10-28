// ICS-Kalender mit allen Entscheidungsterminen — zum Abonnieren als Backup zu Web Push.
// Deterministisch (kein Zeitstempel des Laufs), damit die Datei nur bei neuen Terminen ändert.

import type { Bank, ZinsTermin } from '../../src/makro/types.ts'

const DAUER_MIN = 60

function icsZeit(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Zeilen länger als 75 Oktette falten (RFC 5545) */
function falten(zeile: string): string {
  const teile: string[] = []
  let rest = zeile
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let schnitt = 75
    while (Buffer.byteLength(rest.slice(0, schnitt), 'utf8') > 75) schnitt--
    teile.push(rest.slice(0, schnitt))
    rest = ' ' + rest.slice(schnitt)
  }
  teile.push(rest)
  return teile.join('\r\n')
}

export function erzeugeIcs(eintraege: { bank: Bank; termin: ZinsTermin }[]): string {
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChartAkademie//Zinsentscheidungen//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Zinsentscheidungen Fed & EZB',
    'X-WR-TIMEZONE:Europe/Berlin',
  ]
  const sortiert = [...eintraege].sort((a, b) => a.termin.datum.localeCompare(b.termin.datum))
  for (const { bank, termin } of sortiert) {
    const start = Date.parse(termin.entscheidungUtc)
    if (!Number.isFinite(start)) continue
    const ende = new Date(start + DAUER_MIN * 60000).toISOString()
    const name = bank === 'fed' ? 'Fed-Zinsentscheidung' : 'EZB-Zinsentscheidung'
    const zusatz = bank === 'fed' && termin.sep ? ' (mit Projektionen)' : termin.hinweis ? ` (${termin.hinweis})` : ''
    const beschreibung = [
      bank === 'fed' ? 'FOMC-Statement 14:00 Uhr New York.' : 'EZB-Ratsentscheidung 14:15 Uhr Frankfurt, Pressekonferenz 14:45 Uhr.',
      termin.beginn ? `Sitzung ab ${termin.beginn}.` : '',
      termin.statementUrl ?? '',
    ]
      .filter(Boolean)
      .join(' ')
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:${bank}-${termin.datum}@chart-akademie`,
      `DTSTAMP:${icsZeit(termin.entscheidungUtc)}`,
      `DTSTART:${icsZeit(termin.entscheidungUtc)}`,
      `DTEND:${icsZeit(ende)}`,
      `SUMMARY:${escape(name + zusatz)}`,
      `DESCRIPTION:${escape(beschreibung)}`,
      `CATEGORIES:${bank === 'fed' ? 'Fed' : 'EZB'}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(name)} morgen`,
      'TRIGGER:-P1D',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(name)} in einer Stunde`,
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  zeilen.push('END:VCALENDAR')
  return zeilen.map(falten).join('\r\n') + '\r\n'
}
