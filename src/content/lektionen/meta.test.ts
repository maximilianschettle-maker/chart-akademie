import { describe, it, expect } from 'vitest'
import { LEKTION_META, alleLektionenLaden } from './index'
import { CURRICULUM } from '../curriculum'

// Schutz gegen veraltete Meta-Tabelle: meta.ts wird generiert (npm run gen:meta)
// und muss zu den Lektionsdateien und zum Curriculum passen.

describe('Lektions-Meta', () => {
  it('meta.ts ist aktuell (sonst: npm run gen:meta)', async () => {
    const alle = await alleLektionenLaden()
    const erwartet = alle
      .map(({ id, level, titel, untertitel, dauerMin }) => ({ id, level, titel, untertitel, dauerMin }))
      .sort((a, b) => a.id.localeCompare(b.id))
    const ist = [...LEKTION_META].sort((a, b) => a.id.localeCompare(b.id))
    expect(ist).toEqual(erwartet)
  })

  it('jede Curriculum-Id hat eine Lektion und jede Lektion steht im Curriculum', async () => {
    const imCurriculum = CURRICULUM.flatMap((l) => l.lektionIds)
    const ids = (await alleLektionenLaden()).map((l) => l.id)
    expect([...imCurriculum].sort()).toEqual([...ids].sort())
  })
})
