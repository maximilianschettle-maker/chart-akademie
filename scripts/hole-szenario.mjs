// Holt historische Binance-Klines und legt sie als statischen Szenario-Datensatz ab.
// Aufruf: node scripts/hole-szenario.mjs BTCUSDT 1h 2023-09-20 2023-11-01 btc-breakout-okt23 [ordner]
// ordner: Zielordner unter public/ (Standard: szenarien; 'replay' fuer die Offline-Fallbacks des Simulators)
// Gibt zusätzlich eine Tages-Zusammenfassung mit Bar-Indizes aus (zum Definieren der Entry-Zonen).

import { writeFileSync, mkdirSync } from 'node:fs'

const [symbol, interval, vonIso, bisIso, name, ordner = 'szenarien'] = process.argv.slice(2)
if (!name) {
  console.error('Aufruf: node scripts/hole-szenario.mjs SYMBOL INTERVAL VON BIS NAME')
  process.exit(1)
}

const von = Date.parse(vonIso + 'T00:00:00Z')
const bis = Date.parse(bisIso + 'T00:00:00Z')

const candles = []
let cursor = von
while (cursor < bis) {
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}` +
    `&startTime=${cursor}&endTime=${bis}&limit=1000`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const chunk = await res.json()
  if (chunk.length === 0) break
  for (const k of chunk) {
    candles.push({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    })
  }
  cursor = chunk[chunk.length - 1][0] + 1
  if (chunk.length < 1000) break
}

mkdirSync(`public/${ordner}`, { recursive: true })
const datei = `public/${ordner}/${name}.json`
writeFileSync(datei, JSON.stringify({ symbol, interval, candles }))
console.log(`${datei}: ${candles.length} Kerzen (${symbol} ${interval}, ${vonIso}..${bisIso})`)

// Tages-Zusammenfassung mit Bar-Indizes
let tag = null
let agg = null
const tage = []
candles.forEach((c, i) => {
  const d = new Date(c.time * 1000).toISOString().slice(0, 10)
  if (d !== tag) {
    if (agg) tage.push(agg)
    tag = d
    agg = { tag: d, startIndex: i, open: c.open, high: c.high, low: c.low, close: c.close }
  } else {
    agg.high = Math.max(agg.high, c.high)
    agg.low = Math.min(agg.low, c.low)
    agg.close = c.close
  }
})
if (agg) tage.push(agg)
for (const t of tage) {
  console.log(
    `${t.tag} ab Bar ${String(t.startIndex).padStart(4)}: O ${t.open.toFixed(0)} H ${t.high.toFixed(0)} L ${t.low.toFixed(0)} C ${t.close.toFixed(0)}`,
  )
}
