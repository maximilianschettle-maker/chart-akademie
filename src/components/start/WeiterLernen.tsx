import { Link } from 'react-router-dom'
import { ArrowRight, Brain, Clock } from 'lucide-react'
import { naechsteOffeneLektion } from '../../content/curriculum'
import { faellige } from '../../engine/wiederholung'
import { useProgressStore } from '../../stores/progressStore'

// „Weiter lernen“ + Wiederholungs-Box: auf der Startseite und oben im Lernpfad.

export function WeiterLernen() {
  const abgeschlossene = useProgressStore((s) => s.abgeschlosseneLektionen)
  const wiederholungen = useProgressStore((s) => s.wiederholungen)
  const faelligeFragen = faellige(wiederholungen).length
  const inBox = Object.keys(wiederholungen).length
  const naechste = naechsteOffeneLektion(abgeschlossene)

  return (
    <>
      {naechste && (
        <Link
          to={`/lektion/${naechste.id}`}
          className="mt-5 flex min-h-14 items-center justify-between gap-3 rounded-xl bg-akzent px-5 py-4 font-semibold text-nacht transition-transform hover:scale-[1.01]"
        >
          <span>
            Weiter lernen: {naechste.titel}
            <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal opacity-80">
              <Clock className="h-3.5 w-3.5" /> ~{naechste.dauerMin} Min
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      )}

      {inBox > 0 && (
        <Link
          to="/wiederholung"
          className={`mt-3 flex min-h-11 items-center justify-between rounded-xl border px-5 py-3 text-sm transition-colors hover:border-akzent ${
            faelligeFragen > 0 ? 'border-akzent/50 bg-flaeche' : 'border-rand bg-flaeche'
          }`}
        >
          <span className="inline-flex items-center gap-2 text-schrift">
            <Brain className="h-4 w-4 text-akzent" />
            {faelligeFragen > 0
              ? `Wiederholung: ${faelligeFragen} Frage${faelligeFragen === 1 ? '' : 'n'} fällig`
              : `Wiederholungs-Box: ${inBox} Frage${inBox === 1 ? '' : 'n'}, heute nichts fällig`}
          </span>
          <ArrowRight className="h-4 w-4 text-gedimmt" />
        </Link>
      )}
    </>
  )
}
