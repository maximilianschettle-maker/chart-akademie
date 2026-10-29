import { useEffect, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import {
  createChart,
  type IChartApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  ColorType,
  TickMarkType,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { Candle, ChartAnnotation } from '../../types'
import { ema } from '../../engine/indikatoren/ema'
import { installiereGesten } from './gesten'

const EMA_FARBEN = ['#F59E0B', '#3B82F6', '#A855F7']

// lightweight-charts beschriftet Zeiten in UTC; Intraday-Kerzen sollen Berliner Uhrzeit zeigen.
const ZONE = 'Europe/Berlin'
const fmtUhr = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' })
const fmtTag = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, weekday: 'short', day: 'numeric' })
const fmtMonat = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, month: 'short' })
const fmtJahr = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, year: 'numeric' })
const fmtVoll = new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const alsDatum = (t: Time) => (typeof t === 'number' ? new Date(t * 1000) : null)

function tickBerlin(time: Time, typ: TickMarkType): string | null {
  const d = alsDatum(time)
  if (!d) return null
  if (typ === TickMarkType.Time || typ === TickMarkType.TimeWithSeconds) return fmtUhr.format(d)
  if (typ === TickMarkType.DayOfMonth) return fmtTag.format(d).replace(',', '')
  if (typ === TickMarkType.Month) return fmtMonat.format(d).replace('.', '')
  return fmtJahr.format(d)
}

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
  emaPerioden?: number[]
  /** Freiraum rechts in Kerzen — damit Markierungen an der letzten Kerze nicht am Rand kleben */
  randRechts?: number
  /** Uhrzeit an der Zeitachse; bei Tages-/Wochenkerzen (Aktien) aus */
  zeitSichtbar?: boolean
}

export function ChartPanel({
  candles,
  annotationen = [],
  hoehe = 380,
  zeigeVolumen = true,
  emaPerioden,
  randRechts = 0,
  zeitSichtbar = true,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<(() => void) | null>(null)
  // Preisachse von Hand verändert → Knopf „Ansicht zurücksetzen“ einblenden
  const [manuell, setManuell] = useState(false)

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
      timeScale: { borderColor: CHART_FARBEN.gitter, timeVisible: zeitSichtbar, ...(zeitSichtbar ? { tickMarkFormatter: tickBerlin } : {}) },
      ...(zeitSichtbar
        ? { localization: { locale: 'de-DE', timeFormatter: (t: Time) => (alsDatum(t) ? fmtVoll.format(alsDatum(t) as Date) : String(t)) } }
        : {}),
      crosshair: { mode: 0 },
      // Am Handy soll vertikales Wischen mit einem Finger die Seite scrollen, nicht den Chart;
      // Zwei-Finger-Gesten, Achsen-Zug und Doppeltipp übernimmt ./gesten.ts (Pinch der Bibliothek aus)
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: false },
    })
    ;(container as HTMLDivElement & { __chart?: IChartApi }).__chart = chart

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

    if (emaPerioden) {
      emaPerioden.forEach((periode, idx) => {
        const werte = ema(candles, periode)
        const serie = chart.addSeries(LineSeries, {
          color: EMA_FARBEN[idx % EMA_FARBEN.length],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          title: `EMA ${periode}`,
        })
        serie.setData(
          candles
            .map((c, i) => ({ time: c.time as UTCTimestamp, value: werte[i] }))
            .filter((p) => Number.isFinite(p.value)),
        )
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

    const ansichtEinpassen = () => {
      chart.priceScale('right').setAutoScale(true)
      chart.timeScale().fitContent()
      if (randRechts > 0) {
        chart.timeScale().setVisibleLogicalRange({ from: -0.5, to: candles.length - 0.5 + randRechts })
      }
    }
    ansichtEinpassen()
    setManuell(false)
    resetRef.current = () => {
      ansichtEinpassen()
      setManuell(false)
    }
    const gestenWeg = installiereGesten(chart, container, { serie: kerzenSerie, reset: ansichtEinpassen, onManuell: setManuell })

    const beobachter = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    beobachter.observe(container)

    return () => {
      beobachter.disconnect()
      gestenWeg()
      resetRef.current = null
      chart.remove()
    }
  }, [candles, annotationen, hoehe, zeigeVolumen, emaPerioden, randRechts, zeitSichtbar])

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full overflow-hidden rounded-lg" />
      {manuell && (
        <button
          type="button"
          onClick={() => resetRef.current?.()}
          className="absolute left-2 top-2 z-[3] inline-flex min-h-9 items-center gap-1 rounded-md border border-rand bg-nacht/80 px-2 text-[11px] font-semibold text-gedimmt hover:text-white"
          title="Ansicht zurücksetzen (auch per Doppeltipp auf den Chart)"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Auto
        </button>
      )}
    </div>
  )
}
