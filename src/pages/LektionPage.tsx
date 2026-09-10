import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, LoaderCircle } from 'lucide-react'
import type { Lesson } from '../types'
import { CURRICULUM, LEKTIONEN_META, QUIZ_BESTANDEN_PROZENT, ladeLektion } from '../content/curriculum'
import { useProgressStore } from '../stores/progressStore'
import { LektionRenderer } from '../components/lektion/LektionRenderer'

export function LektionPage() {
  const { lektionId } = useParams<{ lektionId: string }>()
  const navigate = useNavigate()
  const abgeschlossene = useProgressStore((s) => s.abgeschlosseneLektionen)
  const lektionAbschliessen = useProgressStore((s) => s.lektionAbschliessen)
  const frageBeantwortet = useProgressStore((s) => s.frageBeantwortet)

  const meta = lektionId ? LEKTIONEN_META[lektionId] : undefined
  const [lektion, setLektion] = useState<Lesson | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    if (!meta) return
    let aktiv = true
    setLektion(null)
    setFehler(false)
    ladeLektion(meta.id)
      .then((l) => {
        if (aktiv) setLektion(l)
      })
      .catch(() => {
        if (aktiv) setFehler(true)
      })
    return () => {
      aktiv = false
    }
  }, [meta])

  if (!meta) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gedimmt">
        Lektion nicht gefunden.{' '}
        <Link to="/" className="text-akzent underline">
          Zurück zum Lernpfad
        </Link>
      </div>
    )
  }

  const level = CURRICULUM.find((l) => l.level === meta.level)
  const idsImLevel = level?.lektionIds ?? []
  const pos = idsImLevel.indexOf(meta.id)
  const vorherigeId = pos > 0 ? idsImLevel[pos - 1] : undefined
  const naechsteId = pos >= 0 && pos < idsImLevel.length - 1 ? idsImLevel[pos + 1] : undefined
  const abgeschlossen = meta.id in abgeschlossene

  function quizFertig(prozent: number) {
    if (prozent >= QUIZ_BESTANDEN_PROZENT) {
      lektionAbschliessen(meta!.id, prozent)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gedimmt hover:text-schrift">
        <ArrowLeft className="h-4 w-4" /> Lernpfad
      </Link>

      <div className="mt-3 mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-akzent">
          Level {meta.level} · Lektion {pos + 1}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">{meta.titel}</h1>
        <p className="mt-1 text-gedimmt">{meta.untertitel}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-gedimmt">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> ~{meta.dauerMin} Min
          </span>
          {abgeschlossen && (
            <span className="inline-flex items-center gap-1 text-long">
              <CheckCircle2 className="h-3.5 w-3.5" /> Abgeschlossen (
              {abgeschlossene[meta.id].quizProzent} %)
            </span>
          )}
        </div>
      </div>

      {fehler ? (
        <p className="py-10 text-center text-sm text-gedimmt">
          Lektion konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.
        </p>
      ) : lektion === null ? (
        <div className="flex h-48 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <LektionRenderer
          lektion={lektion}
          onQuizFertig={quizFertig}
          onFrage={(i, richtig) => frageBeantwortet(lektion.id, i, richtig)}
        />
      )}

      <div className="mt-8 flex items-center justify-between border-t border-rand pt-5">
        {vorherigeId ? (
          <button
            onClick={() => navigate(`/lektion/${vorherigeId}`)}
            className="inline-flex items-center gap-1 text-sm text-gedimmt hover:text-schrift"
          >
            <ArrowLeft className="h-4 w-4" /> Vorherige Lektion
          </button>
        ) : (
          <span />
        )}
        {naechsteId && (
          <button
            onClick={() => navigate(`/lektion/${naechsteId}`)}
            disabled={!abgeschlossen}
            className={`inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold ${
              abgeschlossen
                ? 'bg-akzent text-nacht hover:brightness-110'
                : 'cursor-not-allowed bg-flaeche text-gedimmt'
            }`}
            title={abgeschlossen ? undefined : 'Schließe erst das Quiz dieser Lektion ab'}
          >
            Nächste Lektion <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
