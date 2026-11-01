import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { useVollbild } from './useVollbild'
import { Expand, Shrink } from 'lucide-react'

// Vollbild für Charts: derselbe DOM-Knoten wird per Klasse von „im Fluss“ auf „fixed inset-0“
// umgeschaltet, damit der Chart nicht neu aufgebaut wird (Zeichnungen, Ansicht, Serien bleiben).
// Zusätzlich die Fullscreen-API, wo es sie gibt (Android Chrome blendet dann die Browserleiste aus,
// die Zurück-Geste beendet das Vollbild); iOS Safari kennt sie für Elemente nicht → nur Overlay.

const LEISTE_PX = 44

interface Props {
  hoehe: number
  /** Werkzeugleiste, die im Vollbild oben neben dem Schließen-Knopf steht (z.B. Zeitraum, EMA) */
  leiste?: ReactNode
  /** Zusatz unter dem Chart im Vollbild (z.B. CRV-Rechner), nimmt sich seine Höhe selbst */
  unten?: ReactNode
  /** liefert den Chart in der Höhe, die gerade zur Verfügung steht */
  children: (hoehe: number, vollbild: boolean) => ReactNode
}

/** Knopf zum Öffnen/Schließen, passend zu den anderen Chart-Knöpfen (unten rechts) */
export function VollbildKnopf({ an, onClick, className = '' }: { an: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tipp z-[3] rounded-md border border-rand bg-nacht/80 p-1.5 text-gedimmt hover:text-white ${className}`}
      title={an ? 'Vollbild beenden (Esc oder Zurück)' : 'Chart im Vollbild'}
      aria-label={an ? 'Vollbild beenden' : 'Chart im Vollbild'}
      aria-pressed={an}
    >
      {an ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
    </button>
  )
}

export function VollbildRahmen({
  hoehe,
  leiste,
  unten,
  children,
  steuerung,
}: Props & { steuerung: ReturnType<typeof useVollbild> }) {
  const { an, schliessen, rahmenRef } = steuerung
  const chartSlotRef = useRef<HTMLDivElement>(null)
  const [slotHoehe, setSlotHoehe] = useState(0)
  const [rahmenHoehe, setRahmenHoehe] = useState(0)

  // Im Vollbild bekommt der Chart, was Leiste und „unten“ übrig lassen (Drehen des Handys inklusive)
  useLayoutEffect(() => {
    if (!an) return
    const slot = chartSlotRef.current
    const rahmen = rahmenRef.current
    if (!slot || !rahmen) return
    const messen = () => {
      setSlotHoehe(slot.clientHeight)
      setRahmenHoehe(rahmen.clientHeight)
    }
    messen()
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(slot)
    beobachter.observe(rahmen)
    return () => beobachter.disconnect()
  }, [an, rahmenRef])

  // Querformat am Handy (unter 600 px hoch): der Chart bekommt alles, „unten“ (z.B. CRV-Rechner) entfällt –
  // die Linien bleiben im Chart ziehbar
  const zeigeUnten = an && !!unten && rahmenHoehe >= 600

  // bis zur ersten Messung die normale Höhe – der Chart wird nie ausgehängt
  const chartHoehe = an && slotHoehe > 0 ? Math.max(160, slotHoehe) : hoehe

  return (
    <div
      ref={rahmenRef}
      className={an ? 'fixed inset-0 z-50 flex flex-col bg-nacht' : 'relative'}
      style={an ? { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}
    >
      {an && (
        <div className="flex shrink-0 items-center gap-2 border-b border-rand px-2" style={{ minHeight: LEISTE_PX }}>
          {/* Werkzeuge in einer Zeile, seitlich wischbar – nicht umbrechen, sonst frisst die Leiste den Chart */}
          <div className="min-w-0 flex-1 overflow-x-auto py-1 [scrollbar-width:none] [&_.flex-wrap]:flex-nowrap [&_button]:whitespace-nowrap">{leiste}</div>
          <button
            type="button"
            onClick={schliessen}
            className="tipp inline-flex shrink-0 items-center gap-1 rounded-md border border-rand bg-flaeche px-2.5 text-xs font-semibold text-schrift hover:text-white"
            title="Vollbild beenden"
          >
            <Shrink className="h-3.5 w-3.5" /> Schließen
          </button>
        </div>
      )}
      <div ref={chartSlotRef} className={an ? 'relative min-h-0 flex-1' : 'relative'}>
        {children(chartHoehe, an)}
      </div>
      {zeigeUnten && <div className="max-h-[30%] shrink-0 overflow-y-auto border-t border-rand px-2 py-2">{unten}</div>}
    </div>
  )
}
