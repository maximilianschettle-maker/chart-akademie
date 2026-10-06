import { Minus, RectangleHorizontal, Eraser, Layers } from 'lucide-react'
import type { ZeichenModus } from './HandelsChart'

interface ZeichenLeisteProps {
  modus: ZeichenModus
  onModus: (m: ZeichenModus) => void
  anzahl: number
  onLoeschen: () => void
  /** Höhere Timeframes zur Auswahl (Label → Sekunden); leer = kein Kontext-Chart */
  timeframes?: { label: string; sek: number }[]
  kontextSek: number | null
  onKontext: (sek: number | null) => void
}

const HINWEIS: Record<ZeichenModus, string> = {
  aus: '',
  linie: 'Tippe in den Chart, um eine horizontale Linie zu setzen.',
  zone: 'Zwei Tipps in den Chart: obere und untere Kante der Zone.',
}

export function ZeichenLeiste({
  modus,
  onModus,
  anzahl,
  onLoeschen,
  timeframes = [],
  kontextSek,
  onKontext,
}: ZeichenLeisteProps) {
  const knopf = (aktiv: boolean) =>
    `inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
      aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rand bg-flaeche px-3 py-2">
      <button
        onClick={() => onModus(modus === 'linie' ? 'aus' : 'linie')}
        className={knopf(modus === 'linie')}
        title="Horizontale Linie"
      >
        <Minus className="h-3.5 w-3.5" /> Linie
      </button>
      <button
        onClick={() => onModus(modus === 'zone' ? 'aus' : 'zone')}
        className={knopf(modus === 'zone')}
        title="S/R-Zone (zwei Klicks)"
      >
        <RectangleHorizontal className="h-3.5 w-3.5" /> Zone
      </button>
      <button
        onClick={onLoeschen}
        disabled={anzahl === 0}
        className="inline-flex items-center gap-1 rounded-lg bg-nacht px-2.5 py-1.5 text-xs text-gedimmt hover:text-short disabled:opacity-40"
        title="Alle Zeichnungen löschen"
      >
        <Eraser className="h-3.5 w-3.5" /> {anzahl > 0 ? `${anzahl} löschen` : 'Leer'}
      </button>

      {timeframes.length > 0 && (
        <div className="ml-auto flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-gedimmt" />
          <span className="mr-1 text-xs text-gedimmt">Kontext:</span>
          <button onClick={() => onKontext(null)} className={knopf(kontextSek === null)}>
            aus
          </button>
          {timeframes.map((tf) => (
            <button key={tf.sek} onClick={() => onKontext(tf.sek)} className={knopf(kontextSek === tf.sek)}>
              {tf.label}
            </button>
          ))}
        </div>
      )}

      {HINWEIS[modus] && <p className="w-full text-xs text-akzent">{HINWEIS[modus]}</p>}
    </div>
  )
}
