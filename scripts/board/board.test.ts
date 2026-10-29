import { describe, expect, it } from 'vitest'
import { cpiJahresrate, parseBeaTermine, parseEurostatEvents, parseEurostatWerte, parseFredCsv, parseFredReleaseDates, payrollsVeraenderung, periodeDeutsch, termineBereinigen } from './kalender.ts'
import { entitiesDekodieren, parseRss } from './rss.ts'
import { eintragId, kategorisiere, markttags, sprache } from './regeln.ts'

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Test</title>
<item><title>Wer auf EZB-Chefin Christine Lagarde folgen k&#246;nnte</title><link>https://www.tagesschau.de/wirtschaft/ezb-100.html</link>
<description>Fr&uuml;her als geplant tritt die Suche nach einer Nachfolge in die hei&szlig;e Phase.</description><pubDate>Thu, 29 Oct 2026 19:40:44 +0100</pubDate><dc:date>2026-10-29T18:40:44Z</dc:date></item>
<item><title><![CDATA[US tariffs on EU steel & aluminium rise]]></title><link>https://example.org/a?utm_source=rss</link><description><![CDATA[<p>The <b>tariffs</b> take effect Monday.</p>]]></description><pubDate>Thu, 22 Oct 2026  09:00:00 EST</pubDate></item>
<item><title>Ohne Link</title></item>
</channel></rss>`

describe('RSS-Parser', () => {
  it('liest Titel, Link, Zeit (dc:date vor pubDate) und Teaser; CDATA und Entities werden aufgelöst', () => {
    const e = parseRss(RSS)
    expect(e).toHaveLength(2)
    expect(e[0].titel).toBe('Wer auf EZB-Chefin Christine Lagarde folgen könnte')
    expect(e[0].zeit).toBe('2026-10-29T18:40:44.000Z')
    expect(e[0].text).toContain('heiße Phase')
    expect(e[1].titel).toBe('US tariffs on EU steel & aluminium rise')
    expect(e[1].text).toBe('The tariffs take effect Monday.')
    expect(e[1].zeit).toBe('2026-10-22T14:00:00.000Z')
  })
  it('dekodiert Entities', () => {
    expect(entitiesDekodieren('a &amp; b &lt;c&gt; &#x41;&#66; &nbsp;x')).toBe('a & b <c> AB  x')
  })
})

describe('Einordnung', () => {
  it('ordnet Kategorien nach Schlüsselwörtern zu, Titeltreffer gewinnen', () => {
    expect(kategorisiere('USA verhängen neue Zölle auf Stahl', 'Der Handelsstreit eskaliert')).toBe('handel')
    expect(kategorisiere('Waffenstillstand in Gaza wackelt', '')).toBe('konflikte')
    expect(kategorisiere('OPEC+ drosselt Förderung, Ölpreis steigt', '')).toBe('energie')
    expect(kategorisiere('Koalition einigt sich auf Haushalt', '')).toBe('politik')
    // Energie-Titel schlägt Politik im Teaser
    expect(kategorisiere('Gaspreis springt nach Pipeline-Störung', 'Die Regierung berät')).toBe('energie')
    expect(kategorisiere('Bundesliga: Bayern gewinnt Spitzenspiel', 'Tore und Stimmen')).toBeNull()
  })
  it('vergibt Markt-Tags', () => {
    expect(markttags('OPEC+ drosselt Förderung, Ölpreis steigt')).toEqual(['oel'])
    expect(markttags('EZB senkt Leitzins, Euro fällt')).toEqual(['eurusd'])
    expect(markttags('Neue Exportkontrollen für KI-Chips nach China', 'Nvidia und TSMC betroffen')).toContain('halbleiter')
    expect(markttags('NATO-Staaten erhöhen Verteidigungsausgaben')).toContain('ruestung')
    expect(markttags('Wetter: Sonnig in Bayern')).toEqual([])
  })
  it('erkennt die Sprache grob und bereinigt Links', () => {
    expect(sprache('Die Regierung und das Parlament', 'Es ist nicht klar')).toBe('de')
    expect(sprache('The government and the parliament', 'It is not clear')).toBe('en')
    expect(eintragId('https://example.org/a?utm_source=rss#x')).toBe('https://example.org/a')
    expect(eintragId('kein link')).toBe('kein link')
  })
})

describe('Kalender-Parser', () => {
  it('BEA: nur BIP-Schätzungen, Datum + Uhrzeit New York → UTC, Jahreswechsel aus der Reihenfolge', () => {
    const html = `<table><tr><td class="scheduled-date no-wrap"><div class="release-date">November 25</div> <small class="text-muted">8:30 AM</small></td><td class="release-title views-field">GDP (Second Estimate) and Corporate Profits, 3rd Quarter 2026        </td></tr>
<tr><td class="scheduled-date"><div class="release-date">December 5</div> <small class="text-muted">8:30 AM</small></td><td class="release-title views-field">U.S. International Trade in Goods and Services, October 2026</td></tr>
<tr><td class="scheduled-date"><div class="release-date">January 29</div> <small class="text-muted">8:30 AM</small></td><td class="release-title views-field">GDP (Advance Estimate), 4th Quarter 2026 and Year 2026</td></tr></table>`
    const t = parseBeaTermine(html, Date.UTC(2026, 9, 29))
    expect(t).toHaveLength(2)
    expect(t[0]).toMatchObject({ indikator: 'bip', titel: 'BIP Q3 2026 (2. Schätzung)', zeitUtc: '2026-11-25T13:30:00.000Z', quelle: 'BEA' })
    expect(t[1]).toMatchObject({ titel: 'BIP Q4 2026 (1. Schätzung)', zeitUtc: '2027-01-29T13:30:00.000Z' })
  })
  it('FRED release/dates → 08:30 New York (Sommer 12:30 UTC, Winter 13:30 UTC)', () => {
    const t = parseFredReleaseDates({ release_dates: [{ release_id: 10, date: '2026-11-12' }, { date: '2026-07-14' }, { date: 'x' }] }, { id: 10, indikator: 'cpi', titel: 'CPI' })
    expect(t.map((x) => x.zeitUtc)).toEqual(['2026-11-12T13:30:00.000Z', '2026-07-14T12:30:00.000Z'])
    expect(t[0].region).toBe('us')
  })
  it('Eurostat-Termine: nur Inflation, Arbeitslosigkeit, BIP; Periode auf Deutsch', () => {
    const t = parseEurostatEvents([
      { title: 'Flash estimate inflation euro area', start: '2026-11-04T11:00Z', period: 'October 2026' },
      { title: 'Unemployment', start: '2026-10-30T11:00Z', period: 'September 2026' },
      { title: 'Preliminary flash estimate GDP - EU and euro area', start: '2026-10-30T11:00Z', period: 'Q3/2026' },
      { title: 'Labour cost index', start: '2026-12-17T11:00Z', period: 'Q3/2026' },
    ])
    expect(t.map((x) => [x.indikator, x.periode])).toEqual([
      ['cpi', 'Oktober 2026'],
      ['arbeitsmarkt', 'September 2026'],
      ['bip', 'Q3 2026'],
    ])
    expect(t[0].zeitUtc).toBe('2026-11-04T11:00:00.000Z')
    expect(periodeDeutsch('March 2027')).toBe('März 2027')
  })
  it('FRED-CSV und Ableitungen: CPI-Jahresrate, Payrolls-Veränderung', () => {
    const csv = 'observation_date,CPIAUCSL\n' + Array.from({ length: 15 }, (_, i) => `2025-${String((i % 12) + 1).padStart(2, '0')}-01,${(300 + i * 2).toFixed(3)}`).join('\n') + '\n2026-04-01,.\n'
    const reihe = parseFredCsv(csv)
    expect(reihe).toHaveLength(15)
    const cpi = cpiJahresrate(reihe)!
    expect(cpi.einheit).toBe('% J/J')
    expect(cpi.wert).toBeCloseTo((328 / 304 - 1) * 100, 1)
    expect(cpi.vorher).toBeCloseTo((326 / 302 - 1) * 100, 1)
    const pay = payrollsVeraenderung([
      { datum: '2026-07-01', wert: 158_900 },
      { datum: '2026-08-01', wert: 159_015 },
      { datum: '2026-09-01', wert: 159_044 },
    ])!
    expect(pay.wert).toBe(29)
    expect(pay.vorher).toBe(115)
    expect(pay.periode).toBe('2026-09')
  })
  it('Eurostat JSON-stat → Werte je Periode', () => {
    const w = parseEurostatWerte({ value: { '0': 2.1, '1': 2.0 }, dimension: { time: { category: { index: { '2026-08': 0, '2026-09': 1 } } } } })
    expect(w).toEqual([
      { periode: '2026-08', wert: 2.1 },
      { periode: '2026-09', wert: 2.0 },
    ])
    expect(parseEurostatWerte({ value: {} })).toEqual([])
  })
  it('bereinigt Termine: Vergangenes raus, sortiert, keine Doppelten', () => {
    const jetzt = Date.UTC(2026, 9, 29, 12)
    const t = termineBereinigen(
      [
        { id: 'b', region: 'us', indikator: 'cpi', titel: 'x', zeitUtc: '2026-11-12T13:30:00.000Z', quelle: 'q' },
        { id: 'a', region: 'ez', indikator: 'bip', titel: 'y', zeitUtc: '2026-10-30T11:00:00.000Z', quelle: 'q' },
        { id: 'alt', region: 'ez', indikator: 'bip', titel: 'z', zeitUtc: '2026-10-01T11:00:00.000Z', quelle: 'q' },
        { id: 'a', region: 'ez', indikator: 'bip', titel: 'y', zeitUtc: '2026-10-30T11:00:00.000Z', quelle: 'q' },
      ],
      jetzt,
    )
    expect(t.map((x) => x.id)).toEqual(['a', 'b'])
  })
})
