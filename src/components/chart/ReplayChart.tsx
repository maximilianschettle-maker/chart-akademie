import { useEffect, useMemo, useRef } from 'react'
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
import type { Candle, Zeichnung } from '../../types'
import { CHART_FARBEN } from './ChartPanel'
import { aggregiere } from '../../engine/aggregation'
import { ZonenPrimitive } from './zonenPrimitive'

// Chart für den Replay-Modus: hängt neue Bars per series.update() an,
// statt bei jedem Schritt neu zu rendern. Zeitachse optional verdeckt
// (Anti-Schummel im freien Replay). Optional als höherer Timeframe
// (bucketSek) — dann wird aus den sichtbaren Bars live aggregiert, die
// letzte HTF-Kerze wächst mit jedem Schritt (kein Blick in die Zukunft).

export type ZeichenModus = 'aus' | 'linie' | 'zone'

interface ReplayChartProps {
  candles: Candle[]
  cursor: number
  hoehe?: number
  zeitVerdeckt?: boolean
  entryPreis?: number
  stopLoss?: number
  takeProfit?: number
  /** Höherer Timeframe in Sekunden (z.B. 14400 für 4h aus 1h-Bars) */
  bucketSek?: number
  /** Kompakt: ohne Volumen (für den Kontext-Chart) */
  kompakt?: boolean
  zeichnungen?: Zeichnung[]
  zeichenModus?: ZeichenModus
  onZeichnung?: (z: Zeichnung) => void
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

const KEINE_ZEICHNUNGEN: Zeichnung[] = []

export function ReplayChart({
  candles,
  cursor,
  hoehe = 460,
  zeitVerdeckt = false,
  entryPreis,
  stopLoss,
  takeProfit,
  bucketSek,
  kompakt = false,
  zeichnungen = KEINE_ZEICHNUNGEN,
  zeichenModus = 'aus',
  onZeichnung,
}: ReplayChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const kerzenRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumenRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const zonenRef = useRef<ZonenPrimitive | null>(null)
  const letzteAnzahlRef = useRef(-1)
  const preisLinienRef = useRef<IPriceLine[]>([])
  const zeichenLinienRef = useRef<IPriceLine[]>([])
  const tempLinieRef = useRef<IPriceLine | null>(null)
  const zeichenModusRef = useRef<ZeichenModus>(zeichenModus)
  const onZeichnungRef = useRef(onZeichnung)
  const ersterKlickRef = useRef<number | null>(null)

  useEffect(() => {
    zeichenModusRef.current = zeichenModus
    onZeichnungRef.current = onZeichnung
    // Moduswechsel bricht eine halb gezeichnete Zone ab
    ersterKlickRef.current = null
    const kerzen = kerzenRef.current
    if (kerzen && tempLinieRef.current) {
      kerzen.removePriceLine(tempLinieRef.current)
      tempLinieRef.current = null
    }
  }, [zeichenModus, onZeichnung])

  // Sichtbare Daten: candles[0..cursor], optional auf den höheren Timeframe aggregiert
  const daten = useMemo(() => {
    const sichtbar = candles.slice(0, cursor + 1)
    return bucketSek ? aggregiere(sichtbar, bucketSek) : sichtbar
  }, [candles, cursor, bucketSek])

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
    let volumen: ISeriesApi<'Histogram'> | null = null
    if (!kompakt) {
      volumen = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volumen',
        priceFormat: { type: 'volume' },
      })
      chart.priceScale('volumen').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    }
    const zonen = new ZonenPrimitive()
    kerzen.attachPrimitive(zonen)

    // Klick → Zeichnung (Linie: 1 Klick, Zone: 2 Klicks). Bewusst ein DOM-Listener statt
    // chart.subscribeClick: der Chart verschluckt den zweiten von zwei schnellen Klicks als
    // Doppelklick — am Handy wäre die Zone damit kaum zu zeichnen.
    const klick = (e: MouseEvent) => {
      const modus = zeichenModusRef.current
      if (modus === 'aus') return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // Klicks auf Preis-/Zeitachse ignorieren
      if (x > rect.width - chart.priceScale('right').width()) return
      if (y > rect.height - chart.timeScale().height()) return
      const preis = kerzen.coordinateToPrice(y)
      if (preis === null) return
      const id = `z-${Date.now()}`
      if (modus === 'linie') {
        onZeichnungRef.current?.({ id, typ: 'linie', preis })
        return
      }
      if (ersterKlickRef.current === null) {
        ersterKlickRef.current = preis
        tempLinieRef.current = kerzen.createPriceLine({
          price: preis,
          color: '#F59E0B',
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: false,
          title: 'Zone…',
        })
      } else {
        const a = ersterKlickRef.current
        ersterKlickRef.current = null
        if (tempLinieRef.current) {
          kerzen.removePriceLine(tempLinieRef.current)
          tempLinieRef.current = null
        }
        onZeichnungRef.current?.({
          id,
          typ: 'zone',
          preisVon: Math.min(a, preis),
          preisBis: Math.max(a, preis),
        })
      }
    }
    container.addEventListener('click', klick)

    chartRef.current = chart
    kerzenRef.current = kerzen
    volumenRef.current = volumen
    zonenRef.current = zonen
    letzteAnzahlRef.current = -1 // erzwingt setData im Daten-Effekt

    const beobachter = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    beobachter.observe(container)

    return () => {
      beobachter.disconnect()
      container.removeEventListener('click', klick)
      chart.remove()
      chartRef.current = null
      kerzenRef.current = null
      volumenRef.current = null
      zonenRef.current = null
      preisLinienRef.current = []
      zeichenLinienRef.current = []
      tempLinieRef.current = null
    }
  }, [candles, hoehe, zeitVerdeckt, kompakt, bucketSek])

  // Fortschritt: inkrementell anhängen; die letzte Bar wird immer mit aktualisiert
  // (bei Aggregation wächst sie), bei Sprung zurück alles neu setzen.
  useEffect(() => {
    const kerzen = kerzenRef.current
    const chart = chartRef.current
    if (!kerzen || !chart || daten.length === 0) return
    const volumen = volumenRef.current

    const letzte = letzteAnzahlRef.current
    if (letzte < 0 || daten.length < letzte) {
      kerzen.setData(daten.map(barZuKerze))
      volumen?.setData(daten.map(barZuVolumen))
      const n = daten.length - 1
      chart.timeScale().setVisibleLogicalRange({ from: n - (bucketSek ? 60 : 120), to: n + 8 })
    } else {
      for (let i = Math.max(0, letzte - 1); i < daten.length; i++) {
        kerzen.update(barZuKerze(daten[i]))
        volumen?.update(barZuVolumen(daten[i]))
      }
    }
    letzteAnzahlRef.current = daten.length
  }, [daten, bucketSek])

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
  }, [entryPreis, stopLoss, takeProfit, candles, bucketSek])

  // Zeichnungen: Linien als Preislinien, Zonen über das Primitive
  useEffect(() => {
    const kerzen = kerzenRef.current
    if (!kerzen) return
    for (const linie of zeichenLinienRef.current) kerzen.removePriceLine(linie)
    zeichenLinienRef.current = []
    for (const z of zeichnungen) {
      if (z.typ !== 'linie') continue
      zeichenLinienRef.current.push(
        kerzen.createPriceLine({
          price: z.preis,
          color: '#3B82F6',
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: '',
        }),
      )
    }
    zonenRef.current?.setZonen(
      zeichnungen.flatMap((z) => (z.typ === 'zone' ? [{ preisVon: z.preisVon, preisBis: z.preisBis }] : [])),
    )
  }, [zeichnungen, candles, bucketSek])

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-lg ${zeichenModus !== 'aus' ? 'cursor-crosshair' : ''}`}
    />
  )
}
