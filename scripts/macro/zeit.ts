// Zeitzonen-Helfer ohne Abhängigkeiten: Ortszeit einer Bank → UTC und zurück.

const FORMATE = new Map<string, Intl.DateTimeFormat>()

function formatierer(zone: string): Intl.DateTimeFormat {
  let f = FORMATE.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    FORMATE.set(zone, f)
  }
  return f
}

/** Wandzeit eines UTC-Zeitpunkts in `zone`, als „UTC-Millisekunden der Wanduhr“ */
function wandzeitMs(d: Date, zone: string): number {
  const p: Record<string, number> = {}
  for (const t of formatierer(zone).formatToParts(d)) {
    if (t.type !== 'literal') p[t.type] = Number(t.value)
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second)
}

/** Offset der Zone gegenüber UTC in Minuten zu diesem Zeitpunkt (Berlin im Sommer = +120) */
export function zonenOffsetMin(d: Date, zone: string): number {
  return Math.round((wandzeitMs(d, zone) - d.getTime()) / 60000)
}

/**
 * Ortszeit (ISO-Datum + „HH:MM“) in einer Zeitzone → UTC-Date.
 * Zwei Iterationen reichen, auch um Zeitumstellungen herum.
 */
export function ortszeitZuUtc(datum: string, uhrzeit: string, zone: string): Date {
  const [j, m, t] = datum.split('-').map(Number)
  const [h, mi] = uhrzeit.split(':').map(Number)
  const wunsch = Date.UTC(j, m - 1, t, h, mi)
  let utc = wunsch - zonenOffsetMin(new Date(wunsch), zone) * 60000
  utc = wunsch - zonenOffsetMin(new Date(utc), zone) * 60000
  return new Date(utc)
}

/** ISO-Datum (JJJJ-MM-TT) eines Zeitpunkts in einer Zeitzone */
export function datumInZone(d: Date, zone: string): string {
  const p: Record<string, string> = {}
  for (const t of formatierer(zone).formatToParts(d)) p[t.type] = t.value
  return `${p.year}-${p.month}-${p.day}`
}

export const ZONE_FED = 'America/New_York'
export const ZONE_EZB = 'Europe/Berlin'
/** Veröffentlichung Fed-Statement: 14:00 New York · EZB-Entscheidung: 14:15 Frankfurt */
export const UHRZEIT_FED = '14:00'
export const UHRZEIT_EZB = '14:15'

export function istIsoDatum(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** Tage auf ein ISO-Datum addieren (kalendarisch, ohne Zeitzone) */
export function datumPlus(datum: string, tage: number): string {
  const [j, m, t] = datum.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10)
}
