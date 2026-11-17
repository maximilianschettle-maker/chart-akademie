import { describe, expect, it } from 'vitest'
import { annaeherungBegrenzt, neueZone, normalisiereZonen, typAusLage, zoneGeaendert, zonenBreiteProzent, zonenTitel } from './engine'

describe('zonen/engine', () => {
  it('leitet den Typ aus der Lage zum Kurs ab', () => {
    expect(typAusLage(90, 95, 100)).toBe('support')
    expect(typAusLage(105, 110, 100)).toBe('resistance')
    // Kurs in der Zone: nähere Kante entscheidet
    expect(typAusLage(98, 108, 100)).toBe('resistance')
    expect(typAusLage(92, 101, 100)).toBe('support')
  })

  it('legt eine Zone mit geordneten Kanten an, Alarm an und sichtbar', () => {
    const z = neueZone('gold', '1h', 4200, 4180, 4250, 1000, 'a')
    expect(z).toMatchObject({ id: 'a', markt: 'gold', zeiteinheit: '1h', typ: 'support', von: 4180, bis: 4200, alarm: true, sichtbar: true })
  })

  it('ändert Kanten nur, wenn ein gültiges Band herauskommt', () => {
    const z = neueZone('gold', '1h', 4180, 4200, 4250, 1000, 'a')
    expect(zoneGeaendert(z, { von: 4210 }, 2000)).toMatchObject({ von: 4200, bis: 4210, geaendertAm: 2000 })
    expect(zoneGeaendert(z, { von: 4200 }, 2000)).toBe(z)
    expect(zoneGeaendert(z, { bis: -1 }, 2000)).toBe(z)
    expect(zoneGeaendert(z, { notiz: 'x'.repeat(500) }, 2000).notiz).toHaveLength(300)
  })

  it('rechnet die Breite in Prozent der Mitte', () => {
    expect(zonenBreiteProzent({ von: 99, bis: 101 })).toBeCloseTo(2)
  })

  it('beschriftet stumme Zonen', () => {
    const z = neueZone('nasdaq', '4h', 100, 110, 90, 1, 'a')
    expect(zonenTitel(z)).toBe('R · 4 h')
    expect(zonenTitel({ ...z, alarm: false })).toBe('R · 4 h · stumm')
  })

  it('bereinigt gespeicherte Stände', () => {
    const gut = neueZone('oel', '1d', 60, 61, 65, 5, 'ok')
    const s = normalisiereZonen({
      zonen: [gut, { ...gut }, { ...gut, id: 'x', markt: 'dax' }, { ...gut, id: 'y', von: 5, bis: 5 }, { ...gut, id: 'z', von: 62, bis: 60, alarm: false }, null],
      annaeherungProzent: 99,
      aktualisiertAm: 7,
    })
    expect(s.zonen.map((z) => z.id)).toEqual(['ok', 'z'])
    expect(s.zonen[1]).toMatchObject({ von: 60, bis: 62, alarm: false })
    expect(s.annaeherungProzent).toBe(3)
    expect(s.aktualisiertAm).toBe(7)
    expect(normalisiereZonen(null)).toEqual({ zonen: [], annaeherungProzent: 0.3, aktualisiertAm: 0 })
  })

  it('begrenzt den Annäherungsabstand', () => {
    expect(annaeherungBegrenzt(0.3)).toBe(0.3)
    expect(annaeherungBegrenzt(0)).toBe(0.05)
    expect(annaeherungBegrenzt('x')).toBe(0.3)
  })
})
