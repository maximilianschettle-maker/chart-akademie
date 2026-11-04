/** Auswahl-Chip des Journals (Markt, Setup, Zeitrahmen, Gefühl) */
export const chip = (aktiv: boolean, extra = '') =>
  `tipp rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'} ${extra}`
