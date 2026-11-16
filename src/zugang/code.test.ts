import { describe, it, expect } from 'vitest'
import { CODE_REGEX, codeAusZufall, codeMaskieren, codeNormalisieren } from './code'

describe('Einladungscode', () => {
  it('erzeugt ein gültiges Format aus Zufallsbytes', () => {
    const bytes = new Uint8Array(12).map((_, i) => (i * 37 + 5) % 256)
    const code = codeAusZufall(bytes)
    expect(code).toMatch(CODE_REGEX)
    expect(codeAusZufall(bytes)).toBe(code)
  })
  it('wirft bei zu wenigen Bytes', () => {
    expect(() => codeAusZufall(new Uint8Array(4))).toThrow()
  })
  it('normalisiert Kleinschreibung, Leerzeichen und fehlende Striche', () => {
    expect(codeNormalisieren('ca-abcd-efgh-jk23')).toBe('CA-ABCD-EFGH-JK23')
    expect(codeNormalisieren(' ABCDEFGH JK23 ')).toBe('CA-ABCD-EFGH-JK23')
    expect(codeNormalisieren('caabcdefghjk23')).toBe('CA-ABCD-EFGH-JK23')
  })
  it('lehnt falsche Länge und verwechselbare Zeichen ab', () => {
    expect(codeNormalisieren('CA-ABCD-EFGH')).toBeNull()
    expect(codeNormalisieren('CA-ABCD-EFGH-JK10')).toBeNull()
    expect(codeNormalisieren('')).toBeNull()
  })
  it('maskiert bis auf die letzte Gruppe', () => {
    expect(codeMaskieren('ca-abcd-efgh-jk23')).toBe('CA-••••-••••-JK23')
    expect(codeMaskieren('kaputt')).toBe('••••')
  })
})
