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

// ---------------------------------------------------------------------------
// Sync-Stände (Journal, Lernfortschritt): Minimal-Typen, Prüfung und Merge.
// Der Worker kennt die vollen Typen nicht und braucht sie auch nicht — er mergt
// anhand der Schlüsselfelder und reicht alles andere unverändert durch.

export const RUECKBLICKE_MAX = 200

type Rest = { [k: string]: unknown }
// Nur die Schlüsselfelder; alles Weitere reicht der Merge unverändert durch (strukturelle Typisierung).
export type TradeMin = { id: string; exitTime: number; entryTime: number }
export type RueckblickMin = { sitzungId: string; erstelltAm: number }
export type EintragMin = { id: string; geaendertAm: number; entryTime: number }
export type LektionMin = { quizProzent: number }
export type SzenarioMin = { bewertung: Bewertung }
export type WiederholungMin = { stufe: number; faelligAm: number }
export type UebungMin = { am: number; szenarioId: string; strategieId: string }

export interface JournalSyncStand {
  tradeHistorie: TradeMin[]
  rueckblicke: RueckblickMin[]
  eintraege: EintragMin[]
}
export interface FortschrittSyncStand {
  abgeschlosseneLektionen: Record<string, LektionMin>
  szenarioErgebnisse: Record<string, SzenarioMin>
  wiederholungen: Record<string, WiederholungMin>
  uebungsLog: UebungMin[]
}
export type SyncTeilW = 'journal' | 'fortschritt'
export type SyncStandW = { journal: JournalSyncStand; fortschritt: FortschrittSyncStand }

const liste = (v: unknown): Rest[] => (Array.isArray(v) ? v.filter((x): x is Rest => !!x && typeof x === 'object') : [])
const objekt = (v: unknown): Record<string, Rest> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => !!x && typeof x === 'object')) as Record<string, Rest>
    : {}
const hat = (x: Rest, ...felder: string[]) => felder.every((f) => f in x)

/** Liest einen Stand aus unbekanntem JSON; fehlende Teile werden leer, Einträge ohne Schlüsselfelder fallen raus. */
export function syncStandLesen<T extends SyncTeilW>(teil: T, roh: unknown): SyncStandW[T] | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null
  const d = roh as Rest
  if (teil === 'journal') {
    const stand: JournalSyncStand = {
      tradeHistorie: liste(d.tradeHistorie).filter((x): x is TradeMin => hat(x, 'id', 'exitTime', 'entryTime')),
      rueckblicke: liste(d.rueckblicke).filter((x): x is RueckblickMin => hat(x, 'sitzungId', 'erstelltAm')),
      eintraege: liste(d.eintraege).filter((x): x is EintragMin => hat(x, 'id', 'geaendertAm', 'entryTime')),
    }
    return stand as SyncStandW[T]
  }
  const stand: FortschrittSyncStand = {
    abgeschlosseneLektionen: objekt(d.abgeschlosseneLektionen) as Record<string, LektionMin>,
    szenarioErgebnisse: objekt(d.szenarioErgebnisse) as Record<string, SzenarioMin>,
    wiederholungen: objekt(d.wiederholungen) as Record<string, WiederholungMin>,
    uebungsLog: liste(d.uebungsLog).filter((x): x is UebungMin => hat(x, 'am', 'szenarioId', 'strategieId')),
  }
  return stand as SyncStandW[T]
}

export function syncStandLeer<T extends SyncTeilW>(teil: T): SyncStandW[T] {
  const leer: SyncStandW = {
    journal: { tradeHistorie: [], rueckblicke: [], eintraege: [] },
    fortschritt: { abgeschlosseneLektionen: {}, szenarioErgebnisse: {}, wiederholungen: {}, uebungsLog: [] },
  }
  return leer[teil]
}

/** Zwei Stände eines Teils zusammenführen; Rückblicke und Übungs-Log werden auf ihr Maximum gekürzt (die neuesten bleiben). */
export function syncStandMergen<T extends SyncTeilW>(teil: T, a: SyncStandW[T], b: SyncStandW[T]): SyncStandW[T] {
  if (teil === 'journal') {
    const x = a as JournalSyncStand
    const y = b as JournalSyncStand
    const rueckblicke = mergeRueckblicke(x.rueckblicke, y.rueckblicke)
    const stand: JournalSyncStand = {
      tradeHistorie: mergeTrades(x.tradeHistorie, y.tradeHistorie),
      rueckblicke: rueckblicke.length > RUECKBLICKE_MAX ? rueckblicke.slice(rueckblicke.length - RUECKBLICKE_MAX) : rueckblicke,
      eintraege: mergeEintraege(x.eintraege, y.eintraege),
    }
    return stand as SyncStandW[T]
  }
  const x = a as FortschrittSyncStand
  const y = b as FortschrittSyncStand
  const stand: FortschrittSyncStand = {
    abgeschlosseneLektionen: mergeLektionen(x.abgeschlosseneLektionen, y.abgeschlosseneLektionen),
    szenarioErgebnisse: mergeSzenarien(x.szenarioErgebnisse, y.szenarioErgebnisse),
    wiederholungen: mergeWiederholungen(x.wiederholungen, y.wiederholungen),
    uebungsLog: mergeUebungsLog(x.uebungsLog, y.uebungsLog),
  }
  return stand as SyncStandW[T]
}

/** Deterministischer Text eines Stands (Listen in fester Reihenfolge) — zum Vergleich „hat sich etwas geändert?“. */
export function syncStandText<T extends SyncTeilW>(teil: T, stand: SyncStandW[T]): string {
  return stabilJson(syncStandMergen(teil, syncStandLeer(teil), stand), 0)
}
