// Holt zu jedem Szenario-Datensatz die Unterkerzen (1h → 15m, 4h → 1h) für das
// Intrabar-Replay und legt sie als public/szenarien/<name>-<intervall>.json ab.
// Aufruf: node scripts/hole-unterkerzen.mjs [name ...]   (ohne Namen: alle)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const UNTER = { '1d': '4h', '4h': '1h', '1h': '15m', '15m': '5m', '5m': '1m' }
const SEK = { '1d': 86400, '4h': 14400, '1h': 3600, '15m': 900, '5m': 300, '1m': 60 }
const ordner = 'public/szenarien'

const namen = process.argv.slice(2)
const dateien = readdirSync(ordner).filter((f) => f.endsWith('.json') && !/-(1h|15m|5m|1m|4h)\.json$/.test(f))

for (const datei of dateien) {
  const name = datei.replace('.json', '')
  if (namen.length && !namen.includes(name)) continue
  const d = JSON.parse(readFileSync(`${ordner}/${datei}`, 'utf8'))
  const unter = UNTER[d.interval]
  if (!unter) continue
  const von = d.candles[0].time * 1000
  const bis = (d.candles[d.candles.length - 1].time + SEK[d.interval]) * 1000 - 1
  const candles = []
  let cursor = von
  while (cursor < bis) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${d.symbol}&interval=${unter}&startTime=${cursor}&endTime=${bis}&limit=1000`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} für ${name}`)
    const chunk = await res.json()
    if (chunk.length === 0) break
    for (const k of chunk) {
      candles.push({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })
    }
    cursor = chunk[chunk.length - 1][0] + 1
    if (chunk.length < 1000) break
  }
  const ziel = `${ordner}/${name}-${unter}.json`
  writeFileSync(ziel, JSON.stringify({ symbol: d.symbol, interval: unter, candles }))
  console.log(`${ziel}: ${candles.length} Kerzen (${d.candles.length} × ${SEK[d.interval] / SEK[unter]} erwartet)`)
}
