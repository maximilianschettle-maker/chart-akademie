import { useEffect, useMemo, useRef } from 'react'
import { Crosshair } from 'lucide-react'
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type Logical,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle, Zeichnung } from '../../types'
import { CHART_FARBEN } from './ChartPanel'
import { aggregiere, bucketStart, intervalSekunden } from '../../engine/aggregation'
import { ema } from '../../engine/indikatoren/ema'
import { rsi } from '../../engine/indikatoren/rsi'
import { fmtPreis, preisStellen, rundePreis } from '../../engine/format'
import { ZeichenPrimitive, type Messung, type Punkt } from './zeichenPrimitive'

// Chart für Replay und Simulator. Hängt neue Bars per series.update() an, statt
// bei jedem Schritt neu zu rendern, und wird nur einmal pro Mount aufgebaut —
// Timeframe-Wechsel, Indikatoren und nachgeladene Kerzen lassen Zoom und
// Zeichnungen in Ruhe. Preislinien (Entry/SL/TP) sind mit Maus oder Finger ziehbar.

export type ZeichenModus = 'aus' | 'linie' | 'zone' | 'trend' | 'messen'

export interface ChartLinie {
  id: string
  preis: number
  farbe: string
  titel: string
  ziehbar?: boolean
  /** durchgezogen statt gestrichelt (z.B. der Einstieg einer offenen Position) */
  fest?: boolean
  /** in die Auto-Skalierung einbeziehen, damit SL/TP nicht außerhalb des Bildes liegen */
  imBlick?: boolean
  /** Linienstil, wenn nicht `fest`: gestrichelt (Standard) oder gepunktet (z.B. Ideal-Trade) */
  stil?: 'gestrichelt' | 'gepunktet'
}

export interface ChartMarker {
  time: number
  /** long/short: Einstiegspfeil · exit: Kreis mit R · hinweis: neutrales Quadrat mit Text (Ideal-Entry, Trigger …) */
  art: 'long' | 'short' | 'exit' | 'hinweis'
  text?: string
  gewinn?: boolean
  /** nur hinweis: Farbe und Lage (oben = über der Kerze) */
  farbe?: string
  oben?: boolean
}

/** Halbtransparente Box Preiszone × Zeitraum (z.B. Entry-Fenster) */
export interface ChartBox {
  id: string
  zeitVon: number
  zeitBis: number
  preisVon: number
  preisBis: number
  fuellung: string
  rand: string
}

export interface IndikatorWahl {
  ema: number[]
  rsi: boolean
  volumen: boolean
}

interface HandelsChartProps {
  candles: Candle[]
  cursor: number
  hoehe?: number
  zeitVerdeckt?: boolean
  /** Höherer Timeframe in Sekunden (z.B. 14400 für 4h aus 1h-Bars); leer = Basis-Intervall */
  bucketSek?: number
  /** Kompakt: ohne Volumen, Legende und Indikatoren (für den Kontext-Chart) */
  kompakt?: boolean
  zeichnungen?: Zeichnung[]
  zeichenModus?: ZeichenModus
  onZeichnung?: (z: Zeichnung) => void
  linien?: ChartLinie[]
  /** läuft während des Ziehens bei jeder Bewegung */
  onLinieZiehen?: (id: string, preis: number) => void
  /** einmal beim Loslassen */
  onLinieLos?: (id: string, preis: number) => void
  /** gesetzt → der nächste Tipp in den Chart liefert einen Preis (statt zu zeichnen) */
  onPick?: ((preis: number) => void) | null
  marker?: ChartMarker[]
  boxen?: ChartBox[]
  indikatoren?: IndikatorWahl
}

const EMA_FARBEN: Record<number, string> = { 20: '#F59E0B', 50: '#3B82F6', 200: '#A855F7' }
const KEINE_ZEICHNUNGEN: Zeichnung[] = []
const KEINE_LINIEN: ChartLinie[] = []
const KEINE_MARKER: ChartMarker[] = []
const KEINE_BOXEN: ChartBox[] = []
const STANDARD_INDIKATOREN: IndikatorWahl = { ema: [], rsi: false, volumen: true }

const SCROLL_AN = { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }
const SCROLL_AUS = { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false }
const SKALA_AN = { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
const SKALA_AUS = { axisPressedMouseMove: false, mouseWheel: false, pinch: false }

function barZuKerze(c: Candle) {
  return { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }
}

function barZuVolumen(c: Candle) {
  return {
    time: c.time as UTCTimestamp,
    value: c.volume,
    color: c.close >= c.open ? '#22C55E55' : '#EF444455',
  }
}

function linienPunkte(daten: Candle[], werte: number[], ab = 0) {
  const punkte: { time: UTCTimestamp; value: number }[] = []
  for (let i = ab; i < daten.length; i++) {
    if (Number.isFinite(werte[i])) punkte.push({ time: daten[i].time as UTCTimestamp, value: werte[i] })
  }
  return punkte
}

interface OhlcPunkt {
  open: number
  high: number
  low: number
  close: number
}

/** Legende oben links: OHLC der Kerze unter dem Fadenkreuz, sonst der letzten Kerze. */
function legendeSetzen(el: HTMLDivElement | null, c: OhlcPunkt | null) {
  if (!el) return
  if (!c) {
    el.textContent = ''
    return
  }
  const diff = c.open !== 0 ? ((c.close - c.open) / c.open) * 100 : 0
  el.textContent = `O ${fmtPreis(c.open, c.close)}  H ${fmtPreis(c.high, c.close)}  L ${fmtPreis(c.low, c.close)}  C ${fmtPreis(c.close)}  ${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(2)} %`
  el.style.color = diff >= 0 ? CHART_FARBEN.long : CHART_FARBEN.short
}

export function HandelsChart({
  candles,
  cursor,
  hoehe = 460,
  zeitVerdeckt = false,
  bucketSek,
  kompakt = false,
  zeichnungen = KEINE_ZEICHNUNGEN,
  zeichenModus = 'aus',
  onZeichnung,
  linien = KEINE_LINIEN,
  onLinieZiehen,
  onLinieLos,
  onPick = null,
  marker = KEINE_MARKER,
  boxen = KEINE_BOXEN,
  indikatoren = STANDARD_INDIKATOREN,
}: HandelsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const legendeRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const kerzenRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumenRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const emaRef = useRef(new Map<number, ISeriesApi<'Line'>>())
  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null)
  const markerRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const zonenRef = useRef<ZeichenPrimitive | null>(null)
  // Was gerade im Chart liegt (ggf. aggregiert) — für Zeit ↔ x der Zeichnungen
  const datenRef = useRef<Candle[]>([])
  // Halb fertige Trendlinie bzw. Messung: erster Punkt gesetzt, zweiter fehlt noch
  const ankerRef = useRef<Punkt | null>(null)
  const messRef = useRef<{ a: Punkt; fest: boolean } | null>(null)
  const linienRef = useRef(new Map<string, { linie: IPriceLine; def: ChartLinie }>())
  const zeichenLinienRef = useRef<IPriceLine[]>([])
  const tempLinieRef = useRef<IPriceLine | null>(null)
  const ersterKlickRef = useRef<number | null>(null)
  // Stand des Daten-Effekts: was liegt gerade im Chart?
  const standRef = useRef({ anzahl: -1, bucket: -1, basis: -1, serien: '' })
  const letzteBarRef = useRef<Candle | null>(null)
  const fadenkreuzRef = useRef<() => boolean>(() => false)
  // Immer aktuelle Props für die DOM-Listener, die nur einmal registriert werden
  const propsRef = useRef({ zeichenModus, onZeichnung, onLinieZiehen, onLinieLos, onPick })
  useEffect(() => {
    propsRef.current = { zeichenModus, onZeichnung, onLinieZiehen, onLinieLos, onPick }
  })

  // Moduswechsel bricht halb Gezeichnetes ab und räumt die Messung weg
  useEffect(() => {
    ersterKlickRef.current = null
    ankerRef.current = null
    messRef.current = null
    zonenRef.current?.setAnker(null)
    zonenRef.current?.setMessung(null)
    const kerzen = kerzenRef.current
    if (kerzen && tempLinieRef.current) {
      kerzen.removePriceLine(tempLinieRef.current)
      tempLinieRef.current = null
    }
  }, [zeichenModus, onPick])

  // Sichtbare Daten: candles[0..cursor], optional auf den höheren Timeframe aggregiert —
  // die letzte HTF-Kerze wächst mit jedem Schritt (kein Blick in die Zukunft).
  const daten = useMemo(() => {
    const sichtbar = candles.slice(0, cursor + 1)
    return bucketSek ? aggregiere(sichtbar, bucketSek) : sichtbar
  }, [candles, cursor, bucketSek])

  // ── Chart einmal pro Mount aufbauen ────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      height: container.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: CHART_FARBEN.hintergrund },
        textColor: CHART_FARBEN.text,
        fontFamily: 'Inter, system-ui, sans-serif',
        panes: { separatorColor: CHART_FARBEN.gitter, enableResize: false },
      },
      grid: {
        vertLines: { color: CHART_FARBEN.gitter },
        horzLines: { color: CHART_FARBEN.gitter },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART_FARBEN.gitter },
      timeScale: { borderColor: CHART_FARBEN.gitter, rightOffset: 6 },
      handleScroll: SCROLL_AN,
      handleScale: SKALA_AN,
    })

    const kerzen = chart.addSeries(CandlestickSeries, {
      upColor: CHART_FARBEN.long,
      downColor: CHART_FARBEN.short,
      borderVisible: false,
      wickUpColor: CHART_FARBEN.long,
      wickDownColor: CHART_FARBEN.short,
      // SL/TP/Entry gehören ins Bild: Preisbereich um die markierten Linien erweitern —
      // aber nur, wenn sie nicht absurd weit weg liegen (sonst wird der Chart platt).
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original()
        if (!info || !info.priceRange) return info
        let { minValue, maxValue } = info.priceRange
        const spanne = Math.max(maxValue - minValue, 1e-9)
        for (const { def } of linienRef.current.values()) {
          if (!def.imBlick) continue
          if (def.preis < minValue - 2 * spanne || def.preis > maxValue + 2 * spanne) continue
          minValue = Math.min(minValue, def.preis)
          maxValue = Math.max(maxValue, def.preis)
        }
        return { ...info, priceRange: { minValue, maxValue } }
      },
    })
    const zonen = new ZeichenPrimitive()
    kerzen.attachPrimitive(zonen)

    // Index der Kerze, die diesen Zeitpunkt enthält (im höheren Timeframe: ihr Bucket)
    const indexZuZeit = (zeit: number): number | null => {
      const d = datenRef.current
      if (d.length === 0 || zeit < d[0].time) return null
      let lo = 0
      let hi = d.length - 1
      while (lo < hi) {
        const mitte = (lo + hi + 1) >> 1
        if (d[mitte].time <= zeit) lo = mitte
        else hi = mitte - 1
      }
      return lo
    }
    zonen.zeitZuX = (zeit) => {
      const index = indexZuZeit(zeit)
      return index === null ? null : chart.timeScale().logicalToCoordinate(index as Logical)
    }
    /** Punkt (Zeit, Preis) unter einer Chart-Koordinate — rechts vom letzten Balken zählt der letzte. */
    const punktBei = (x: number, preis: number): Punkt | null => {
      const d = datenRef.current
      const logisch = chart.timeScale().coordinateToLogical(x)
      if (logisch === null || d.length === 0) return null
      const index = Math.max(0, Math.min(d.length - 1, Math.round(logisch)))
      return { zeit: d[index].time, preis }
    }
    const messungAus = (a: Punkt, b: Punkt): Messung => {
      const diff = b.preis - a.preis
      const prozent = a.preis !== 0 ? (diff / a.preis) * 100 : 0
      const kerzen_ = Math.abs((indexZuZeit(b.zeit) ?? 0) - (indexZuZeit(a.zeit) ?? 0))
      const vz = diff >= 0 ? '+' : '−'
      const p = Math.abs(prozent).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return {
        a,
        b,
        text: `${vz}${p} %  ·  ${vz}${fmtPreis(Math.abs(diff), a.preis)}  ·  ${kerzen_} ${kerzen_ === 1 ? 'Kerze' : 'Kerzen'}`,
        positiv: diff >= 0,
      }
    }

    chartRef.current = chart
    kerzenRef.current = kerzen
    zonenRef.current = zonen
    markerRef.current = createSeriesMarkers(kerzen, [])
    standRef.current = { anzahl: -1, bucket: -1, basis: -1, serien: '' }
    const linienMap = linienRef.current
    const emaMap = emaRef.current

    // ── Legende (OHLC unter dem Fadenkreuz, sonst letzte Kerze) ──────────────
    let fadenkreuzAktiv = false
    chart.subscribeCrosshairMove((param) => {
      const punkt = param.seriesData.get(kerzen) as OhlcPunkt | undefined
      fadenkreuzAktiv = !!punkt
      legendeSetzen(legendeRef.current, punkt ?? letzteBarRef.current)
    })
    fadenkreuzRef.current = () => fadenkreuzAktiv

    // ── Linien ziehen ────────────────────────────────────────────────────────
    // Capture-Phase am Container: Wir sind vor den Listenern des Charts dran und
    // können dessen Scrollen/Zoomen für die Dauer des Ziehens abklemmen.
    let zug: { id: string; pointerId: number; preis: number; bewegt: boolean } | null = null
    // Tipp-Erkennung über Pointer-Events statt „click“: Der Chart ruft bei Touch
    // preventDefault auf, dann feuert am Handy gar kein click mehr.
    let tipp: { pointerId: number; x: number; y: number; zeit: number } | null = null

    const yVon = (e: { clientY: number }) => e.clientY - container.getBoundingClientRect().top

    const trefferLinie = (y: number, toleranz: number): string | null => {
      let bester: { id: string; abstand: number } | null = null
      for (const [id, { def }] of linienMap) {
        if (!def.ziehbar) continue
        const ly = kerzen.priceToCoordinate(def.preis)
        if (ly === null) continue
        const abstand = Math.abs(ly - y)
        if (abstand <= toleranz && (!bester || abstand < bester.abstand)) bester = { id, abstand }
      }
      return bester?.id ?? null
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const id = trefferLinie(yVon(e), e.pointerType === 'mouse' ? 7 : 20)
      const def = id ? linienMap.get(id)?.def : undefined
      if (!id || !def) {
        tipp = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, zeit: performance.now() }
        return
      }
      tipp = null
      zug = { id, pointerId: e.pointerId, preis: def.preis, bewegt: false }
      e.stopPropagation()
      e.preventDefault()
      container.setPointerCapture(e.pointerId)
      chart.applyOptions({ handleScroll: SCROLL_AUS, handleScale: SKALA_AUS })
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!zug) {
        if (e.pointerType === 'mouse') {
          container.classList.toggle('linie-greifbar', trefferLinie(yVon(e), 7) !== null)
          // Messung folgt der Maus, bis der zweite Punkt gesetzt ist
          const mess = messRef.current
          if (mess && !mess.fest && propsRef.current.zeichenModus === 'messen') {
            const roh = kerzen.coordinateToPrice(yVon(e))
            const punkt = roh !== null && roh > 0 ? punktBei(e.clientX - container.getBoundingClientRect().left, rundePreis(roh)) : null
            if (punkt) zonen.setMessung(messungAus(mess.a, punkt))
          }
        }
        return
      }
      if (e.pointerId !== zug.pointerId) return
      e.stopPropagation()
      const roh = kerzen.coordinateToPrice(yVon(e))
      if (roh === null || roh <= 0) return
      const preis = rundePreis(roh)
      zug.preis = preis
      zug.bewegt = true
      linienMap.get(zug.id)?.linie.applyOptions({ price: preis })
      propsRef.current.onLinieZiehen?.(zug.id, preis)
    }

    const onPointerEnde = (e: PointerEvent) => {
      if (!zug) {
        const t = tipp
        tipp = null
        if (!t || e.type !== 'pointerup' || e.pointerId !== t.pointerId) return
        const weit = Math.hypot(e.clientX - t.x, e.clientY - t.y)
        if (weit <= 10 && performance.now() - t.zeit <= 700) tippen(e.clientX, e.clientY)
        return
      }
      if (e.pointerId !== zug.pointerId) return
      const { id, preis, bewegt } = zug
      zug = null
      e.stopPropagation()
      if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId)
      chart.applyOptions({ handleScroll: SCROLL_AN, handleScale: SKALA_AN })
      if (!bewegt) return
      // Zurück auf den Prop-Wert — der Eigentümer entscheidet, ob der neue Preis gilt
      const eintrag = linienMap.get(id)
      eintrag?.linie.applyOptions({ price: eintrag.def.preis })
      propsRef.current.onLinieLos?.(id, preis)
    }

    // Maus-/Touch-Ereignisse des Charts unterdrücken, solange gezogen wird
    const schlucken = (e: Event) => {
      if (!zug) return
      e.stopPropagation()
      if (e.cancelable) e.preventDefault()
    }

    // Tipp → Preis wählen, zeichnen oder messen (Linie: 1 Tipp, sonst 2 Tipps). Bewusst nicht
    // chart.subscribeClick: der Chart verschluckt den zweiten von zwei schnellen Klicks
    // als Doppelklick — am Handy wäre die Zone damit kaum zu zeichnen.
    const tippen = (clientX: number, clientY: number) => {
      const { zeichenModus: modus, onPick: pick, onZeichnung: melden } = propsRef.current
      if (!pick && modus === 'aus') return
      const rect = container.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      // Klicks auf Preis-/Zeitachse ignorieren
      if (x > rect.width - chart.priceScale('right').width()) return
      if (y > rect.height - chart.timeScale().height()) return
      const roh = kerzen.coordinateToPrice(y)
      if (roh === null || roh <= 0) return
      const preis = rundePreis(roh)
      if (pick) {
        pick(preis)
        return
      }
      const id = `z-${Date.now()}`
      if (modus === 'linie') {
        melden?.({ id, typ: 'linie', preis })
        return
      }
      if (modus === 'trend' || modus === 'messen') {
        const punkt = punktBei(x, preis)
        if (!punkt) return
        if (modus === 'messen') {
          const mess = messRef.current
          if (!mess || mess.fest) {
            // erster Punkt (oder neue Messung)
            messRef.current = { a: punkt, fest: false }
            zonen.setMessung(null)
            zonen.setAnker(punkt)
          } else {
            mess.fest = true
            zonen.setAnker(null)
            zonen.setMessung(messungAus(mess.a, punkt))
          }
          return
        }
        const a = ankerRef.current
        if (!a) {
          ankerRef.current = punkt
          zonen.setAnker(punkt)
          return
        }
        if (a.zeit === punkt.zeit) return // zwei Punkte auf derselben Kerze ergeben keine Linie
        const [links, rechts] = a.zeit < punkt.zeit ? [a, punkt] : [punkt, a]
        ankerRef.current = null
        zonen.setAnker(null)
        melden?.({ id, typ: 'trend', t1: links.zeit, p1: links.preis, t2: rechts.zeit, p2: rechts.preis })
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
        melden?.({ id, typ: 'zone', preisVon: Math.min(a, preis), preisBis: Math.max(a, preis) })
      }
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('pointermove', onPointerMove, true)
    container.addEventListener('pointerup', onPointerEnde, true)
    container.addEventListener('pointercancel', onPointerEnde, true)
    container.addEventListener('mousedown', schlucken, true)
    container.addEventListener('touchstart', schlucken, { capture: true, passive: false })
    container.addEventListener('touchmove', schlucken, { capture: true, passive: false })

    const beobachter = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth })
    })
    beobachter.observe(container)

    return () => {
      beobachter.disconnect()
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('pointermove', onPointerMove, true)
      container.removeEventListener('pointerup', onPointerEnde, true)
      container.removeEventListener('pointercancel', onPointerEnde, true)
      container.removeEventListener('mousedown', schlucken, true)
      container.removeEventListener('touchstart', schlucken, true)
      container.removeEventListener('touchmove', schlucken, true)
      chart.remove()
      chartRef.current = null
      kerzenRef.current = null
      volumenRef.current = null
      rsiRef.current = null
      markerRef.current = null
      zonenRef.current = null
      emaMap.clear()
      linienMap.clear()
      zeichenLinienRef.current = []
      tempLinieRef.current = null
    }
  }, [])

  // ── Größe und Zeitachse ────────────────────────────────────────────────────
  useEffect(() => {
    chartRef.current?.applyOptions({
      height: hoehe,
      timeScale: { visible: !zeitVerdeckt, timeVisible: !zeitVerdeckt },
    })
  }, [hoehe, zeitVerdeckt])

  // ── Indikator-Serien an die Auswahl anpassen ───────────────────────────────
  const emaWahl = kompakt ? '' : indikatoren.ema.join(',')
  const mitRsi = !kompakt && indikatoren.rsi
  const mitVolumen = !kompakt && indikatoren.volumen
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const perioden = emaWahl ? emaWahl.split(',').map(Number) : []

    for (const [periode, serie] of emaRef.current) {
      if (!perioden.includes(periode)) {
        chart.removeSeries(serie)
        emaRef.current.delete(periode)
      }
    }
    for (const periode of perioden) {
      if (emaRef.current.has(periode)) continue
      emaRef.current.set(
        periode,
        chart.addSeries(LineSeries, {
          color: EMA_FARBEN[periode] ?? '#94A3B8',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        }),
      )
    }

    if (mitVolumen && !volumenRef.current) {
      volumenRef.current = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volumen',
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      })
      chart.priceScale('volumen').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    } else if (!mitVolumen && volumenRef.current) {
      chart.removeSeries(volumenRef.current)
      volumenRef.current = null
    }

    if (mitRsi && !rsiRef.current) {
      const serie = chart.addSeries(
        LineSeries,
        { color: '#A78BFA', lineWidth: 1, priceLineVisible: false, lastValueVisible: true },
        1,
      )
      for (const [preis, farbe] of [
        [70, CHART_FARBEN.short],
        [30, CHART_FARBEN.long],
      ] as const) {
        serie.createPriceLine({ price: preis, color: farbe, lineWidth: 1, lineStyle: 3, axisLabelVisible: false, title: '' })
      }
      chart.panes()[1]?.setHeight(90)
      rsiRef.current = serie
    } else if (!mitRsi && rsiRef.current) {
      chart.removeSeries(rsiRef.current)
      rsiRef.current = null
    }
  }, [emaWahl, mitRsi, mitVolumen])

  // ── Daten: inkrementell anhängen; die letzte Bar wird immer mit aktualisiert
  // (bei Aggregation wächst sie). Voller Neuaufbau nur bei Timeframe-Wechsel,
  // geänderter Indikator-Auswahl oder einem Sprung zurück.
  const serienSignatur = `${emaWahl}|${mitRsi}|${mitVolumen}`
  useEffect(() => {
    const kerzen = kerzenRef.current
    const chart = chartRef.current
    if (!kerzen || !chart || daten.length === 0) return
    datenRef.current = daten
    const stand = standRef.current
    const bucket = bucketSek ?? 0
    // Basis-Intervall der Rohdaten: wechselt es (Hauptkerzen ↔ Unterkerzen), muss der Chart neu aufgebaut werden
    const basis = intervalSekunden(candles)
    const n = daten.length - 1
    const letzte = daten[n]
    letzteBarRef.current = letzte

    const emaWerte = [...emaRef.current].map(([periode, serie]) => ({ serie, werte: ema(daten, periode) }))
    const rsiWerte = rsiRef.current ? rsi(daten, 14) : null

    const neuerTimeframe = stand.anzahl < 0 || stand.bucket !== bucket || stand.basis !== basis
    if (neuerTimeframe || daten.length < stand.anzahl || stand.serien !== serienSignatur) {
      const stellen = preisStellen(letzte.close)
      kerzen.applyOptions({ priceFormat: { type: 'price', precision: stellen, minMove: 10 ** -stellen } })
      kerzen.setData(daten.map(barZuKerze))
      volumenRef.current?.setData(daten.map(barZuVolumen))
      for (const { serie, werte } of emaWerte) serie.setData(linienPunkte(daten, werte))
      if (rsiWerte) rsiRef.current?.setData(linienPunkte(daten, rsiWerte))
      if (neuerTimeframe) {
        const breite = containerRef.current?.clientWidth ?? 800
        const sichtbar = Math.min(220, Math.max(60, Math.round(breite / 7)))
        chart.timeScale().setVisibleLogicalRange({ from: n - sichtbar, to: n + 8 })
      }
    } else {
      const ab = Math.max(0, stand.anzahl - 1)
      for (let i = ab; i < daten.length; i++) {
        kerzen.update(barZuKerze(daten[i]))
        volumenRef.current?.update(barZuVolumen(daten[i]))
      }
      for (const { serie, werte } of emaWerte) {
        for (const punkt of linienPunkte(daten, werte, ab)) serie.update(punkt)
      }
      if (rsiWerte) for (const punkt of linienPunkte(daten, rsiWerte, ab)) rsiRef.current?.update(punkt)
    }
    standRef.current = { anzahl: daten.length, bucket, basis, serien: serienSignatur }

    if (!fadenkreuzRef.current()) legendeSetzen(legendeRef.current, letzte)
  }, [daten, candles, bucketSek, serienSignatur])

  // ── Preislinien (Entry/SL/TP …): per Id abgleichen statt neu aufzubauen ────
  useEffect(() => {
    const kerzen = kerzenRef.current
    if (!kerzen) return
    const map = linienRef.current
    const gesehen = new Set<string>()
    for (const def of linien) {
      if (!(def.preis > 0)) continue
      gesehen.add(def.id)
      const optionen = {
        price: def.preis,
        color: def.farbe,
        lineWidth: def.ziehbar ? 2 : 1,
        lineStyle: def.fest ? 0 : def.stil === 'gepunktet' ? 1 : 2,
        axisLabelVisible: true,
        title: def.titel,
      } as const
      const vorhanden = map.get(def.id)
      if (vorhanden) {
        vorhanden.linie.applyOptions(optionen)
        vorhanden.def = def
      } else {
        map.set(def.id, { linie: kerzen.createPriceLine(optionen), def })
      }
    }
    for (const [id, eintrag] of map) {
      if (gesehen.has(id)) continue
      kerzen.removePriceLine(eintrag.linie)
      map.delete(id)
    }
    // Auto-Skalierung neu rechnen lassen (der Provider liest die Linien)
    const skala = chartRef.current?.priceScale('right')
    if (skala?.options().autoScale) skala.applyOptions({ autoScale: true })
  }, [linien])

  // ── Trade-Marker ───────────────────────────────────────────────────────────
  useEffect(() => {
    const plugin = markerRef.current
    if (!plugin) return
    // Trade-Zeiten stammen aus Unterkerzen (Intrabar) → auf die Kerze des angezeigten Intervalls einrasten
    const rasterSek = bucketSek ?? intervalSekunden(datenRef.current)
    const liste: SeriesMarker<Time>[] = marker
      .map((m) => ({ ...m, time: bucketStart(m.time, rasterSek) }))
      .sort((a, b) => a.time - b.time)
      .map((m) => {
        if (m.art === 'hinweis') {
          return {
            time: m.time as UTCTimestamp,
            position: m.oben ? ('aboveBar' as const) : ('belowBar' as const),
            shape: 'square' as const,
            color: m.farbe ?? '#3B82F6',
            text: m.text ?? '',
            size: 0.7,
          }
        }
        if (m.art === 'exit') {
          return {
            time: m.time as UTCTimestamp,
            position: 'aboveBar' as const,
            shape: 'circle' as const,
            color: m.gewinn ? CHART_FARBEN.long : CHART_FARBEN.short,
            text: m.text ?? '',
            size: 0.8,
          }
        }
        const long = m.art === 'long'
        return {
          time: m.time as UTCTimestamp,
          position: long ? ('belowBar' as const) : ('aboveBar' as const),
          shape: long ? ('arrowUp' as const) : ('arrowDown' as const),
          color: long ? CHART_FARBEN.long : CHART_FARBEN.short,
          text: m.text ?? '',
        }
      })
    plugin.setMarkers(liste)
  }, [marker, bucketSek])

  // ── Zeichnungen: Linien als Preislinien, Zonen über das Primitive ──────────
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
    zonenRef.current?.setTrendlinien(
      zeichnungen.flatMap((z) =>
        z.typ === 'trend' ? [{ a: { zeit: z.t1, preis: z.p1 }, b: { zeit: z.t2, preis: z.p2 } }] : [],
      ),
    )
  }, [zeichnungen])

  // ── Boxen (Entry-Fenster der Review) über das Primitive ───────────────────
  useEffect(() => {
    zonenRef.current?.setBoxen(boxen)
  }, [boxen])

  const waehltPreis = !!onPick || zeichenModus !== 'aus'

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{ height: hoehe }}
        className={`w-full overflow-hidden rounded-lg ${waehltPreis ? 'chart-waehlt' : ''}`}
      />
      {!kompakt && (
        <>
          <div
            ref={legendeRef}
            className="tabular-nums pointer-events-none absolute left-2 top-1.5 z-[3] whitespace-pre text-[10px] font-medium sm:text-[11px]"
          />
          <button
            onClick={() => chartRef.current?.timeScale().scrollToRealTime()}
            className={`absolute right-[76px] z-[3] rounded-md border border-rand bg-nacht/80 p-1.5 text-gedimmt hover:text-white ${zeitVerdeckt ? 'bottom-2' : 'bottom-9'}`}
            title="Zur aktuellen Kerze springen"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
