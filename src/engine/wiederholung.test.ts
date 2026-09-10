import { describe, it, expect } from 'vitest'
import { neuerEintrag, nachWiederholung, faellige, INTERVALLE_TAGE, schluessel } from './wiederholung'

const TAG = 24 * 3600 * 1000

describe('Spaced Repetition', () => {
  it('neuer Eintrag ist morgen fällig', () => {
    const e = neuerEintrag('l1-01', 2, 0)
    expect(e.faelligAm).toBe(1 * TAG)
    expect(e.stufe).toBe(0)
  })

  it('richtige Wiederholung hebt die Stufe und verlängert das Intervall', () => {
    let e = neuerEintrag('l1-01', 2, 0)
    e = nachWiederholung(e, true, TAG)!
    expect(e.stufe).toBe(1)
    expect(e.faelligAm).toBe(TAG + INTERVALLE_TAGE[1] * TAG)
  })

  it('falsche Wiederholung setzt auf Stufe 0 zurück', () => {
    let e = neuerEintrag('l1-01', 2, 0)
    e = nachWiederholung(e, true, 0)!
    e = nachWiederholung(e, true, 0)!
    e = nachWiederholung(e, false, 100)!
    expect(e.stufe).toBe(0)
    expect(e.fehlversuche).toBe(2)
    expect(e.faelligAm).toBe(100 + TAG)
  })

  it('nach der letzten Stufe gilt die Frage als gelernt', () => {
    let e: ReturnType<typeof neuerEintrag> | null = neuerEintrag('l1-01', 2, 0)
    for (let i = 0; i < INTERVALLE_TAGE.length; i++) e = nachWiederholung(e!, true, 0)
    expect(e).toBeNull()
  })

  it('fällige Einträge werden nach Fälligkeit sortiert', () => {
    const a = { ...neuerEintrag('a', 0, 0), faelligAm: 500 }
    const b = { ...neuerEintrag('b', 0, 0), faelligAm: 100 }
    const c = { ...neuerEintrag('c', 0, 0), faelligAm: 9999 }
    const f = faellige({ [schluessel('a', 0)]: a, [schluessel('b', 0)]: b, [schluessel('c', 0)]: c }, 1000)
    expect(f.map((e) => e.lektionId)).toEqual(['b', 'a'])
  })
})
