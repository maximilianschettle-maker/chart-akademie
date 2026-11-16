// Merge-Regeln für Journal und Lernfortschritt — bewusst ohne Imports, damit der
// Cloudflare Worker (worker/tsconfig.json) sie serverseitig nutzen kann, ohne den
// Katalog, die Strategien oder React-Code mitzuziehen. Die bisherigen Module
// (sicherung.ts, journal/engine.ts, szenarioGrader.ts) re-exportieren von hier.
//
// Alle Regeln sind kommutativ und idempotent: merge(a, b) = merge(b, a) und
// merge(a, a) = a. Deshalb kann der Worker beim PUT einfach mergen und den
// gemergten Stand zurückgeben, ohne 409-Konflikte.

export const BEWERTUNG_RANG = { falsch: 0, verpasst: 1, ok: 2, gut: 3, perfekt: 4 } as const
export type Bewertung = keyof typeof BEWERTUNG_RANG

/** Simulator-Trades: Union per Id, der vorhandene gewinnt; sortiert nach Ausstieg, dann Einstieg. */
export function mergeTrades<T extends { id: string; exitTime: number; entryTime: number }>(vorhanden: T[], neue: T[]): T[] {
  const ids = new Set(vorhanden.map((t) => t.id))
  const frisch = neue.filter((t) => !ids.has(t.id))
  return [...vorhanden, ...frisch].sort((a, b) => a.exitTime - b.exitTime || a.entryTime - b.entryTime)
}

/** Setup-Rückblicke: je Sitzung einer, der neuere Stand gewinnt. */
export function mergeRueckblicke<T extends { sitzungId: string; erstelltAm: number }>(vorhanden: T[], neue: T[]): T[] {
  const map = new Map(vorhanden.map((r) => [r.sitzungId, r]))
  for (const r of neue) {
    const alt = map.get(r.sitzungId)
    if (!alt || r.erstelltAm > alt.erstelltAm) map.set(r.sitzungId, r)
  }
  return [...map.values()].sort((a, b) => a.erstelltAm - b.erstelltAm)
}

/** Echte Trades (Journal): per Id, die jüngere Änderung gewinnt; sortiert nach Einstieg, dann Id. */
export function mergeEintraege<T extends { id: string; geaendertAm: number; entryTime: number }>(vorhanden: T[], neue: T[]): T[] {
  const map = new Map(vorhanden.map((e) => [e.id, e]))
  for (const e of neue) {
    const alt = map.get(e.id)
    if (!alt || e.geaendertAm > alt.geaendertAm) map.set(e.id, e)
  }
  return [...map.values()].sort((a, b) => a.entryTime - b.entryTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Lektionen: das bessere Quiz-Ergebnis gewinnt. */
export function mergeLektionen<T extends { quizProzent: number }>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const out = { ...a }
  for (const [id, e] of Object.entries(b)) {
    const alt = out[id]
    if (!alt || e.quizProzent > alt.quizProzent) out[id] = e
  }
  return out
}

/** Übungs-Szenarien: die bessere Bewertung gewinnt. */
export function mergeSzenarien<T extends { bewertung: Bewertung }>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
  const out = { ...a }
  for (const [id, e] of Object.entries(b)) {
    const alt = out[id]
    if (!alt || BEWERTUNG_RANG[e.bewertung] > BEWERTUNG_RANG[alt.bewertung]) out[id] = e
  }
  return out
}

/** Wiederholungs-Box: höherer Lernstand gewinnt; bei Gleichstand die frühere Fälligkeit. */
export function mergeWiederholungen<T extends { stufe: number; faelligAm: number }>(
  a: Record<string, T>,
  b: Record<string, T>,
): Record<string, T> {
  const out = { ...a }
  for (const [key, e] of Object.entries(b)) {
    const alt = out[key]
    if (!alt || e.stufe > alt.stufe || (e.stufe === alt.stufe && e.faelligAm < alt.faelligAm)) out[key] = e
  }
  return out
}

export const UEBUNGS_LOG_MAX = 500

/** Übungs-Log: Union je (Zeitpunkt, Szenario, Strategie), älteste zuerst, auf `max` gekürzt (die neuesten bleiben). */
export function mergeUebungsLog<T extends { am: number; szenarioId: string; strategieId: string }>(
  a: T[],
  b: T[],
  max = UEBUNGS_LOG_MAX,
): T[] {
  const map = new Map<string, T>()
  for (const e of [...a, ...b]) {
    const key = `${e.am}|${e.szenarioId}|${e.strategieId}`
    if (!map.has(key)) map.set(key, e)
  }
  const alle = [...map.values()].sort((x, y) => x.am - y.am || (x.szenarioId < y.szenarioId ? -1 : x.szenarioId > y.szenarioId ? 1 : 0))
  return alle.length > max ? alle.slice(alle.length - max) : alle
}

/** JSON mit sortierten Objekt-Schlüsseln — gleicher Inhalt ergibt denselben Text (Vergleich ohne Diff-Rauschen). */
export function stabilJson(wert: unknown, einzug: number = 2): string {
  return JSON.stringify(
    wert,
    (_k, v: unknown) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : v,
    einzug,
  )
}
