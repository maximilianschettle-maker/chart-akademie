import { describe, expect, it } from 'vitest'
import type { MakroDaten } from '../../src/makro/types.ts'
import { fedBruch, parseFedStatement, parseFredCsv, parseRss, verdichteFed } from './fed.ts'
import { parseFomcKalender, parseFomcZeile } from './fomc.ts'
import { parseEzbEntscheidung, parseEzbKalender, parseEzbZinsen } from './ezb.ts'
import { erzeugeIcs } from './ics.ts'
import { faelligePushes, faelligeTrackerPushes } from './push-logik.ts'
import { datumInZone, ortszeitZuUtc, zonenOffsetMin } from './zeit.ts'

describe('zeit', () => {
  it('rechnet Fed-Ortszeit mit Sommer-/Winterzeit nach UTC', () => {
    expect(ortszeitZuUtc('2026-06-17', '14:00', 'America/New_York').toISOString()).toBe('2026-06-17T18:00:00.000Z')
    expect(ortszeitZuUtc('2026-12-09', '14:00', 'America/New_York').toISOString()).toBe('2026-12-09T19:00:00.000Z')
    // 28.10.2026: Europa schon auf Winterzeit, USA noch Sommerzeit → 19:00 Uhr Berlin
    expect(ortszeitZuUtc('2026-10-28', '14:00', 'America/New_York').toISOString()).toBe('2026-10-28T18:00:00.000Z')
  })
  it('rechnet EZB-Ortszeit nach UTC', () => {
    expect(ortszeitZuUtc('2026-07-23', '14:15', 'Europe/Berlin').toISOString()).toBe('2026-07-23T12:15:00.000Z')
    expect(ortszeitZuUtc('2026-12-17', '14:15', 'Europe/Berlin').toISOString()).toBe('2026-12-17T13:15:00.000Z')
  })
  it('kennt Offsets und Datum in Zone', () => {
    expect(zonenOffsetMin(new Date('2026-07-01T00:00:00Z'), 'Europe/Berlin')).toBe(120)
    expect(zonenOffsetMin(new Date('2026-01-01T00:00:00Z'), 'Europe/Berlin')).toBe(60)
    expect(datumInZone(new Date('2026-10-28T23:30:00Z'), 'Europe/Berlin')).toBe('2026-10-29')
    expect(datumInZone(new Date('2026-10-28T23:30:00Z'), 'America/New_York')).toBe('2026-10-28')
  })
})

describe('fomc', () => {
  it('liest normale, SEP- und Monatswechsel-Zeilen', () => {
    expect(parseFomcZeile('March', '17-18*', 2026)).toMatchObject({ datum: '2026-03-18', beginn: '2026-03-17', sep: true })
    expect(parseFomcZeile('Apr/May', '30-1', 2024)).toMatchObject({ datum: '2024-05-01', beginn: '2024-04-30', sep: false })
    expect(parseFomcZeile('Jan/Feb', '31-1', 2023)).toMatchObject({ datum: '2023-02-01', beginn: '2023-01-31' })
    expect(parseFomcZeile('August', '22 (notation vote)', 2025)).toMatchObject({ datum: '2025-08-22', hinweis: 'notation vote' })
    expect(parseFomcZeile('August', '22 (notation vote)', 2025)?.beginn).toBeUndefined()
    expect(parseFomcZeile('Unbekannt', '1-2', 2026)).toBeNull()
  })
  it('liest Panels samt Statement-Link und sortiert', () => {
    const html = `
      <h4>2026 FOMC Meetings</h4>
      ${[
        ['January', '27-28', '20260128'],
        ['March', '17-18*', '20260318'],
        ['April', '28-29', '20260429'],
        ['June', '16-17*', '20260617'],
        ['July', '28-29', ''],
        ['September', '15-16*', ''],
        ['October', '27-28', ''],
        ['December', '8-9*', ''],
      ]
        .map(
          ([m, d, s]) => `<div class="row fomc-meeting">
            <div class="fomc-meeting__month col"><strong>${m}</strong></div>
            <div class="fomc-meeting__date col">${d}</div>
            ${s ? `<a href="/newsevents/pressreleases/monetary${s}a.htm">HTML</a>` : ''}
          </div>`,
        )
        .join('')}
      <h4>2025 FOMC Meetings</h4>
      <div class="row fomc-meeting"><div class="fomc-meeting__month col"><strong>December</strong></div><div class="fomc-meeting__date col">9-10*</div></div>
    `
    const termine = parseFomcKalender(html, new Date('2026-10-28T00:00:00Z'))
    expect(termine.map((t) => t.datum)).toEqual([
      '2025-12-10',
      '2026-01-28',
      '2026-03-18',
      '2026-04-29',
      '2026-06-17',
      '2026-07-29',
      '2026-09-16',
      '2026-10-28',
      '2026-12-09',
    ])
    expect(termine[1].statementUrl).toBe('https://www.federalreserve.gov/newsevents/pressreleases/monetary20260128a.htm')
    expect(termine[5].statementUrl).toBeUndefined()
    expect(termine[7].entscheidungUtc).toBe('2026-10-28T18:00:00.000Z')
  })
  it('wirft bei zu wenigen Sitzungen (Seitenstruktur geändert)', () => {
    expect(() => parseFomcKalender('<h4>2026 FOMC Meetings</h4><p>nichts</p>', new Date('2026-05-01'))).toThrow()
  })
})

describe('ezb', () => {
  const dt = (d: string, text: string) => `<dt>${d}</dt><dd>${text}<br></dd>`
  it('erkennt Day 2 als Entscheidungstag und Day 1 als Beginn', () => {
    const html = [
      dt('28/10/2026', 'Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 1)'),
      dt('29/10/2026', 'Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 2), followed by press conference'),
      dt('29/10/2026', 'Press conference following the Governing Council meeting of the ECB in Frankfurt'),
      dt('25/11/2026', 'Governing Council of the ECB: non-monetary policy meeting (in Frankfurt)'),
      dt('11/10/2028', 'Governing Council of the ECB: monetary policy meeting in Frankfurt'),
      dt('12/10/2028', 'Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 2), followed by press conference'),
    ].join('\n')
    const t = parseEzbKalender(html)
    expect(t).toEqual([
      { datum: '2026-10-29', beginn: '2026-10-28', entscheidungUtc: '2026-10-29T13:15:00.000Z' },
      { datum: '2028-10-12', beginn: '2028-10-11', entscheidungUtc: '2028-10-12T12:15:00.000Z' },
    ])
  })
  it('wirft ohne Sitzungen', () => {
    expect(() => parseEzbKalender('<dl></dl>')).toThrow()
  })
  it('liest SDMX-JSON und behält nur Änderungen', () => {
    const json = {
      dataSets: [{ series: { '0:0': { observations: { '0': [2, 0], '1': [2, 0], '2': [2.25, 0], '3': [2.5, 0], '4': [2.5, 0], '5': [2.5, 0] } } } }],
      structure: {
        dimensions: {
          observation: [
            {
              id: 'TIME_PERIOD',
              values: ['2025-06-11', '2025-07-01', '2026-06-17', '2026-09-16', '2026-09-17', '2026-10-01'].map((id) => ({ id })),
            },
          ],
        },
      },
    }
    expect(parseEzbZinsen(json)).toEqual([
      { datum: '2025-06-11', einlage: 2 },
      { datum: '2026-06-17', einlage: 2.25 },
      { datum: '2026-09-16', einlage: 2.5 },
    ])
  })
  it('liest den Einlagezins aus der Pressemitteilung', () => {
    expect(
      parseEzbEntscheidung(
        '<p>The interest rates on the deposit facility, the main refinancing operations and the marginal lending facility will remain unchanged at 2.00%, 2.15% and 2.40% respectively.</p>',
      ),
    ).toEqual({ einlage: 2, unveraendert: true })
    expect(parseEzbEntscheidung('<p>the interest rate on the deposit facility will be decreased to 1.75%.</p>')).toEqual({
      einlage: 1.75,
      unveraendert: false,
    })
    expect(parseEzbEntscheidung('<p>Keine Zinsen hier.</p>')).toBeNull()
  })
})

describe('fed', () => {
  it('parst Brüche und Statements', () => {
    expect(fedBruch('4-1/4')).toBe(4.25)
    expect(fedBruch('1/4')).toBe(0.25)
    expect(fedBruch('4')).toBe(4)
    expect(parseFedStatement('<p>decided to maintain the target range for the federal funds rate at 4-1/4 to 4-1/2 percent.</p>')).toEqual({
      unten: 4.25,
      oben: 4.5,
    })
    expect(
      parseFedStatement('<p>decided to lower the target range for the federal funds rate by 1/4 percentage point<strong> </strong>to 3-3/4<strong> </strong>to 4 percent.</p>'),
    ).toEqual({ unten: 3.75, oben: 4 })
    expect(parseFedStatement('<p>decided to maintain the target range for the federal funds rate at 0 to 1/4 percent.</p>')).toEqual({
      unten: 0,
      oben: 0.25,
    })
    expect(parseFedStatement('<p>Nichts.</p>')).toBeNull()
  })
  it('verdichtet die FRED-CSV auf Änderungstage', () => {
    const csv = 'observation_date,DFEDTARU,DFEDTARL\n2026-09-16,3.75,3.50\n2026-09-17,4.00,3.75\n2026-09-18,4.00,3.75\n2026-09-19,,3.75\n'
    const { oben, unten } = parseFredCsv(csv)
    expect(oben).toHaveLength(3)
    expect(unten).toHaveLength(4)
    expect(verdichteFed(oben, unten)).toEqual([
      { datum: '2026-09-16', oben: 3.75, unten: 3.5 },
      { datum: '2026-09-17', oben: 4, unten: 3.75 },
    ])
  })
  it('liest RSS mit CDATA und sortiert neueste zuerst', () => {
    const xml = `<rss><channel>
      <item><title>Minutes</title><link><![CDATA[https://x/a.htm]]></link><pubDate><![CDATA[Tue, 13 Oct 2026 18:00:00 GMT]]></pubDate></item>
      <item><title>Federal Reserve issues FOMC statement</title><link>https://x/b.htm</link><pubDate>Wed, 28 Oct 2026 18:00:00 GMT</pubDate></item>
    </channel></rss>`
    const m = parseRss(xml)
    expect(m[0]).toEqual({ titel: 'Federal Reserve issues FOMC statement', datum: '2026-10-28T18:00:00.000Z', link: 'https://x/b.htm' })
    expect(m[1].link).toBe('https://x/a.htm')
  })
})

function beispielDaten(): MakroDaten {
  return {
    version: 1,
    lastUpdated: '2026-10-27T06:00:00.000Z',
    quellen: {},
    fed: {
      zins: { oben: 4, unten: 3.75, gueltigAb: '2026-09-17', letzteAenderungBp: 25, letzteAenderungAm: '2026-09-17' },
      historie: [],
      termine: [{ datum: '2026-10-28', beginn: '2026-10-27', entscheidungUtc: '2026-10-28T18:00:00.000Z', sep: false }],
      meldungen: [],
      letzteEntscheidung: null,
    },
    ezb: {
      zins: { einlage: 2.5, gueltigAb: '2026-09-16', letzteAenderungBp: 25, letzteAenderungAm: '2026-09-16' },
      historie: [],
      termine: [{ datum: '2026-10-29', beginn: '2026-10-28', entscheidungUtc: '2026-10-29T13:15:00.000Z' }],
      meldungen: [],
      letzteEntscheidung: null,
    },
  }
}

describe('push-logik', () => {
  const url = 'https://app/#/makro'
  it('Vortag: einen Tag vorher, mit Uhrzeit in deutscher Zeit', () => {
    const p = faelligePushes(beispielDaten(), {}, new Date('2026-10-27T15:00:00Z'), url)
    expect(p.map((n) => n.key)).toEqual(['fed-2026-10-28:vortag'])
    expect(p[0].titel).toContain('19:00 Uhr')
    expect(p[0].text).toContain('Morgen')
    expect(p[0].text).toContain('3,75–4,00 %')
  })
  it('kurz vorher: innerhalb von 75 Minuten, mit Restminuten; EZB-Vortag parallel', () => {
    const p = faelligePushes(beispielDaten(), { 'fed-2026-10-28:vortag': 'x' }, new Date('2026-10-28T16:50:00Z'), url)
    expect(p.map((n) => n.key).sort()).toEqual(['ezb-2026-10-29:vortag', 'fed-2026-10-28:kurz'])
    expect(p.find((n) => n.key.endsWith(':kurz'))?.titel).toBe('In 70 Min: Fed-Zinsentscheidung')
  })
  it('Ergebnis erst, wenn die Entscheidung des Tages vorliegt, und nie doppelt', () => {
    const d = beispielDaten()
    const ohne = faelligePushes(d, { 'fed-2026-10-28:vortag': 'x', 'fed-2026-10-28:kurz': 'x', 'ezb-2026-10-29:vortag': 'x' }, new Date('2026-10-28T18:05:00Z'), url)
    expect(ohne).toEqual([])
    d.fed.letzteEntscheidung = { datum: '2026-10-28', text: 'unverändert 3,75–4,00 %', link: 'https://fed/s.htm', aenderungBp: 0 }
    const mit = faelligePushes(d, { 'fed-2026-10-28:vortag': 'x', 'fed-2026-10-28:kurz': 'x', 'ezb-2026-10-29:vortag': 'x' }, new Date('2026-10-28T18:05:00Z'), url)
    expect(mit).toHaveLength(1)
    expect(mit[0]).toMatchObject({ key: 'fed-2026-10-28:ergebnis', titel: 'Fed: unverändert 3,75–4,00 %', url: 'https://fed/s.htm' })
    expect(faelligePushes(d, { 'fed-2026-10-28:ergebnis': 'x', 'ezb-2026-10-29:vortag': 'x' }, new Date('2026-10-28T18:05:00Z'), url)).toEqual([])
  })
  it('alte Termine lösen nichts mehr aus', () => {
    const d = beispielDaten()
    d.fed.letzteEntscheidung = { datum: '2026-10-28', text: 'unverändert 3,75–4,00 %' }
    expect(faelligePushes(d, {}, new Date('2026-11-15T12:00:00Z'), url)).toEqual([])
  })
})

describe('ics', () => {
  it('erzeugt je Termin ein VEVENT mit zwei Erinnerungen', () => {
    const d = beispielDaten()
    const ics = erzeugeIcs([
      { bank: 'fed', termin: { ...d.fed.termine[0], sep: true } },
      { bank: 'ezb', termin: d.ezb.termine[0] },
    ])
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(4)
    expect(ics).toContain('UID:fed-2026-10-28@chart-akademie')
    expect(ics).toContain('DTSTART:20261028T180000Z')
    expect(ics).toContain('SUMMARY:Fed-Zinsentscheidung (mit Projektionen)')
    expect(ics).toContain('SUMMARY:EZB-Zinsentscheidung')
    for (const zeile of ics.split('\r\n')) expect(Buffer.byteLength(zeile, 'utf8')).toBeLessThanOrEqual(75)
  })
})

describe('tracker-push', () => {
  const tracker = {
    version: 1,
    lastUpdated: '2026-10-28T18:00:00Z',
    config: { instrumente: ['dax'], muster: { ausbruch: true, tunnel: true, 'ema-kreuz': true, rsi: false, setup: true }, push: true, aktualisiertAm: 0 },
    configQuelle: 'datei',
    instrumente: [
      {
        id: 'dax',
        name: 'DAX',
        symbol: '^GDAXI',
        waehrung: 'EUR',
        dezimalen: 0,
        quelle: 'yahoo',
        kerzen: [],
        analyse: null,
        signale: [
          { id: 'dax:tunnel:short:2026-10-28', instrument: 'dax', muster: 'tunnel', richtung: 'short', datum: '2026-10-28', zeit: 'x', preis: 1, titel: 'Am oberen Tunnelrand', text: 'Oberkante.', vorlaeufig: true },
          { id: 'dax:rsi:short:2026-10-28', instrument: 'dax', muster: 'rsi', richtung: 'short', datum: '2026-10-28', zeit: 'x', preis: 1, titel: 'RSI überkauft', text: 'RSI.' },
          { id: 'dax:ausbruch:long:2026-10-01', instrument: 'dax', muster: 'ausbruch', richtung: 'long', datum: '2026-10-01', zeit: 'x', preis: 1, titel: 'Breakout', text: 'alt.' },
        ],
      },
    ],
  } as unknown as import('../../src/tracker/types.ts').TrackerDaten

  it('pusht nur aktive Muster, nur frische Signale, nie doppelt', () => {
    const jetzt = new Date('2026-10-28T19:00:00Z')
    const p = faelligeTrackerPushes(tracker, {}, jetzt, 'https://app/#/tracker')
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ key: 'tracker:dax:tunnel:short:2026-10-28', titel: 'DAX: Am oberen Tunnelrand', url: 'https://app/#/tracker' })
    expect(p[0].text).toContain('Tageskerze noch offen')
    expect(faelligeTrackerPushes(tracker, { 'tracker:dax:tunnel:short:2026-10-28': 'x' }, jetzt, 'u')).toEqual([])
    expect(faelligeTrackerPushes({ ...tracker, config: { ...tracker.config, push: false } }, {}, jetzt, 'u')).toEqual([])
  })
})

describe('tracker-push stunde', () => {
  it('pusht Stunden-Signale nur mit eigenem Schalter und Muster', () => {
    const basis = {
      version: 1,
      lastUpdated: 'x',
      configQuelle: 'datei',
      config: { instrumente: ['dax'], muster: { ausbruch: true, tunnel: true, 'ema-kreuz': true, rsi: true, setup: true }, push: true, musterStunde: { ausbruch: true, tunnel: false, 'ema-kreuz': true, rsi: true, setup: true }, pushStunde: true, aktualisiertAm: 0 },
      instrumente: [
        {
          id: 'dax', name: 'DAX', symbol: '^GDAXI', waehrung: 'EUR', dezimalen: 0, quelle: 'yahoo', kerzen: [], analyse: null, signale: [],
          stunde: {
            quelle: 'yahoo', kerzen: [], analyse: null,
            signale: [
              { id: 'dax:ausbruch:long:stunde:2026-10-28T14', instrument: 'dax', ebene: 'stunde', muster: 'ausbruch', richtung: 'long', datum: '2026-10-28', zeit: 'x', preis: 1, titel: 'Breakout über 20-Stunden-Hoch', text: 't' },
              { id: 'dax:tunnel:neutral:stunde:2026-10-28T14', instrument: 'dax', ebene: 'stunde', muster: 'tunnel', richtung: 'neutral', datum: '2026-10-28', zeit: 'x', preis: 1, titel: 'Tunnel erkannt', text: 't' },
            ],
          },
        },
      ],
    } as unknown as import('../../src/tracker/types.ts').TrackerDaten
    const jetzt = new Date('2026-10-28T19:00:00Z')
    const p = faelligeTrackerPushes(basis, {}, jetzt, 'u')
    expect(p.map((x) => x.key)).toEqual(['tracker:dax:ausbruch:long:stunde:2026-10-28T14'])
    expect(p[0].titel).toBe('DAX (1h): Breakout über 20-Stunden-Hoch')
    expect(faelligeTrackerPushes({ ...basis, config: { ...basis.config, pushStunde: false } }, {}, jetzt, 'u')).toEqual([])
  })
})
