import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../../types'
import { CHART_FARBEN } from './ChartPanel'

// Chart für den Replay-Modus: hängt neue Bars per series.update() an,
// statt bei jedem Schritt neu zu rendern. Zeitachse optional verdeckt
// (Anti-Schummel im freien Replay).

interface ReplayChartProps {
  candles: Candle[]
  cursor: number
  hoehe?: number
  zeitVerdeckt?: boolean
  entryPreis?: number
  stopLoss?: number
  takeProfit?: number
}

function barZuKerze(c: Candle) {
  return {
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }
}

function barZuVolumen(c: Candle) {
  return {
    time: c.time as UTCTimestamp,
    value: c.volume,
    color: c.close >= c.open ? '#22C55E55' : '#EF444455',
  }
}

export function ReplayChart({
  candles,
  cursor,
  hoehe = 460,
  zeitVerdeckt = false,
  entryPreis,
  stopLoss,
  takeProfit,
}: ReplayChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const kerzenRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumenRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const letzterCursorRef = useRef(0)
  const preisLinienRef = useRef<IPriceLine[]>([])

  // Chart einmal pro Datensatz aufbauen
  useEffect(() => {
    const container = containerRef.current
    if (!container || candles.length === 0) return

    const chart = createChart(container, {
      height: hoehe,
      layout: {
        background: { type: ColorType.Solid, color: CHART_FARBEN.hintergrund },
        textColor: CHART_FARBEN.text,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: CHART_FARBEN.gitter },
        horzLines: { color: CHART_FARBEN.gitter },
      },
      rightPriceScale: { borderColor: CHART_FARBEN.gitter },
      timeScale: {
        borderColor: CHART_FARBEN.gitter,
        timeVisible: !zeitVerdeckt,
        visible: !zeitVerdeckt,
        rightOffset: 5,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const kerzen = chart.addSeries(CandlestickSeries, {
      upColor: CHART_FARBEN.long,
      downColor: CHART_FARBEN.short,
      borderVisible: false,
      wickUpColor: CHART_FARBEN.long,
      wickDownColor: CHART_FARBEN.short,
    })
    const volumen = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volumen',
      priceFormat: { type: 'volume' },
    })
    chart.priceScale('volumen').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    chartRef.current = chart
    kerzenRef.current = kerzen
    volumenRef.current = volumen
    letzterCursorRef.current = -1 // erzwingt setData im Cursor-Effekt

    const beobachter = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    beobachter.observe(container)

    return () => {
      beobachter.disconnect()
      chart.remove()
      chartRef.current = null
      kerzenRef.current = null
      volumenRef.current = null
      preisLinienRef.current = []
    }
  }, [candles, hoehe, zeitVerdeckt])

  // Cursor-Fortschritt: inkrementell anhängen (oder bei Sprung zurück neu setzen)
  useEffect(() => {
    const kerzen = kerzenRef.current
    const volumen = volumenRef.current
    const chart = chartRef.current
    if (!kerzen || !volumen || !chart || candles.length === 0) return

    const letzter = letzterCursorRef.current
    if (letzter < 0 || cursor < letzter) {
      const sichtbar = candles.slice(0, cursor + 1)
      kerzen.setData(sichtbar.map(barZuKerze))
      volumen.setData(sichtbar.map(barZuVolumen))
      chart.timeScale().setVisibleLogicalRange({ from: cursor - 120, to: cursor + 8 })
    } else {
      for (let i = letzter + 1; i <= cursor && i < candles.length; i++) {
        kerzen.update(barZuKerze(candles[i]))
        volumen.update(barZuVolumen(candles[i]))
      }
    }
    letzterCursorRef.current = cursor
  }, [cursor, candles])

  // Entry/SL/TP als Preislinien
  useEffect(() => {
    const kerzen = kerzenRef.current
    if (!kerzen) return
    for (const linie of preisLinienRef.current) kerzen.removePriceLine(linie)
    preisLinienRef.current = []

    const linien: { preis: number | undefined; farbe: string; titel: string }[] = [
      { preis: entryPreis, farbe: '#F59E0B', titel: 'Entry' },
      { preis: stopLoss, farbe: CHART_FARBEN.short, titel: 'SL' },
      { preis: takeProfit, farbe: CHART_FARBEN.long, titel: 'TP' },
    ]
    for (const l of linien) {
      if (l.preis === undefined || l.preis <= 0) continue
      preisLinienRef.current.push(
        kerzen.createPriceLine({
          price: l.preis,
          color: l.farbe,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: l.titel,
        }),
      )
    }
  }, [entryPreis, stopLoss, takeProfit, candles])

  return <div ref={containerRef} className="w-full overflow-hidden rounded-lg" />
}
