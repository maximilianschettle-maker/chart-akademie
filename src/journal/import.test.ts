import { describe, expect, it } from 'vitest'
import { abschlussAus, ausstiegGrundAus, entwurfAus, findeVorhanden, marktAusInstrument, risikoAus, vorschlaege } from './import'
import type { ErkanntePosition } from './positionTypes'
import { neuerEintrag, unixAusOrtszeit } from './engine'

// Werte aus dem echten eToro-Screenshot vom 04.11.2026 (Positionsinfo NSDQ100)
const POSITION: ErkanntePosition = {
  brokerId: '3626300872',
  instrument: 'NSDQ100',
  richtung: 'kaufen',
  hebel: 20,
  kontrakte: 0.308699,
  positionsgroesse: 8793.88,
  einsatz: 439.86,
  eroeffnungskurs: 28497.7,
  eroeffnungsdatum: '2026-11-04T17:02',
  stopLoss: 27900,
  takeProfit: 29934.87,
  gewinnVerlust: -3.34,
  uebernachtgebuehren: 0,
  status: 'offen',
  schlusskurs: null,
  schlussdatum: null,
  broker: 'eToro',
  demo: false,
}

describe('Screenshot-Import: Abbildung', () => {
  it('eToro-Kürzel auf den Katalog', () => {
    expect(marktAusInstrument('NSDQ100')?.symbol).toBe('^NDX')
    expect(marktAusInstrument('Gold')?.id).toBe('gold')
    expect(marktAusInstrument('OIL')?.id).toBe('oel')
    expect(marktAusInstrument('BTC')?.symbol).toBe('BTC-USD')
    expect(marktAusInstrument('^NDX')?.id).toBe('nasdaq100')
    expect(marktAusInstrument('Nasdaq 100')?.id).toBe('nasdaq100')
    expect(marktAusInstrument('XYZ123')).toBeNull()
    expect(marktAusInstrument('SOLUSDT')).toMatchObject({ name: 'SOL', symbol: 'SOL-USD' })
    expect(marktAusInstrument('BTCUSDT')?.symbol).toBe('BTC-USD')
  })

  it('Risiko = Kontrakte × Stop-Abstand, Risiko-% aus dem Konto', () => {
    expect(risikoAus(POSITION)).toBe(184.51)
    expect(risikoAus({ ...POSITION, stopLoss: null })).toBeNull()
    const e = entwurfAus(POSITION, 10_000)
    expect(e).toMatchObject({ markt: 'Nasdaq 100', symbol: '^NDX', richtung: 'long', entryPreis: 28497.7, stopLoss: 27900, takeProfit: 29934.87, hebel: 20, brokerId: '3626300872', kontrakte: 0.308699, einsatz: 439.86, risikoBetrag: 184.51, risikoProzent: 1.8 })
    expect(e.entryTime).toBe(unixAusOrtszeit('2026-11-04T17:02'))
    expect(entwurfAus({ ...POSITION, richtung: 'verkaufen' }, 0).richtung).toBe('short')
    expect(entwurfAus({ ...POSITION, instrument: 'XYZ' }, 0).symbol).toBe('')
  })

  it('Ausstiegsgrund und Abschluss aus einer geschlossenen Position', () => {
    const zu: ErkanntePosition = { ...POSITION, status: 'geschlossen', schlusskurs: 29934.9, schlussdatum: '2026-11-05T09:30', gewinnVerlust: 443.2, uebernachtgebuehren: -1.2 }
    expect(ausstiegGrundAus(zu)).toBe('ziel')
    expect(ausstiegGrundAus({ ...zu, schlusskurs: 27899 })).toBe('stop')
    expect(ausstiegGrundAus({ ...zu, schlusskurs: 28800 })).toBe('manuell')
    const a = abschlussAus(zu)
    expect(a).toMatchObject({ status: 'geschlossen', exitPreis: 29934.9, exitGrund: 'ziel', ergebnisBetrag: 443.2, gebuehren: 1.2 })
    expect(a.exitTime).toBe(unixAusOrtszeit('2026-11-05T09:30'))
  })
})

describe('Screenshot-Import: Vorschläge', () => {
  const basis = entwurfAus(POSITION, 10_000)
  const offen = neuerEintrag({ ...basis, strategieId: 'breakout-retest', zeitrahmen: '15m' } as Parameters<typeof neuerEintrag>[0], 1)

  it('findet per Positions-ID, sonst über Symbol, Richtung, Einstieg und Zeit', () => {
    expect(findeVorhanden([offen], POSITION)?.id).toBe(offen.id)
    const ohneId = { ...offen, brokerId: undefined }
    expect(findeVorhanden([ohneId], { ...POSITION, brokerId: null })?.id).toBe(offen.id)
    expect(findeVorhanden([ohneId], { ...POSITION, brokerId: null, eroeffnungskurs: 28600 })).toBeNull()
    expect(findeVorhanden([ohneId], { ...POSITION, brokerId: null, eroeffnungsdatum: '2026-11-04T18:30' })).toBeNull()
  })

  it('neu, unverändert, aktualisieren, schließen', () => {
    expect(vorschlaege([POSITION], [], 10_000)[0].aktion).toBe('neu')
    expect(vorschlaege([POSITION], [offen], 10_000)[0].aktion).toBe('unveraendert')
    const v = vorschlaege([{ ...POSITION, stopLoss: 28100 }], [offen], 10_000)[0]
    expect(v.aktion).toBe('aktualisieren')
    expect(v.aenderung).toEqual({ stopLoss: 28100 })
    const zu = vorschlaege([{ ...POSITION, status: 'geschlossen', schlusskurs: 27900, schlussdatum: '2026-11-04T20:00', gewinnVerlust: -186 }], [offen], 10_000)[0]
    expect(zu.aktion).toBe('schliessen')
    expect(zu.aenderung).toMatchObject({ status: 'geschlossen', exitPreis: 27900, exitGrund: 'stop', ergebnisBetrag: -186 })
    // geschlossene Position ohne Eintrag → neuer, bereits geschlossener Eintrag
    const direkt = vorschlaege([{ ...POSITION, status: 'geschlossen', schlusskurs: 29000 }], [], 10_000)[0]
    expect(direkt.aktion).toBe('neu')
    expect(direkt.entwurf).toMatchObject({ status: 'geschlossen', exitPreis: 29000 })
  })

  it('meldet Probleme statt zu raten', () => {
    const v = vorschlaege([{ ...POSITION, instrument: 'XYZ', stopLoss: null, richtung: null }], [], 10_000)[0]
    expect(v.probleme).toHaveLength(3)
    expect(v.entwurf.richtung).toBe('long')
  })
})
