/// <reference types="node" />
import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { alleLektionenLaden } from '../src/content/lektionen'

// Generiert src/content/lektionen/meta.ts aus den Lektionsdateien.
// Aufruf: npm run gen:meta  (läuft als vitest-Datei, weil die Lektionen TypeScript-Module sind)

it('generiert meta.ts', async () => {
  const alle = await alleLektionenLaden()
  alle.sort((a, b) => a.id.localeCompare(b.id))
  const zeilen = alle.map(
    (l) =>
      `  { id: '${l.id}', level: ${l.level}, titel: ${JSON.stringify(l.titel)}, untertitel: ${JSON.stringify(l.untertitel)}, dauerMin: ${l.dauerMin} },`,
  )
  writeFileSync(
    'src/content/lektionen/meta.ts',
    `import type { LessonMeta } from '../../types'\n\n// GENERIERT aus den Lektionsdateien (npm run gen:meta) — nicht von Hand pflegen.\n// Diese kleine Tabelle landet im Start-Bundle; die Lektionstexte werden lazy geladen.\n\nexport const LEKTION_META: LessonMeta[] = [\n${zeilen.join('\n')}\n]\n`,
  )
})
