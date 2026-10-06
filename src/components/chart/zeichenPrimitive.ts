import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'
import type { CanvasRenderingTarget2D } from 'fancy-canvas'

// Series-Primitive (lightweight-charts v5 Plugin-API) für alles, was der Nutzer
// in den Chart zeichnet:
//  - S/R-Zonen: horizontale Preis-Bänder über die ganze Breite (unter den Kerzen)
//  - Trendlinien: durch zwei Punkte, nach rechts verlängert (über den Kerzen)
//  - Messung: Abstand zweier Punkte in %, Preis und Kerzen (über den Kerzen)
// Punkte sind als (Zeit, Preis) gespeichert; die Umrechnung Zeit → x liefert der
// Chart (`zeitZuX`), damit Linien auch nach einem Timeframe-Wechsel sitzen.

export interface Zone {
  preisVon: number
  preisBis: number
}

export interface Punkt {
  zeit: number
  preis: number
}

export interface TrendLinie {
  a: Punkt
  b: Punkt
}

export interface Messung {
  a: Punkt
  b: Punkt
  /** fertig formatierter Text, z.B. „+2,35 % · +1.012,5 · 14 Kerzen“ */
  text: string
  positiv: boolean
}

const ZONE_FUELLUNG = 'rgba(245, 158, 11, 0.14)'
const ZONE_RAND = 'rgba(245, 158, 11, 0.55)'
const TREND_FARBE = '#3B82F6'
const LONG = '#22C55E'
const SHORT = '#EF4444'

class ZonenRenderer implements IPrimitivePaneRenderer {
  private readonly eigner: ZeichenPrimitive

  constructor(eigner: ZeichenPrimitive) {
    this.eigner = eigner
  }

  draw(target: CanvasRenderingTarget2D): void {
    const { serie, zonen } = this.eigner
    if (!serie || zonen.length === 0) return
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      for (const z of zonen) {
        const y1 = serie.priceToCoordinate(z.preisVon)
        const y2 = serie.priceToCoordinate(z.preisBis)
        if (y1 === null || y2 === null) continue
        const oben = Math.min(y1, y2)
        const hoehe = Math.max(1, Math.abs(y2 - y1))
        context.fillStyle = ZONE_FUELLUNG
        context.fillRect(0, oben, mediaSize.width, hoehe)
        context.strokeStyle = ZONE_RAND
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(0, oben)
        context.lineTo(mediaSize.width, oben)
        context.moveTo(0, oben + hoehe)
        context.lineTo(mediaSize.width, oben + hoehe)
        context.stroke()
      }
    })
  }
}

class LinienRenderer implements IPrimitivePaneRenderer {
  private readonly eigner: ZeichenPrimitive

  constructor(eigner: ZeichenPrimitive) {
    this.eigner = eigner
  }

  private xy(p: Punkt): { x: number; y: number } | null {
    const { serie, zeitZuX } = this.eigner
    if (!serie || !zeitZuX) return null
    const x = zeitZuX(p.zeit)
    const y = serie.priceToCoordinate(p.preis)
    return x === null || y === null ? null : { x, y }
  }

  draw(target: CanvasRenderingTarget2D): void {
    const { trendlinien, messung, anker } = this.eigner
    if (trendlinien.length === 0 && !messung && !anker) return
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.lineCap = 'round'

      for (const linie of trendlinien) {
        const a = this.xy(linie.a)
        const b = this.xy(linie.b)
        if (!a || !b) continue
        // nach rechts bis zum Rand verlängern
        let ende = b
        if (b.x > a.x) {
          const steigung = (b.y - a.y) / (b.x - a.x)
          ende = { x: mediaSize.width, y: b.y + steigung * (mediaSize.width - b.x) }
        }
        context.strokeStyle = TREND_FARBE
        context.lineWidth = 1.5
        context.setLineDash([])
        context.beginPath()
        context.moveTo(a.x, a.y)
        context.lineTo(ende.x, ende.y)
        context.stroke()
        context.fillStyle = TREND_FARBE
        for (const p of [a, b]) {
          context.beginPath()
          context.arc(p.x, p.y, 3, 0, Math.PI * 2)
          context.fill()
        }
      }

      // Erster gesetzter Punkt einer halb fertigen Linie/Messung
      if (anker) {
        const p = this.xy(anker)
        if (p) {
          context.fillStyle = '#F59E0B'
          context.beginPath()
          context.arc(p.x, p.y, 4, 0, Math.PI * 2)
          context.fill()
        }
      }

      if (messung) {
        const a = this.xy(messung.a)
        const b = this.xy(messung.b)
        if (a && b) {
          const farbe = messung.positiv ? LONG : SHORT
          const links = Math.min(a.x, b.x)
          const oben = Math.min(a.y, b.y)
          const breite = Math.abs(b.x - a.x)
          const hoehe = Math.abs(b.y - a.y)
          context.fillStyle = messung.positiv ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)'
          context.fillRect(links, oben, breite, hoehe)
          context.strokeStyle = farbe
          context.lineWidth = 1
          context.setLineDash([4, 3])
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
          context.setLineDash([])

          // Beschriftung am Endpunkt, im Bild gehalten
          context.font = '600 11px Inter, system-ui, sans-serif'
          const textBreite = context.measureText(messung.text).width + 12
          const x = Math.max(4, Math.min(mediaSize.width - textBreite - 4, b.x - textBreite / 2))
          const y = Math.max(4, Math.min(mediaSize.height - 24, b.y > a.y ? b.y + 8 : b.y - 28))
          context.fillStyle = 'rgba(11, 14, 20, 0.92)'
          context.strokeStyle = farbe
          context.beginPath()
          context.roundRect(x, y, textBreite, 20, 4)
          context.fill()
          context.stroke()
          context.fillStyle = farbe
          context.textBaseline = 'middle'
          context.fillText(messung.text, x + 6, y + 10.5)
        }
      }
    })
  }
}

class PaneView implements IPrimitivePaneView {
  private readonly ebene: 'bottom' | 'top'
  private readonly erzeuge: () => IPrimitivePaneRenderer

  constructor(ebene: 'bottom' | 'top', erzeuge: () => IPrimitivePaneRenderer) {
    this.ebene = ebene
    this.erzeuge = erzeuge
  }
  zOrder() {
    return this.ebene
  }
  renderer(): IPrimitivePaneRenderer | null {
    return this.erzeuge()
  }
}

export class ZeichenPrimitive implements ISeriesPrimitive<Time> {
  zonen: Zone[] = []
  trendlinien: TrendLinie[] = []
  messung: Messung | null = null
  anker: Punkt | null = null
  serie: ISeriesApi<'Candlestick'> | null = null
  /** Zeit → x-Koordinate im Chart; vom Chart gesetzt (kennt Daten und Timeframe) */
  zeitZuX: ((zeit: number) => number | null) | null = null
  private requestUpdate: (() => void) | null = null
  private readonly views = [
    new PaneView('bottom', () => new ZonenRenderer(this)),
    new PaneView('top', () => new LinienRenderer(this)),
  ]

  attached(param: SeriesAttachedParameter<Time, 'Candlestick'>): void {
    this.serie = param.series
    this.requestUpdate = param.requestUpdate
  }

  detached(): void {
    this.serie = null
    this.requestUpdate = null
  }

  setZonen(zonen: Zone[]): void {
    this.zonen = zonen
    this.requestUpdate?.()
  }

  setTrendlinien(linien: TrendLinie[]): void {
    this.trendlinien = linien
    this.requestUpdate?.()
  }

  setMessung(messung: Messung | null): void {
    this.messung = messung
    this.requestUpdate?.()
  }

  setAnker(anker: Punkt | null): void {
    this.anker = anker
    this.requestUpdate?.()
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views
  }
}
