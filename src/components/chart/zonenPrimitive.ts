import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'
import type { CanvasRenderingTarget2D } from 'fancy-canvas'

export interface Zone {
  preisVon: number
  preisBis: number
}

// Series-Primitive (lightweight-charts v5 Plugin-API): zeichnet horizontale
// Preis-Bänder („S/R-Zonen“) über die ganze Chartbreite, unter den Kerzen.

const FUELLUNG = 'rgba(245, 158, 11, 0.14)'
const RAND = 'rgba(245, 158, 11, 0.55)'

class ZonenRenderer implements IPrimitivePaneRenderer {
  private readonly zonen: Zone[]
  private readonly serie: ISeriesApi<'Candlestick'> | null

  constructor(zonen: Zone[], serie: ISeriesApi<'Candlestick'> | null) {
    this.zonen = zonen
    this.serie = serie
  }

  draw(target: CanvasRenderingTarget2D): void {
    const serie = this.serie
    if (!serie || this.zonen.length === 0) return
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      for (const z of this.zonen) {
        const y1 = serie.priceToCoordinate(z.preisVon)
        const y2 = serie.priceToCoordinate(z.preisBis)
        if (y1 === null || y2 === null) continue
        const oben = Math.min(y1, y2)
        const hoehe = Math.max(1, Math.abs(y2 - y1))
        context.fillStyle = FUELLUNG
        context.fillRect(0, oben, mediaSize.width, hoehe)
        context.strokeStyle = RAND
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

class ZonenPaneView implements IPrimitivePaneView {
  private readonly eigner: ZonenPrimitive

  constructor(eigner: ZonenPrimitive) {
    this.eigner = eigner
  }
  zOrder() {
    return 'bottom' as const
  }
  renderer(): IPrimitivePaneRenderer | null {
    return new ZonenRenderer(this.eigner.zonen, this.eigner.serie)
  }
}

export class ZonenPrimitive implements ISeriesPrimitive<Time> {
  zonen: Zone[] = []
  serie: ISeriesApi<'Candlestick'> | null = null
  private requestUpdate: (() => void) | null = null
  private readonly view = new ZonenPaneView(this)

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

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view]
  }
}
