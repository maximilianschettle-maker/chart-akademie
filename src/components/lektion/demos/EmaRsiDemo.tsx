import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { Candle } from '../../../types'
import { getSzenarioDaten } from '../../../data/szenarien'
import { rsi } from '../../../engine/indikatoren/rsi'
import { ChartPanel } from '../../chart/ChartPanel'

// EMA 20/50 auf einem echten Trend (BTC Jan–Mär 2024) + RSI(14) darunter.

export function EmaRsiDemo() {
  const [candles, setCandles] = useState<Candle[] | null>(null)

  useEffect(() => {
    getSzenarioDaten('btc-trend-feb24')
      .then((d) => setCandles(d.candles))
      .catch(() => setCandles([]))
  }, [])

  if (candles === null) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-rand bg-flaeche text-gedimmt">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (candles.length === 0) {
    return (
      <div className="rounded-xl border border-rand bg-flaeche p-6 text-sm text-gedimmt">
        Datensatz konnte nicht geladen werden.
      </div>
    )
  }

  const rsiWerte = rsi(candles, 14)
  const breite = 560
  const hoehe = 110
  const pfad = rsiWerte
    .map((wert, i) => {
      if (!Number.isFinite(wert)) return null
      const x = (i / (candles.length - 1)) * breite
      const y = hoehe - (wert / 100) * hoehe
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .filter(Boolean)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`)
    .join(' ')

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h3 className="mb-1 font-semibold text-white">
        EMA 20 (gelb) & EMA 50 (blau) — BTC 4h, Jan–März 2024 (echte Daten)
      </h3>
      <p className="mb-3 text-xs text-gedimmt">
        Beachte: Im intakten Trend dienen die EMAs als dynamische Unterstützung — Rücksetzer drehen
        immer wieder an EMA 20/50.
      </p>
      <ChartPanel candles={candles} emaPerioden={[20, 50]} zeigeVolumen={false} hoehe={340} />
      <div className="mt-3">
        <div className="mb-1 text-xs font-semibold text-gedimmt">RSI (14)</div>
        <svg viewBox={`0 0 ${breite} ${hoehe}`} className="w-full">
          <rect x={0} y={hoehe * 0.3} width={breite} height={hoehe * 0.4} fill="#8B95A511" />
          <line x1={0} x2={breite} y1={hoehe * 0.3} y2={hoehe * 0.3} stroke="#EF4444" strokeDasharray="3 3" />
          <line x1={0} x2={breite} y1={hoehe * 0.7} y2={hoehe * 0.7} stroke="#22C55E" strokeDasharray="3 3" />
          <text x={4} y={hoehe * 0.3 - 3} fill="#EF4444" fontSize={10}>70 — überkauft</text>
          <text x={4} y={hoehe * 0.7 + 11} fill="#22C55E" fontSize={10}>30 — überverkauft</text>
          <path d={pfad} fill="none" stroke="#A855F7" strokeWidth={1.5} />
        </svg>
        <p className="mt-2 text-xs text-gedimmt">
          Wichtigste RSI-Lektion am echten Chart: Im starken Aufwärtstrend blieb der RSI wochenlang
          „überkauft" — wer deswegen geshortet hat, wurde überrollt. „Überkauft" heißt im Trend nur:
          der Trend ist stark. RSI-Extreme sind in <em>Ranges</em> nützlich, nicht gegen Trends.
        </p>
      </div>
    </div>
  )
}
