import { useDatenStatus } from '../data/status'

// Kleiner Statuspunkt für die Worker-Daten: live (grün), veraltet (gelb, mit Stand), Fehler (rot).
// Vor der ersten Antwort wird nichts angezeigt.

function fmtStand(ms: number): string {
  const d = new Date(ms)
  const heute = new Date().toDateString() === d.toDateString()
  return d.toLocaleString('de-DE', heute ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function DatenStatus({ klasse = '' }: { klasse?: string }) {
  const lage = useDatenStatus((s) => s.lage)
  const letzterErfolg = useDatenStatus((s) => s.letzterErfolg)
  const standVeraltet = useDatenStatus((s) => s.standVeraltet)
  const letzterFehler = useDatenStatus((s) => s.letzterFehler)
  if (lage === 'unbekannt') return null

  const punkt = lage === 'live' ? 'bg-long' : lage === 'veraltet' ? 'bg-akzent' : 'bg-short'
  const text =
    lage === 'live'
      ? `Daten live${letzterErfolg ? ` · ${fmtStand(letzterErfolg)}` : ''}`
      : lage === 'veraltet'
        ? `Daten veraltet${standVeraltet ? ` · Stand ${fmtStand(standVeraltet)}` : ''}`
        : 'Daten-Fehler'
  const titel = lage === 'live' ? 'Der Daten-Worker antwortet; Kurse sind höchstens 15 Minuten alt.' : (letzterFehler ?? '')

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-gedimmt ${klasse}`} title={titel} role="status">
      <span className={`h-2 w-2 shrink-0 rounded-full ${punkt}`} aria-hidden />
      {text}
      {lage === 'fehler' && letzterFehler && <span className="hidden sm:inline">· {letzterFehler}</span>}
    </span>
  )
}
