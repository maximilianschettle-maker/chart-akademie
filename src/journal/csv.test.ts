import { describe, expect, it } from 'vitest'
import { csvZeilen, parseCsv, positionenAusFuellungen, seiteLesen, zahl, zeitNormieren } from './csv'

// Zeilen aus dem echten BingX-Screenshot (Trade History, Demo) vom 08.11.2026
const BINGX = `Filled Time,Futures,Side,Filled,Filled Price,Closed PnL,Fee,Order No.
2026-10-22 18:50:09,BTCUSDT(Demo),Close Long 13X,1.5833 BTC,"81,050.6","-443.9573 Virtual USDT",-64.1637 Virtual USDT,2113311959291006976
2026-10-22 18:47:11,BTCUSDT(Demo),Open Long 13X,1.5833 BTC,"81,331.0",0.0000 Virtual USDT,-25.7542 Virtual USDT,2113284923851804672
2026-10-22 04:19:03,BTCUSDT(Demo),Close Short 30X,3.5112 BTC,"83,055.2","+3,875.7356 Virtual USDT",-145.8116 Virtual USDT,2113092738460160000
2026-10-21 21:02:17,BTCUSDT(Demo),Open Short 30X,3.5112 BTC,"84,158.9",0.0000 Virtual USDT,-147.7495 Virtual USDT,2112982822978326528
2026-10-20 16:57:37,BTCUSDT(Demo),Close Short 30X,3.5576 BTC,"83,407.1","-1,305.7882 Virtual USDT",-148.3646 Virtual USDT,2112558863141048322
2026-10-20 16:12:29,BTCUSDT(Demo),Open Short 30X,3.5576 BTC,"83,040.1",0.0000 Virtual USDT,-147.7117 Virtual USDT,2112547503736885248
2026-10-20 16:01:57,BTCUSDT(Demo),Close Short 30X,3.5956 BTC,"82,365.8","-573.8577 Virtual USDT",-148.0772 Virtual USDT,2112544853750452224
2026-10-20 16:01:34,BTCUSDT(Demo),Open Short 30X,3.5956 BTC,"82,206.2",0.0000 Virtual USDT,-59.1161 Virtual USDT,2112543579067912192
`

describe('CSV-Import: Bausteine', () => {
  it('parst Anführungszeichen und erkennt den Trenner', () => {
    const z = parseCsv('a,b,c\n1,"x,y",3\n')
    expect(z).toEqual([['a', 'b', 'c'], ['1', 'x,y', '3']])
    expect(parseCsv('a;b\n1;2')[1]).toEqual(['1', '2'])
    expect(parseCsv('a\tb\n1\t2,5')[1]).toEqual(['1', '2,5'])
  })

  it('Zahlen in US- und DE-Schreibweise, mit Einheit', () => {
    expect(zahl('81,050.6')).toBe(81050.6)
    expect(zahl('-443.9573 Virtual USDT')).toBe(-443.9573)
    expect(zahl('+3,875.7356 Virtual USDT')).toBe(3875.7356)
    expect(zahl('1.305,79 €')).toBe(1305.79)
    expect(zahl('1.5833 BTC')).toBe(1.5833)
    expect(zahl('')).toBeNull()
  })

  it('Seite und Zeit', () => {
    expect(seiteLesen('Close Long 13X')).toEqual({ aktion: 'close', richtung: 'long' })
    expect(seiteLesen('Open Short')).toEqual({ aktion: 'open', richtung: 'short' })
    expect(zeitNormieren('2026-10-22 18:50:09')).toBe('2026-10-22T18:50')
    expect(zeitNormieren('22.10.2026 18:50')).toBe('2026-10-22T18:50')
  })
})

describe('CSV-Import: BingX Trade History', () => {
  const zeilen = csvZeilen(BINGX)

  it('liest Symbol, Demo, Hebel, Menge, Preis, PnL, Gebühr, Order', () => {
    expect(zeilen).toHaveLength(8)
    expect(zeilen[0]).toMatchObject({ symbol: 'BTCUSDT', aktion: 'close', richtung: 'long', menge: 1.5833, preis: 81050.6, pnl: -443.9573, gebuehr: -64.1637, order: '2113311959291006976', hebel: 13, demo: true })
  })

  it('paart Open und Close FIFO zu geschlossenen Positionen', () => {
    const p = positionenAusFuellungen(zeilen)
    expect(p).toHaveLength(4)
    expect(p.every((x) => x.status === 'geschlossen' && x.broker === 'BingX' && x.demo === true)).toBe(true)
    const long = p.find((x) => x.richtung === 'kaufen')!
    expect(long).toMatchObject({ instrument: 'BTCUSDT', hebel: 13, kontrakte: 1.5833, eroeffnungskurs: 81331, eroeffnungsdatum: '2026-10-22T18:47', schlusskurs: 81050.6, schlussdatum: '2026-10-22T18:50', gewinnVerlust: -443.9573, brokerId: '2113311959291006976' })
    expect(long.uebernachtgebuehren).toBeCloseTo(64.1637 + 25.7542, 3)
    expect(long.positionsgroesse).toBeCloseTo(1.5833 * 81331, 0)
    expect(long.einsatz).toBeCloseTo((1.5833 * 81331) / 13, 0)
    // Shorts: der frühere Open gehört zum früheren Close
    const shorts = p.filter((x) => x.richtung === 'verkaufen')
    // Open und Close in derselben Minute (16:01:34 / 16:01:57) bleiben ein Paar
    expect(shorts[0]).toMatchObject({ eroeffnungskurs: 82206.2, schlusskurs: 82365.8, gewinnVerlust: -573.8577 })
    expect(shorts[1]).toMatchObject({ eroeffnungskurs: 83040.1, schlusskurs: 83407.1, gewinnVerlust: -1305.7882 })
    expect(shorts[2]).toMatchObject({ eroeffnungskurs: 84158.9, schlusskurs: 83055.2, gewinnVerlust: 3875.7356 })
  })

  it('ein Open ohne Close bleibt offen', () => {
    const p = positionenAusFuellungen(csvZeilen(BINGX.split('\n').slice(0, 1).concat(BINGX.split('\n').slice(4, 5)).join('\n')))
    expect(p).toHaveLength(1)
    expect(p[0].status).toBe('offen')
    expect(p[0].eroeffnungskurs).toBe(84158.9)
  })
})
