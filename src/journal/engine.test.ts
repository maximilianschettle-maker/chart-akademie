import { describe, expect, it } from 'vitest'
import {
  alsTrade,
  bereichFuerZeitrahmen,
  eintraegeAlsCsv,
  ergebnis,
  filtern,
  geplantesCrv,
  kerzenUmEinstieg,
  marktListe,
  mergeEintraege,
  neuerEintrag,
  planAbweichung,
  pruefeEintrag,
  rMultiple,
  setupName,
  tageslimitHinweis,
  tagVon,
  trefferZeit,
  verlusteJeTag,
  type EintragEntwurf,
} from './engine'
import type { JournalEintrag } from './types'
import { logischeTrades } from '../engine/auswertung'

const ENTWURF: EintragEntwurf = {
  markt: 'Nasdaq 100',
  symbol: '^NDX',
  waehrung: 'USD',
  richtung: 'long',
  entryTime: 1_762_250_400, // 2025-11-04 11:00 UTC
  entryPreis: 21_400,
  stopLoss: 21_350,
  takeProfit: 21_500,
  risikoProzent: 1,
  risikoBetrag: 100,
  strategieId: 'breakout-retest',
  zeitrahmen: '15m',
  imPlan: true,
}

function geschlossen(teil: Partial<JournalEintrag> = {}): JournalEintrag {
  return { ...neuerEintrag(ENTWURF, 1_000), status: 'geschlossen', exitPreis: 21_500, exitTime: ENTWURF.entryTime + 3600, exitGrund: 'ziel', ...teil }
}

describe('Journal: Anlegen und Prüfen', () => {
  it('neuer Eintrag ist offen und hat eine Id', () => {
    const e = neuerEintrag(ENTWURF, 5_000)
    expect(e.status).toBe('offen')
    expect(e.id).toMatch(/^j-/)
    expect(e.erstelltAm).toBe(5_000)
  })

  it('Prüfung findet fehlende und widersprüchliche Werte', () => {
    expect(pruefeEintrag(ENTWURF)).toEqual([])
    expect(pruefeEintrag({ ...ENTWURF, stopLoss: 21_450 })).toContain('Long: der Stop muss unter dem Einstieg liegen.')
    expect(pruefeEintrag({ ...ENTWURF, richtung: 'short', stopLoss: 21_350 })).toContain('Short: der Stop muss über dem Einstieg liegen.')
    expect(pruefeEintrag({ ...ENTWURF, takeProfit: 21_300 })).toContain('Long: das Ziel muss über dem Einstieg liegen.')
    expect(pruefeEintrag({ ...ENTWURF, markt: '' })).toContain('Markt fehlt.')
    expect(pruefeEintrag({ ...ENTWURF, takeProfit: 0 })).toEqual([])
  })

  it('Marktliste: eToro-Favoriten zuerst, mit Yahoo-Symbol', () => {
    const m = marktListe()
    expect(m.slice(0, 4).map((x) => x.id)).toEqual(['nasdaq100', 'gold', 'oel', 'bitcoin'])
    expect(m[0].symbol).toBe('^NDX')
  })

  it('Setup-Name: Strategie oder Freitext', () => {
    expect(setupName({ strategieId: 'breakout-retest' })).toBe('Breakout + Retest')
    expect(setupName({ strategieId: 'sonstiges', setupFrei: 'News-Spike' })).toBe('News-Spike')
    expect(setupName({ strategieId: 'sonstiges' })).toBe('Sonstiges')
  })
})

describe('Journal: R und Ergebnis', () => {
  it('R-Multiple aus Preisen, long und short', () => {
    expect(geplantesCrv(ENTWURF)).toBe(2)
    expect(rMultiple({ ...ENTWURF, exitPreis: 21_500 })).toBe(2)
    expect(rMultiple({ ...ENTWURF, exitPreis: 21_350 })).toBe(-1)
    expect(rMultiple({ richtung: 'short', entryPreis: 100, stopLoss: 102, exitPreis: 96 })).toBe(2)
    expect(rMultiple({ ...ENTWURF })).toBeNull()
  })

  it('ohne Stop kein R und kein Trade für die R-Statistik, Ergebnis vom Broker bleibt', () => {
    const ohneStop = geschlossen({ stopLoss: 0, ergebnisBetrag: -68.37, exitPreis: 21_300 })
    expect(rMultiple(ohneStop)).toBeNull()
    expect(alsTrade(ohneStop)).toBeNull()
    expect(ergebnis(ohneStop)).toBe(-68.37)
  })

  it('Ergebnis: Broker-Angabe vor Rechnung, Rechnung aus R × Risikobetrag minus Gebühren', () => {
    expect(ergebnis(geschlossen({ ergebnisBetrag: 187.5 }))).toBe(187.5)
    expect(ergebnis(geschlossen({ gebuehren: 3 }))).toBe(197)
    expect(ergebnis(geschlossen({ risikoBetrag: undefined }))).toBeNull()
  })

  it('Abbildung auf Trade läuft durch die bestehende Auswertung', () => {
    const t = alsTrade(geschlossen({ ergebnisBetrag: 180 }))
    expect(t).not.toBeNull()
    expect(t!.rMultiple).toBe(2)
    expect(t!.pnl).toBe(180)
    expect(t!.exitGrund).toBe('tp')
    expect(t!.strategieId).toBe('breakout-retest')
    expect(alsTrade(neuerEintrag(ENTWURF))).toBeNull()
    const logisch = logischeTrades([t!])
    expect(logisch).toHaveLength(1)
    expect(logisch[0].geplantesCrv).toBe(2)
  })
})

describe('Journal: Zusammenführen, Tageslimit, Plan', () => {
  it('Merge per Id, neuerer Änderungsstand gewinnt, sortiert nach Einstieg', () => {
    const a = geschlossen({ id: 'x', geaendertAm: 10, lehre: 'alt' })
    const b = { ...a, geaendertAm: 20, lehre: 'neu' }
    const c = neuerEintrag({ ...ENTWURF, entryTime: ENTWURF.entryTime - 1 }, 1)
    const m = mergeEintraege([a, c], [b])
    expect(m.map((e) => e.id)).toEqual([c.id, 'x'])
    expect(m[1].lehre).toBe('neu')
    expect(mergeEintraege([b], [a])[0].lehre).toBe('neu')
  })

  it('Tageslimit ab zwei Verlusttrades am selben Berliner Tag', () => {
    const tag = tagVon(ENTWURF.entryTime + 3600)
    const verlust = () => geschlossen({ id: `v${Math.random()}`, exitPreis: 21_350, exitGrund: 'stop' })
    expect(tageslimitHinweis([verlust()], tag)).toBeNull()
    expect(tageslimitHinweis([verlust(), verlust(), geschlossen({ id: 'g' })], tag)).toMatch(/2 Verlusttrades/)
    expect(verlusteJeTag([verlust(), neuerEintrag(ENTWURF)]).get(tag)).toBe(1)
  })

  it('Plan-Abweichung zählt nur geschlossene, beantwortete Trades', () => {
    const p = planAbweichung([
      geschlossen({ id: 'a', imPlan: true }),
      geschlossen({ id: 'b', imPlan: false, exitPreis: 21_350 }),
      geschlossen({ id: 'c', imPlan: null }),
      neuerEintrag(ENTWURF),
    ])
    expect(p).toEqual({ gesamt: 2, ausserhalb: 1, summeRAusserhalb: -1, summeRImPlan: 2 })
  })

  it('Filter nach Markt, Setup, Zeitraum und Status', () => {
    const liste = [geschlossen({ id: 'a' }), neuerEintrag({ ...ENTWURF, markt: 'Gold', strategieId: 'sr-bounce', entryTime: 100 })]
    expect(filtern(liste, { markt: 'Gold' })).toHaveLength(1)
    expect(filtern(liste, { strategieId: 'breakout-retest' })).toHaveLength(1)
    expect(filtern(liste, { von: 1000 })).toHaveLength(1)
    expect(filtern(liste, { status: 'offen' })[0].markt).toBe('Gold')
  })
})

describe('Journal: CSV und Snapshot', () => {
  it('CSV: Kopfzeile, Semikolon, Anführungszeichen bei Sonderzeichen, Dezimalkomma', () => {
    const csv = eintraegeAlsCsv([geschlossen({ begruendung: 'Retest; "sauber"', ergebnisBetrag: 187.5 })])
    const zeilen = csv.replace('﻿', '').trim().split('\r\n')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0].startsWith('Einstieg am;Markt;Richtung;Setup')).toBe(true)
    expect(zeilen[1]).toContain('"Retest; ""sauber"""')
    expect(zeilen[1]).toContain(';187,5;')
    expect(zeilen[1]).toContain(';Long;Breakout + Retest;15m;21400;21350;21500;')
  })

  it('Bereich je Zeitrahmen und Ausschnitt um den Einstieg', () => {
    expect(bereichFuerZeitrahmen('5m')).toBe('1T')
    expect(bereichFuerZeitrahmen('15m')).toBe('5T')
    expect(bereichFuerZeitrahmen('1d')).toBe('6M')
    const kerzen = Array.from({ length: 500 }, (_, i) => ({ time: 1000 + i * 60, open: 1, high: 1, low: 1, close: 1, volume: 0 }))
    const aus = kerzenUmEinstieg(kerzen, 1000 + 300 * 60 + 30, 10, 5)
    expect(aus).not.toBeNull()
    expect(aus!).toHaveLength(16)
    expect(aus![10].time).toBe(1000 + 300 * 60)
    expect(kerzenUmEinstieg(kerzen, 500)).toBeNull()
    expect(kerzenUmEinstieg(kerzen, 1_000_000, 10, 5)!.length).toBe(11)
  })

  it('Trefferzeit: erste Kerze nach dem Einstieg, die Stop oder Ziel berührt', () => {
    const k = (time: number, low: number, high: number) => ({ time, open: low, high, low, close: high, volume: 0 })
    const kerzen = [k(100, 95, 105), k(200, 96, 104), k(300, 89, 103), k(400, 90, 112), k(500, 91, 99)]
    expect(trefferZeit(kerzen, 150, 'long', 90, 'stop')).toBe(300)
    expect(trefferZeit(kerzen, 150, 'long', 110, 'ziel')).toBe(400)
    expect(trefferZeit(kerzen, 150, 'short', 110, 'stop')).toBe(400)
    expect(trefferZeit(kerzen, 150, 'short', 90, 'ziel')).toBe(300)
    expect(trefferZeit(kerzen, 450, 'long', 90, 'stop')).toBeNull()
    expect(trefferZeit(kerzen, 150, 'long', 0, 'stop')).toBeNull()
  })
})
