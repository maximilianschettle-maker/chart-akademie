import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Brain, CheckCircle2, LoaderCircle } from 'lucide-react'
import type { Lesson, QuizFrage } from '../types'
import { LEKTIONEN_META, ladeLektion } from '../content/curriculum'
import { useProgressStore } from '../stores/progressStore'
import { faellige, naechsteFaelligkeit, schluessel, type WiederholungsEintrag } from '../engine/wiederholung'
import { Quiz } from '../components/lektion/Quiz'

/** Quizfrage einer geladenen Lektion (der Index zählt über alle Quiz-Blöcke der Lektion). */
export function frageAus(lektion: Lesson, frageIndex: number): QuizFrage | undefined {
  const fragen = lektion.bloecke.flatMap((b) => (b.typ === 'quiz' ? b.fragen : []))
  return fragen[frageIndex]
}

interface RundenFrage {
  e: WiederholungsEintrag
  frage: QuizFrage
}

export function WiederholungPage() {
  const wiederholungen = useProgressStore((s) => s.wiederholungen)
  const wiederholungBeantwortet = useProgressStore((s) => s.wiederholungBeantwortet)
  // Fällige Fragen beim Betreten einfrieren, damit die Liste sich während der Runde nicht verändert
  const [runde] = useState(() => faellige(wiederholungen))
  const [fragen, setFragen] = useState<RundenFrage[] | null>(null)
  const [fertig, setFertig] = useState(false)

  // Lektionen der fälligen Fragen nachladen (lazy)
  useEffect(() => {
    let aktiv = true
    const ids = [...new Set(runde.map((e) => e.lektionId))]
    Promise.all(ids.map((id) => ladeLektion(id).catch(() => null)))
      .then((lektionen) => {
        if (!aktiv) return
        const map = new Map(ids.map((id, i) => [id, lektionen[i]]))
        const liste: RundenFrage[] = []
        for (const e of runde) {
          const l = map.get(e.lektionId)
          const frage = l ? frageAus(l, e.frageIndex) : undefined
          if (frage) liste.push({ e, frage })
        }
        setFragen(liste)
      })
    return () => {
      aktiv = false
    }
  }, [runde])

  const gesamtInBox = Object.keys(wiederholungen).length
  const naechste = naechsteFaelligkeit(wiederholungen)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gedimmt hover:text-schrift">
        <ArrowLeft className="h-4 w-4" /> Lernpfad
      </Link>
      <div className="mt-3 mb-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-akzent">
          <Brain className="h-4 w-4" /> Wiederholung
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">Fragen, die du zuletzt falsch hattest</h1>
        <p className="mt-1 text-sm text-gedimmt">
          Spaced Repetition: Jede richtige Wiederholung schiebt die Frage weiter nach hinten (1 → 3 → 7 → 14
          → 30 Tage), jede falsche holt sie morgen zurück. Nach fünf Treffern gilt sie als gelernt.
        </p>
      </div>

      {fragen === null ? (
        <div className="flex h-48 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </div>
      ) : fragen.length === 0 || fertig ? (
        <div className="rounded-xl border border-rand bg-flaeche p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-long" />
          <p className="font-semibold text-white">
            {fertig ? 'Runde abgeschlossen.' : 'Heute ist nichts fällig.'}
          </p>
          <p className="mt-1 text-sm text-gedimmt">
            {gesamtInBox === 0
              ? 'Die Wiederholungs-Box ist leer — falsch beantwortete Quizfragen landen automatisch hier.'
              : `${gesamtInBox} Frage${gesamtInBox === 1 ? '' : 'n'} in der Box · nächste fällig am ${
                  naechste ? new Date(naechste).toLocaleDateString('de-DE') : '—'
                }`}
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-akzent px-4 py-2 text-sm font-semibold text-nacht hover:brightness-110"
          >
            Zum Lernpfad
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-gedimmt">
            {fragen.length} Frage{fragen.length === 1 ? '' : 'n'} fällig · aus:{' '}
            {[...new Set(fragen.map((f) => LEKTIONEN_META[f.e.lektionId]?.titel))].join(', ')}
          </p>
          <Quiz
            fragen={fragen.map((f) => f.frage)}
            wiederholung
            onFrage={(i, richtig) =>
              wiederholungBeantwortet(schluessel(fragen[i].e.lektionId, fragen[i].e.frageIndex), richtig)
            }
            onFertig={() => setFertig(true)}
          />
        </>
      )}
    </div>
  )
}
