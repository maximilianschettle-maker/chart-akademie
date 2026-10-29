// Struktur der App seit dem Umbau (Phase 1): drei Hauptbereiche in der unteren Tab-Leiste
// (Handy) bzw. im Kopf (Desktop), darunter Unterbereiche als Segment-Leiste.
//
//   Start      /                      Startseite: Termine, Watchlist, Journal, Weiterlernen
//   Training   /training              Lernpfad · /training/simulator · /training/journal
//              /lektion/:id, /uebung/:id, /wiederholung (Detailseiten ohne Segment-Leiste)
//   Analyse    /analyse/aktien        Aktien (+ /vergleich, /:symbol) · /analyse/tracker · /analyse/makro · /analyse/news
//
// Alte Pfade (Lesezeichen, Push-Links, ICS) werden weitergeleitet, siehe neuerPfad().

export type Hauptbereich = 'start' | 'training' | 'analyse'

export interface NavZiel {
  pfad: string
  text: string
  /** NavLink nur bei exakter Übereinstimmung aktiv (Index-Route) */
  end?: boolean
}

export const HAUPTBEREICHE: { id: Hauptbereich; pfad: string; text: string }[] = [
  { id: 'start', pfad: '/', text: 'Start' },
  { id: 'training', pfad: '/training', text: 'Training' },
  { id: 'analyse', pfad: '/analyse', text: 'Analyse' },
]

export const TRAINING_TABS: NavZiel[] = [
  { pfad: '/training', text: 'Lernpfad', end: true },
  { pfad: '/training/simulator', text: 'Simulator' },
  { pfad: '/training/journal', text: 'Journal' },
]

export const ANALYSE_TABS: NavZiel[] = [
  { pfad: '/analyse/aktien', text: 'Aktien' },
  { pfad: '/analyse/tracker', text: 'Tracker' },
  { pfad: '/analyse/makro', text: 'Makro' },
  { pfad: '/analyse/news', text: 'News' },
]

const TRAINING_PRAEFIXE = ['/training', '/lektion', '/uebung', '/wiederholung']

export function hauptbereichVon(pathname: string): Hauptbereich {
  if (pathname.startsWith('/analyse')) return 'analyse'
  if (TRAINING_PRAEFIXE.some((p) => pathname === p || pathname.startsWith(p + '/'))) return 'training'
  return 'start'
}

const ALTE_ROUTEN: Record<string, string> = {
  '/simulator': '/training/simulator',
  '/journal': '/training/journal',
  '/aktien': '/analyse/aktien',
  '/makro': '/analyse/makro',
  '/tracker': '/analyse/tracker',
}

/** Neuer Pfad für einen alten (inkl. Unterpfaden wie /aktien/SAP.DE), sonst null */
export function neuerPfad(pathname: string): string | null {
  for (const [alt, neu] of Object.entries(ALTE_ROUTEN)) {
    if (pathname === alt) return neu
    if (pathname.startsWith(alt + '/')) return neu + pathname.slice(alt.length)
  }
  return null
}
