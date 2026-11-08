import { describe, expect, it } from 'vitest'
import { CHECKLISTE, checklisteFakten, imPlanAus, verletzt } from './checkliste'

describe('Checkliste vor dem Trade', () => {
  const alleJa = Object.fromEntries(CHECKLISTE.map((p) => [p.id, true]))

  it('alle Ja = im Plan, ein Nein = außerhalb, unvollständig = offen', () => {
    expect(imPlanAus(alleJa)).toBe(true)
    expect(imPlanAus({ ...alleJa, zone: false })).toBe(false)
    expect(imPlanAus({ richtung: true })).toBeNull()
    expect(imPlanAus(undefined)).toBeNull()
    // ein Nein schlägt Unvollständigkeit
    expect(imPlanAus({ ruhe: false })).toBe(false)
  })

  it('verletzte Punkte und Fakten für die KI', () => {
    expect(verletzt({ ...alleJa, bestaetigung: false, risiko: false }).map((p) => p.id)).toEqual(['bestaetigung', 'risiko'])
    expect(verletzt(undefined)).toEqual([])
    const f = checklisteFakten({ richtung: true, zone: false })
    expect(f).toHaveLength(5)
    expect(f[0]).toEqual({ text: CHECKLISTE[0].text, ok: true })
    expect(f[1].ok).toBe(false)
    expect(f[2].ok).toBeNull()
  })
})
