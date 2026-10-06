import type { Trade } from '../types'
import type { GespeicherterRueckblick } from './rueckblick'
import {
  type Sicherung,
  mergeLektionen,
  mergeRueckblicke,
  mergeSzenarien,
  mergeTrades,
  mergeWiederholungen,
} from './sicherung'

// Git-Sync: Journal und Lernfortschritt liegen als zwei JSON-Dateien in einem
// GitHub-Repository. Hier nur das Format und das Zusammenführen (pur, testbar);
// die HTTP-Seite steht in data/githubClient.ts.
//
// Die Dateien tragen bewusst keinen Zeitstempel und werden stabil serialisiert
// (sortierte Schlüssel, feste Reihenfolge) — gleicher Stand ergibt denselben
// Text, also keinen leeren Commit und saubere Diffs.

export const SYNC_VERSION = 1

export type SyncTeil = 'journal' | 'fortschritt'
export const SYNC_TEILE: SyncTeil[] = ['journal', 'fortschritt']
export const SYNC_DATEI: Record<SyncTeil, string> = {
  journal: 'journal.json',
  fortschritt: 'fortschritt.json',
}
export const SYNC_NAME: Record<SyncTeil, string> = {
  journal: 'Journal',
  fortschritt: 'Lernfortschritt',
}

export interface JournalStand {
  tradeHistorie: Trade[]
  rueckblicke: GespeicherterRueckblick[]
}
export type FortschrittStand = Sicherung['fortschritt']

export interface SyncStand {
  journal: JournalStand
  fortschritt: FortschrittStand
}

/** „https://github.com/max/daten.git“ → „max/daten“; null, wenn es kein owner/name ist. */
export function repoNormalisieren(eingabe: string): string | null {
  const s = eingabe
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '')
  return /^[\w.-]+\/[\w.-]+$/.test(s) ? s : null
}

/** Ordner im Repo ohne Rand-Schrägstriche; leer = Wurzel. */
export function ordnerNormalisieren(eingabe: string): string {
  return eingabe
    .split(/[\\/]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .join('/')
}

function stabil(wert: unknown): string {
  return JSON.stringify(
    wert,
    (_k, v: unknown) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : v,
    2,
  )
}

/** Dateiinhalt für einen Teil — deterministisch, mit abschließendem Zeilenumbruch. */
export function dateiText<T extends SyncTeil>(teil: T, stand: SyncStand[T]): string {
  let daten: SyncStand[SyncTeil] = stand
  if (teil === 'journal') {
    const j = stand as JournalStand
    daten = {
      tradeHistorie: [...j.tradeHistorie].sort(
        (a, b) => a.exitTime - b.exitTime || a.entryTime - b.entryTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      ),
      rueckblicke: [...j.rueckblicke].sort(
        (a, b) => a.erstelltAm - b.erstelltAm || (a.sitzungId < b.sitzungId ? -1 : a.sitzungId > b.sitzungId ? 1 : 0),
      ),
    }
  }
  return stabil({ app: 'chartakademie', art: teil, version: SYNC_VERSION, ...daten }) + '\n'
}

/** Liest eine Sync-Datei; null, wenn der Text keine passende ChartAkademie-Datei ist. */
export function dateiLesen<T extends SyncTeil>(teil: T, text: string): SyncStand[T] | null {
  let x: unknown
  try {
    x = JSON.parse(text)
  } catch {
    return null
  }
  if (!x || typeof x !== 'object') return null
  const d = x as Record<string, unknown>
  if (d.app !== 'chartakademie' || d.art !== teil) return null
  const objekt = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
  if (teil === 'journal') {
    if (!Array.isArray(d.tradeHistorie)) return null
    const stand: JournalStand = {
      tradeHistorie: d.tradeHistorie as Trade[],
      rueckblicke: Array.isArray(d.rueckblicke) ? (d.rueckblicke as GespeicherterRueckblick[]) : [],
    }
    return stand as SyncStand[T]
  }
  const stand = {
    abgeschlosseneLektionen: objekt(d.abgeschlosseneLektionen),
    szenarioErgebnisse: objekt(d.szenarioErgebnisse),
    wiederholungen: objekt(d.wiederholungen),
  } as FortschrittStand
  return stand as SyncStand[T]
}

/** Führt zwei Stände eines Teils zusammen — dieselben Regeln wie beim Datei-Import. */
export function teilZusammenfuehren<T extends SyncTeil>(teil: T, a: SyncStand[T], b: SyncStand[T]): SyncStand[T] {
  if (teil === 'journal') {
    const x = a as JournalStand
    const y = b as JournalStand
    const stand: JournalStand = {
      tradeHistorie: mergeTrades(x.tradeHistorie, y.tradeHistorie),
      rueckblicke: mergeRueckblicke(x.rueckblicke, y.rueckblicke),
    }
    return stand as SyncStand[T]
  }
  const x = a as FortschrittStand
  const y = b as FortschrittStand
  const stand: FortschrittStand = {
    abgeschlosseneLektionen: mergeLektionen(x.abgeschlosseneLektionen, y.abgeschlosseneLektionen),
    szenarioErgebnisse: mergeSzenarien(x.szenarioErgebnisse, y.szenarioErgebnisse),
    wiederholungen: mergeWiederholungen(x.wiederholungen, y.wiederholungen),
  }
  return stand as SyncStand[T]
}

/** Kurzbeschreibung für Commit-Nachricht und Rückmeldung. */
export function teilUmfang<T extends SyncTeil>(teil: T, stand: SyncStand[T]): string {
  if (teil === 'journal') {
    const n = (stand as JournalStand).tradeHistorie.length
    return `${n} Trade${n === 1 ? '' : 's'}`
  }
  const n = Object.keys((stand as FortschrittStand).abgeschlosseneLektionen).length
  return `${n} Lektion${n === 1 ? '' : 'en'}`
}
