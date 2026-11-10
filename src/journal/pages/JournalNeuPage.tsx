import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { EintragForm } from '../EintragForm'
import { useJournalStore } from '../store'
import { neuerEintrag, type EintragEntwurf } from '../engine'
import { snapshotLaden } from '../snapshots'

// Neuer echter Trade. Vorbelegung kommt per Router-State aus dem Trader-Chart („Ins Journal“).
// Nach dem Speichern wird der Kerzen-Snapshot im Hintergrund geholt; die Detailseite zeigt ihn an.

export function JournalNeuPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const hinzufuegen = useJournalStore((s) => s.hinzufuegen)
  const start = (location.state ?? undefined) as Partial<EintragEntwurf> | undefined

  function speichern(entwurf: EintragEntwurf) {
    const e = neuerEintrag(entwurf)
    hinzufuegen(e)
    void snapshotLaden(e)
    navigate(`/training/journal/${e.id}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <Link to="/training/journal" className="inline-flex items-center gap-1 text-xs font-semibold text-gedimmt hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Journal
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-white">Neuer Trade</h1>
      <p className="mt-1 text-sm text-gedimmt">
        Erst das Nötige, der Rest lässt sich später ergänzen. Alles in R, der Dollar-Betrag kommt beim Abschließen vom Broker. Trades vom Broker gehen schneller über{' '}
        <Link to="/training/journal/import" className="text-akzent underline">
          Trades importieren
        </Link>
        .
      </p>
      <div className="mt-5 rounded-xl border border-rand bg-flaeche p-4">
        <EintragForm start={start} onSpeichern={speichern} onAbbrechen={() => navigate('/training/journal')} />
      </div>
    </div>
  )
}
