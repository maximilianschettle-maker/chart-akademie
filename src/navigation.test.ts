import { describe, expect, it } from 'vitest'
import { ANALYSE_TABS, HAUPTBEREICHE, TRAINING_TABS, hauptbereichVon, neuerPfad } from './navigation'

describe('navigation', () => {
  it('ordnet Pfade den Hauptbereichen zu', () => {
    expect(hauptbereichVon('/')).toBe('start')
    expect(hauptbereichVon('/training')).toBe('training')
    expect(hauptbereichVon('/training/journal')).toBe('training')
    expect(hauptbereichVon('/lektion/l1-01')).toBe('training')
    expect(hauptbereichVon('/uebung/zufall')).toBe('training')
    expect(hauptbereichVon('/wiederholung')).toBe('training')
    expect(hauptbereichVon('/analyse/aktien/SAP.DE')).toBe('analyse')
    expect(hauptbereichVon('/irgendwas')).toBe('start')
  })

  it('leitet alte Pfade samt Unterpfaden weiter', () => {
    expect(neuerPfad('/simulator')).toBe('/training/simulator')
    expect(neuerPfad('/journal')).toBe('/training/journal')
    expect(neuerPfad('/aktien')).toBe('/analyse/aktien')
    expect(neuerPfad('/aktien/vergleich')).toBe('/analyse/aktien/vergleich')
    expect(neuerPfad('/aktien/SAP.DE')).toBe('/analyse/aktien/SAP.DE')
    expect(neuerPfad('/makro')).toBe('/analyse/makro')
    expect(neuerPfad('/tracker')).toBe('/analyse/tracker')
    expect(neuerPfad('/training')).toBeNull()
    expect(neuerPfad('/aktienkurs')).toBeNull()
  })

  it('hat drei Hauptbereiche und Unter-Tabs, die zu ihrem Bereich gehören', () => {
    expect(HAUPTBEREICHE.map((b) => b.id)).toEqual(['start', 'training', 'analyse'])
    for (const t of TRAINING_TABS) expect(hauptbereichVon(t.pfad)).toBe('training')
    for (const t of ANALYSE_TABS) expect(hauptbereichVon(t.pfad)).toBe('analyse')
    expect(ANALYSE_TABS.map((t) => t.text)).toContain('Makro & News')
  })
})
