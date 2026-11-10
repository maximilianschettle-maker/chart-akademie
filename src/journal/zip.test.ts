import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { zipLesen } from './zip'
import { csvZeilen, positionenAusFuellungen } from './csv'

// Fixture im Format des echten BingX-Exports („Order History“ → ZIP mit mehreren CSVs, Futures-Spalten:
// UID, Order No., Time(Europe/Berlin), Pair, Type, Leverage, DealPrice, Quantity, Amount, Fee, Fee Coin, Realized PNL, Quote Asset, Order Type, AvgPrice)
const ZIP = readFileSync(fileURLToPath(new URL('./fixtures/bingx-order-history.zip', import.meta.url)))

describe('ZIP-Leser', () => {
  it('liest deflate- und store-Einträge, UTF-8-Namen inklusive', async () => {
    const eintraege = await zipLesen(ZIP.buffer.slice(ZIP.byteOffset, ZIP.byteOffset + ZIP.byteLength))
    expect(eintraege.map((e) => e.name)).toEqual(['Spot_Account.csv', 'USDⓢ_M_Perpetual_Futures.csv', 'Coin_M_Perpetual_Futures.csv'])
    expect(eintraege[0].text.split('\n')[0]).toMatch(/^UID,Order No\./)
    expect(eintraege[1].text.split('\n')).toHaveLength(6)
    expect(eintraege[2].text).toMatch(/Realized PNL/)
  })

  it('wirft bei einer Nicht-ZIP', async () => {
    await expect(zipLesen(new TextEncoder().encode('kein zip').buffer as ArrayBuffer)).rejects.toThrow(/Keine ZIP/)
  })
})

describe('BingX Order History (echtes Format)', () => {
  it('Futures-CSV: Spalten erkannt, Positionen gepaart, Spot-Datei ohne Zeilen bleibt leer', async () => {
    const eintraege = await zipLesen(ZIP.buffer.slice(ZIP.byteOffset, ZIP.byteOffset + ZIP.byteLength))
    const futures = csvZeilen(eintraege[1].text)
    expect(futures).toHaveLength(4)
    expect(futures[0]).toMatchObject({ symbol: 'BTCUSDT', aktion: 'open', richtung: 'long', hebel: 13, preis: 81331, menge: 1.5833, gebuehr: -25.7542, pnl: 0, order: '2113284923851804672', demo: false })
    const p = positionenAusFuellungen(futures)
    expect(p).toHaveLength(2)
    expect(p[0]).toMatchObject({ richtung: 'verkaufen', eroeffnungskurs: 84158.9, schlusskurs: 83055.2, gewinnVerlust: 3875.7356, hebel: 30, demo: false })
    expect(p[1]).toMatchObject({ richtung: 'kaufen', eroeffnungskurs: 81331, schlusskurs: 81050.6, gewinnVerlust: -443.9573, hebel: 13 })
    expect(csvZeilen(eintraege[0].text)).toEqual([])
  })
})
