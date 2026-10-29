import { Link, useLocation } from 'react-router-dom'
import { ChartLine, GraduationCap, House } from 'lucide-react'
import { HAUPTBEREICHE, hauptbereichVon, type Hauptbereich } from '../../navigation'

// Hauptnavigation: am Handy als untere Tab-Leiste (Daumenbereich, ≥ 44 px hoch, Safe-Area),
// am Desktop als Reiter im Kopf. Beide lesen den aktiven Bereich aus dem Pfad.

const ICONS: Record<Hauptbereich, typeof House> = { start: House, training: GraduationCap, analyse: ChartLine }

export function TabLeisteUnten() {
  const aktiv = hauptbereichVon(useLocation().pathname)
  return (
    <nav aria-label="Hauptbereiche" className="fixed inset-x-0 bottom-0 z-20 border-t border-rand bg-nacht/95 backdrop-blur sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="grid grid-cols-3">
        {HAUPTBEREICHE.map((b) => {
          const Icon = ICONS[b.id]
          const ist = b.id === aktiv
          return (
            <li key={b.id}>
              <Link
                to={b.pfad}
                aria-current={ist ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${ist ? 'text-akzent' : 'text-gedimmt hover:text-schrift'}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {b.text}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function TabLeisteOben() {
  const aktiv = hauptbereichVon(useLocation().pathname)
  return (
    <nav aria-label="Hauptbereiche" className="flex gap-1">
      {HAUPTBEREICHE.map((b) => {
        const Icon = ICONS[b.id]
        const ist = b.id === aktiv
        return (
          <Link
            key={b.id}
            to={b.pfad}
            aria-current={ist ? 'page' : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${ist ? 'bg-flaeche text-white' : 'text-gedimmt hover:text-schrift'}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {b.text}
          </Link>
        )
      })}
    </nav>
  )
}
