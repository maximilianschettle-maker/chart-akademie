import { Circle, CircleAlert, CircleCheck, CircleDot, CircleX, ThumbsUp, type LucideIcon } from 'lucide-react'
import type { SzenarioBewertung } from '../../types'

// Einzige Stelle, die festlegt, wie ein Übungsergebnis aussieht (Übungsseite,
// Lernpfad-Karte, Dashboard): perfekt grün/Haken, gut blau/Daumen, verpasst orange,
// falsch rot/Kreuz. 'ok' stammt aus alten gespeicherten Ergebnissen.

export interface BewertungAnzeige {
  label: string
  farbe: string
  rahmen: string
  Icon: LucideIcon
}

export const BEWERTUNG_ANZEIGE: Record<SzenarioBewertung, BewertungAnzeige> = {
  perfekt: { label: 'Perfekt!', farbe: 'text-long', rahmen: 'border-long/50', Icon: CircleCheck },
  gut: { label: 'Gut — richtig gelesen', farbe: 'text-sky-400', rahmen: 'border-sky-400/50', Icon: ThumbsUp },
  ok: { label: 'Solide (ältere Bewertung)', farbe: 'text-akzent', rahmen: 'border-akzent/50', Icon: CircleDot },
  verpasst: { label: 'Verpasst', farbe: 'text-orange-400', rahmen: 'border-orange-400/50', Icon: CircleAlert },
  falsch: { label: 'Daneben', farbe: 'text-short', rahmen: 'border-short/50', Icon: CircleX },
}

export const NICHT_VERSUCHT: BewertungAnzeige = {
  label: 'Noch nicht versucht',
  farbe: 'text-gedimmt',
  rahmen: 'border-rand',
  Icon: Circle,
}

export function bewertungAnzeige(bewertung?: SzenarioBewertung): BewertungAnzeige {
  return bewertung ? BEWERTUNG_ANZEIGE[bewertung] : NICHT_VERSUCHT
}
