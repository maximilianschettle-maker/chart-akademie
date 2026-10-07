import type { SzenarioBewertung } from '../../types'
import { bewertungAnzeige } from './bewertungAnzeige'

/** Kompakte Ergebnis-Anzeige (Icon + Text) für Lernpfad und Dashboard. */
export function BewertungsBadge({ bewertung }: { bewertung?: SzenarioBewertung }) {
  const a = bewertungAnzeige(bewertung)
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${a.farbe}`}>
      <a.Icon className="h-4 w-4 shrink-0" /> {a.label}
    </span>
  )
}
