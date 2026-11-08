import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Captions, CaptionsOff, Maximize2 } from 'lucide-react'
import { VollbildKnopf, VollbildRahmen } from './Vollbild'
import { useVollbild } from './useVollbild'
import { useSchmal } from '../../hooks/useSchmal'
import {
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  ColorType,
  PriceScaleMode,
  TickMarkType,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { Candle, ChartAnnotation } from '../../types'
import { ema } from '../../engine/indikatoren/ema'
import { preisStellen } from '../../engine/format'
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

export function tickBerlin(time: Time, typ: TickMarkType): string | null {
  const d = alsDatum(time)
  if (!d) return null
  if (typ === TickMarkType.Time || typ === TickMarkType.TimeWithSeconds) return fmtUhr.format(d)
  if (typ === TickMarkType.DayOfMonth) return fmtTag.format(d).replace(',', '')
  if (typ === TickMarkType.Month) return fmtMonat.format(d).replace('.', '')
  return fmtJahr.format(d)
}

/** Zeit im Fadenkreuz/Tooltip, Berliner Zeit („Mi, 06.11., 16:30“) */
export function zeitBerlin(t: Time): string {
  const d = alsDatum(t)
  return d ? fmtVoll.format(d) : String(t)
}

// Einzige Stelle im Projekt, die lightweight-charts direkt anspricht (v5-API!) — neben HandelsChart.
//
// Preisachse links: rechts stehen die aktuellen Kerzen, die soll die Achse nicht verdecken.
// Beschriftungen (Linien-Titel, EMA-Namen, Marker-Texte) lassen sich ausblenden; mit
// `kompakteBeschriftung` starten sie am Handy ausgeblendet und kommen per Tipp auf den Chart
// oder über den Knopf unten rechts.

export const CHART_FARBEN = {
  long: '#22C55E',
  short: '#EF4444',
  hintergrund: '#131722',
  gitter: '#1F2733',
  text: '#8B95A5',
}

/** Seite der Preisachse — alle Serien hängen an dieser Skala */
export const PREISACHSE = 'left'

interface ChartPanelProps {
  candles: Candle[]
  annotationen?: ChartAnnotation[]
  hoehe?: number
  zeigeVolumen?: boolean
  emaPerioden?: number[]
  /** Freiraum rechts in Kerzen — damit Markierungen an der letzten Kerze nicht am Rand kleben */
  randRechts?: number
  /** Anfangs nur die letzten n Kerzen zeigen; der Rest bleibt zum Zurückscrollen und als Vorlauf für die EMAs */
  sichtbar?: number
  /** Uhrzeit an der Zeitachse; bei Tages-/Wochenkerzen (Aktien) aus */
  zeitSichtbar?: boolean
  /** Kerzen (Standard) oder Schlusskurs-Linie */
  typ?: 'kerzen' | 'linie'
  /** logarithmische Preisachse (lange Zeiträume) */
  logSkala?: boolean
  /** Vollbild-Knopf anbieten (Standard ja) */
  vollbild?: boolean
  /** Werkzeugleiste oben im Vollbild (z.B. Zeitraum-Knöpfe) */
  vollbildLeiste?: ReactNode
  /** Am Handy ohne Beschriftungen starten (nur Linien); Lektionen lassen das aus, dort sind die Texte Inhalt */
  kompakteBeschriftung?: boolean
  /** Tipp/Klick auf eine Kerze mit Marker – liefert die Kerzenzeit (Unix-Sekunden) */
  onMarkerTipp?: (time: number) => void
}

export function ChartPanel({
  candles,
  annotationen = [],
  hoehe = 380,
  zeigeVolumen = true,
  emaPerioden,
  randRechts = 0,
  sichtbar,
  zeitSichtbar = true,
  typ = 'kerzen',
  logSkala = false,
  vollbild = true,
  vollbildLeiste,
  kompakteBeschriftung = false,
  onMarkerTipp,
}: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<(() => void) | null>(null)
  const vb = useVollbild()
  const schmal = useSchmal()
  // Preisachse von Hand verändert → Knopf „Ansicht zurücksetzen“ einblenden
  const [manuell, setManuell] = useState(false)
  // Beschriftungen an/aus — ohne Neuaufbau des Charts (Zoom und Ansicht bleiben)
  const [beschriftet, setBeschriftet] = useState(() => !(kompakteBeschriftung && schmal))
  const beschriftetRef = useRef(beschriftet)
  const beschriftungRef = useRef<((an: boolean) => void) | null>(null)
  const onMarkerTippRef = useRef(onMarkerTipp)
  useEffect(() => {
    onMarkerTippRef.current = onMarkerTipp
  }, [onMarkerTipp])
  // Zeitpunkt des letzten Marker-Tipps: der Finger-Tipp soll dann nicht zusätzlich die Beschriftung umschalten
  const markerTippAmRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container || candles.length === 0) return

    const chart = createChart(container, {
      height: container.clientHeight || hoehe,
      layout: {
        background: { type: ColorType.Solid, color: CHART_FARBEN.hintergrund },
        textColor: CHART_FARBEN.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        // am Handy kleinere Achsenschrift → schmalere Preisachse, mehr Platz für Kerzen
        fontSize: schmal ? 9 : 12,
      },
      grid: {
        vertLines: { color: CHART_FARBEN.gitter },
        horzLines: { color: CHART_FARBEN.gitter },
      },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: true, borderColor: CHART_FARBEN.gitter, mode: logSkala ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal },
      timeScale: { borderColor: CHART_FARBEN.gitter, timeVisible: zeitSichtbar, ...(zeitSichtbar ? { tickMarkFormatter: tickBerlin } : {}) },
      ...(zeitSichtbar
        ? { localization: { locale: 'de-DE', timeFormatter: zeitBerlin } }
        : {}),
      crosshair: { mode: 0 },
      // Am Handy soll vertikales Wischen mit einem Finger die Seite scrollen, nicht den Chart;
      // Zwei-Finger-Gesten, Achsen-Zug und Doppeltipp übernimmt ./gesten.ts (Pinch der Bibliothek aus)
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: false },
    })
    ;(container as HTMLDivElement & { __chart?: IChartApi }).__chart = chart

    let kerzenSerie: ISeriesApi<SeriesType>
    if (typ === 'linie') {
      const linie = chart.addSeries(LineSeries, { priceScaleId: PREISACHSE, color: '#3B82F6', lineWidth: 2, priceLineVisible: true, lastValueVisible: true })
      linie.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })))
      kerzenSerie = linie
    } else {
      // Nachkommastellen nach Kursniveau (Bitcoin 84840,1 statt 84840,05) → schmalere Preisachse
      const stellen = preisStellen(candles[candles.length - 1].close)
      const kerzen = chart.addSeries(CandlestickSeries, {
        priceScaleId: PREISACHSE,
        upColor: CHART_FARBEN.long,
        downColor: CHART_FARBEN.short,
        borderVisible: false,
        wickUpColor: CHART_FARBEN.long,
        wickDownColor: CHART_FARBEN.short,
        priceFormat: { type: 'price', precision: stellen, minMove: 10 ** -stellen },
      })
      kerzen.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      )
      kerzenSerie = kerzen
    }

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

    // Alles, was einen Text trägt, merken — für das Ein-/Ausblenden der Beschriftung
    const beschriftete: { setze: (an: boolean) => void }[] = []

    if (emaPerioden) {
      emaPerioden.forEach((periode, idx) => {
        const werte = ema(candles, periode)
        const titel = `EMA ${periode}`
        const serie = chart.addSeries(LineSeries, {
          priceScaleId: PREISACHSE,
          color: EMA_FARBEN[idx % EMA_FARBEN.length],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          title: titel,
        })
        serie.setData(
          candles
            .map((c, i) => ({ time: c.time as UTCTimestamp, value: werte[i] }))
            .filter((p) => Number.isFinite(p.value)),
        )
        beschriftete.push({ setze: (an) => serie.applyOptions({ title: an ? titel : '' }) })
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
        const titel = a.text ?? ''
        const linie: IPriceLine = kerzenSerie.createPriceLine({
          price: a.preis,
          color: a.farbe ?? '#F59E0B',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: titel,
        })
        if (titel) beschriftete.push({ setze: (an) => linie.applyOptions({ title: an ? titel : '' }) })
      }
    }
    if (marker.length > 0) {
      marker.sort((a, b) => (a.time as number) - (b.time as number))
      const plugin: ISeriesMarkersPluginApi<Time> = createSeriesMarkers(kerzenSerie, marker)
      beschriftete.push({ setze: (an) => plugin.setMarkers(an ? marker : marker.map((m) => ({ ...m, text: '' }))) })
    }
    // Klick/Tipp auf eine Kerze mit Marker → Signal-Info in der Karte
    const markerZeiten = new Set(marker.map((m) => m.time as number))
    chart.subscribeClick((param) => {
      if (typeof param.time !== 'number' || !markerZeiten.has(param.time)) return
      markerTippAmRef.current = performance.now()
      onMarkerTippRef.current?.(param.time)
    })
    const beschriftungAnwenden = (an: boolean) => {
      for (const b of beschriftete) b.setze(an)
    }
    beschriftungRef.current = beschriftungAnwenden
    beschriftungAnwenden(beschriftetRef.current)

    const ansichtEinpassen = () => {
      chart.priceScale(PREISACHSE).setAutoScale(true)
      const von = sichtbar && sichtbar < candles.length ? candles.length - sichtbar - 0.5 : -0.5
      if (von > -0.5 || randRechts > 0) {
        chart.timeScale().setVisibleLogicalRange({ from: von, to: candles.length - 0.5 + randRechts })
      } else {
        chart.timeScale().fitContent()
      }
    }
    ansichtEinpassen()
    setManuell(false)
    resetRef.current = () => {
      ansichtEinpassen()
      setManuell(false)
    }
    const gestenWeg = installiereGesten(chart, container, {
      serie: kerzenSerie,
      achse: PREISACHSE,
      reset: ansichtEinpassen,
      onManuell: setManuell,
      // Ein Tipp mit dem Finger: Beschriftungen ein-/ausblenden – außer der Tipp galt einem Marker
      onTipp: () => {
        if (performance.now() - markerTippAmRef.current < 600) return
        setBeschriftet((b) => !b)
      },
    })

    const beobachter = new ResizeObserver(() => {
      // Höhe kommt vom Container (Prop „hoehe“ oder Vollbild-Rahmen), Breite vom Layout
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight || undefined })
    })
    beobachter.observe(container)

    return () => {
      beobachter.disconnect()
      gestenWeg()
      resetRef.current = null
      beschriftungRef.current = null
      chart.remove()
    }
  }, [candles, annotationen, hoehe, zeigeVolumen, emaPerioden, randRechts, sichtbar, zeitSichtbar, typ, logSkala, schmal])

  useEffect(() => {
    beschriftetRef.current = beschriftet
    beschriftungRef.current?.(beschriftet)
  }, [beschriftet])

  const knopf = 'tipp absolute z-[3] rounded-md border border-rand bg-nacht/80 p-1.5 text-gedimmt hover:text-white'

  return (
    <VollbildRahmen hoehe={hoehe} steuerung={vb} leiste={vollbildLeiste}>
      {(h, imVollbild) => (
        <>
          <div ref={containerRef} style={{ height: h }} className={`w-full overflow-hidden ${imVollbild ? '' : 'rounded-lg'}`} />
          {manuell && (
            <button
              type="button"
              onClick={() => resetRef.current?.()}
              className="absolute right-2 top-2 z-[3] inline-flex min-h-9 items-center gap-1 rounded-md border border-rand bg-nacht/80 px-2 text-[11px] font-semibold text-gedimmt hover:text-white"
              title="Ansicht zurücksetzen (auch per Doppeltipp auf den Chart)"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Auto
            </button>
          )}
          <button
            type="button"
            onClick={() => setBeschriftet((b) => !b)}
            className={`${knopf} bottom-9 right-2`}
            title={beschriftet ? 'Beschriftungen ausblenden (auch per Tipp auf den Chart)' : 'Beschriftungen einblenden (auch per Tipp auf den Chart)'}
            aria-pressed={beschriftet}
            aria-label="Beschriftungen"
          >
            {beschriftet ? <Captions className="h-3.5 w-3.5" /> : <CaptionsOff className="h-3.5 w-3.5" />}
          </button>
          {vollbild && <VollbildKnopf an={imVollbild} onClick={vb.umschalten} className="absolute bottom-9 right-[38px]" />}
        </>
      )}
    </VollbildRahmen>
  )
}
