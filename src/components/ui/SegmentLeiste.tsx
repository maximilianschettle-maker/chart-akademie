import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { NavZiel } from '../../navigation'

// Segment-Leiste für die Unterbereiche (Lernpfad/Simulator/Journal bzw. Aktien/Tracker/Makro/News).
// Am Handy klebt sie oben, damit man innerhalb eines Bereichs ohne Scrollen wechseln kann.
// `rechts` nimmt einen kleinen Zusatz auf (derzeit ungenutzt).

export function SegmentLeiste({ tabs, label, rechts }: { tabs: NavZiel[]; label: string; rechts?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 bg-nacht/95 pb-3 pt-2 backdrop-blur sm:static sm:bg-transparent sm:pt-0">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <nav aria-label={label} className="flex min-w-0 flex-1 gap-1 rounded-xl bg-flaeche p-1">
          {tabs.map((t) => (
            <NavLink
              key={t.pfad}
              to={t.pfad}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold leading-tight transition-colors sm:min-h-9 ${
                  isActive ? 'bg-nacht text-white shadow' : 'text-gedimmt hover:text-schrift'
                }`
              }
            >
              {t.text}
            </NavLink>
          ))}
        </nav>
        {rechts && <div className="flex w-full justify-end sm:w-auto">{rechts}</div>}
      </div>
    </div>
  )
}
