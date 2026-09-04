import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { Candle, ChartAnnotation } from '../../types'

// Einzige Stelle im Projekt, die lightweight-charts direkt anspricht (v5-API!).

export const CHART_FARBEN = {
  long: '#22C55E',
  short: '#EF4444',
  hintergrund: '#131722',
  gitter: '#1F2733',
  text: '#8B95A5',
}

interface ChartPanelProps {
  candles: Candle[]
  annotationen?: ChartAnnotation[]
  hoehe?: number
  zeigeVolumen?: boolean
}

export function ChartPanel({
  candles,
  annotationen = [],
  hoehe = 380,
  zeigeVolumen = true,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)

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
      timeScale: { borderColor: CHART_FARBEN.gitter, timeVisible: true },
      crosshair: { mode: 0 },
    })

    const kerzenSerie = chart.addSeries(CandlestickSeries, {
      upColor: CHART_FARBEN.long,
      downColor: CHART_FARBEN.short,
      borderVisible: false,
      wickUpColor: CHART_FARBEN.long,
      wickDownColor: CHART_FARBEN.short,
    })
    kerzenSerie.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    )

    if (zeigeVolumen) {
      const volumenSerie = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volumen',
        priceFormat: { type: 'volume' },
        color: CHART_FARBEN.long,
      })
      volumenSerie.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? '#22C55E55' : '#EF444455',
        })),
      )
      chart.priceScale('volumen').applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      })
    }

    const marker: SeriesMarker<Time>[] = []
    for (const a of annotationen) {
      if (a.typ === 'marker') {
        marker.push({
          time: a.time as UTCTimestamp,
          position: a.position === 'aboveBar' ? 'aboveBar' : 'belowBar',
          shape: a.form,
          color: a.farbe ?? '#F59E0B',
          text: a.text,
        })
      } else if (a.typ === 'preislinie') {
        kerzenSerie.createPriceLine({
          price: a.preis,
          color: a.farbe ?? '#F59E0B',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: a.text ?? '',
        })
      }
    }
    if (marker.length > 0) {
      marker.sort((a, b) => (a.time as number) - (b.time as number))
      createSeriesMarkers(kerzenSerie, marker)
    }

    chart.timeScale().fitContent()

    const beobachter = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    beobachter.observe(container)

    return () => {
      beobachter.disconnect()
      chart.remove()
    }
  }, [candles, annotationen, hoehe, zeigeVolumen])

  return <div ref={containerRef} className="w-full overflow-hidden rounded-lg" />
}
