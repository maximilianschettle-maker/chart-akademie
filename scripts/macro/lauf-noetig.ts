// Frühausstieg für das 10-Minuten-Raster der Action: Nur laufen, wenn ein Entscheidungstermin
// nah ist (Vortag-Push bis drei Stunden nach der Entscheidung). Der tägliche Lauf und
// workflow_dispatch laufen immer. Schreibt `noetig=true|false` nach $GITHUB_OUTPUT.
// Env: ANLASS (Cron-Ausdruck aus github.event.schedule oder Event-Name), RASTER_CRON.

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MakroDaten } from '../../src/makro/types.ts'
import { FENSTER } from './push-logik.ts'

const WURZEL = fileURLToPath(new URL('../../', import.meta.url))
const MAKRO = join(WURZEL, 'public', 'data', 'macro.json')
const NACHLAUF_MS = 3 * 3600_000

function ausgabe(noetig: boolean, grund: string) {
  console.log(`noetig=${noetig} (${grund})`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `noetig=${noetig}\n`)
}

const anlass = process.env.ANLASS?.trim() ?? ''
const raster = process.env.RASTER_CRON?.trim() ?? ''

if (!raster || anlass !== raster) {
  ausgabe(true, `Anlass „${anlass || 'unbekannt'}“ ist nicht das Raster`)
} else if (!existsSync(MAKRO)) {
  ausgabe(true, 'macro.json fehlt noch')
} else {
  const daten = JSON.parse(readFileSync(MAKRO, 'utf8')) as MakroDaten
  const jetzt = Date.now()
  const nah = [...daten.fed.termine, ...daten.ezb.termine].find((t) => {
    const T = Date.parse(t.entscheidungUtc)
    return Number.isFinite(T) && jetzt >= T - FENSTER.vortagVon - 3600_000 && jetzt <= T + NACHLAUF_MS
  })
  ausgabe(Boolean(nah), nah ? `Termin ${nah.datum} ist nah` : 'kein Termin in der Nähe')
}
