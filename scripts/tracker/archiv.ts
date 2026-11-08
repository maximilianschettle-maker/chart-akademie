import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Candle } from '../../src/types'
import { kerzenKompakt } from '../../src/tracker/engine/analyse'

// Kerzen-Archiv für die Nicht-Krypto-Instrumente (Nasdaq, Gold, Öl …): Yahoo liefert 15-Minuten-Kerzen
// nur 60 Tage und Stundenkerzen 730 Tage zurück. Jeder Tracker-Lauf hängt die neuen Kerzen an eine
// Datei je Instrument und Ebene an (public/data/archiv/<id>-15m.json, <id>-1h.json), so wächst mit
// der Zeit eine Historie, aus der die Top-Down-Übung Replays auf 15 Minuten ziehen kann.
// Format wie im Tracker: [time, open, high, low, close, volume], aufsteigend, ohne Dubletten.

export type ArchivEbene = '15m' | '1h'

/** Obergrenze je Datei: 15m ≈ 6.800 Kerzen/Jahr bei Indizes, 1h ≈ 1.700 – reicht für mehrere Jahre, hält die Datei unter ~2 MB */
export const ARCHIV_MAX: Record<ArchivEbene, number> = { '15m': 60_000, '1h': 40_000 }

export function archivPfad(wurzel: string, id: string, ebene: ArchivEbene): string {
  return join(wurzel, 'public', 'data', 'archiv', `${id}-${ebene}.json`)
}

/** Zusammenführen: gleiche Zeit → neue Kerze gewinnt (die letzte Kerze eines Laufs war offen) */
export function mergeKompakt(alt: number[][], neu: number[][], max: number): number[][] {
  const nachZeit = new Map<number, number[]>()
  for (const k of alt) nachZeit.set(k[0], k)
  for (const k of neu) nachZeit.set(k[0], k)
  const liste = [...nachZeit.values()].sort((a, b) => a[0] - b[0])
  return liste.length > max ? liste.slice(-max) : liste
}

export interface ArchivErgebnis {
  geschrieben: boolean
  anzahl: number
  neue: number
}

/**
 * Neue Kerzen ins Archiv mischen. `nurBeiNeuemTag`: nur schreiben, wenn der letzte Tag im Archiv
 * ein anderer ist (Stundenkerzen ändern sich jeden Lauf nur in der offenen Kerze – ein Commit je Lauf
 * wäre reine Dateigröße).
 */
export function archivAktualisieren(wurzel: string, id: string, ebene: ArchivEbene, kerzen: Candle[], nurBeiNeuemTag = false): ArchivErgebnis {
  const pfad = archivPfad(wurzel, id, ebene)
  let alt: number[][] = []
  if (existsSync(pfad)) {
    try {
      const roh: unknown = JSON.parse(readFileSync(pfad, 'utf8'))
      if (Array.isArray(roh)) alt = roh as number[][]
    } catch {
      alt = []
    }
  }
  // die offene letzte Kerze nicht archivieren – sie ändert sich noch
  const fertig = kerzen.slice(0, -1)
  const neu = kerzenKompakt(fertig)
  const zusammen = mergeKompakt(alt, neu, ARCHIV_MAX[ebene])
  const altZeiten = new Set(alt.map((k) => k[0]))
  const neue = zusammen.filter((k) => !altZeiten.has(k[0])).length
  if (neue === 0) return { geschrieben: false, anzahl: zusammen.length, neue: 0 }
  if (nurBeiNeuemTag && alt.length > 0) {
    const tagAlt = Math.floor(alt[alt.length - 1][0] / 86_400)
    const tagNeu = Math.floor(zusammen[zusammen.length - 1][0] / 86_400)
    if (tagAlt === tagNeu) return { geschrieben: false, anzahl: zusammen.length, neue }
  }
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, JSON.stringify(zusammen) + '\n')
  return { geschrieben: true, anzahl: zusammen.length, neue }
}
