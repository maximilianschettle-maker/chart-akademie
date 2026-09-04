import { useState } from 'react'
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import type { QuizFrage } from '../../types'
import { QUIZ_BESTANDEN_PROZENT } from '../../content/curriculum'

interface QuizProps {
  fragen: QuizFrage[]
  onFertig: (prozent: number) => void
}

export function Quiz({ fragen, onFertig }: QuizProps) {
  const [index, setIndex] = useState(0)
  const [auswahl, setAuswahl] = useState<number | null>(null)
  const [richtige, setRichtige] = useState(0)
  const [fertig, setFertig] = useState(false)

  const frage = fragen[index]
  const beantwortet = auswahl !== null

  function antworten(i: number) {
    if (beantwortet) return
    setAuswahl(i)
    if (i === frage.richtigIndex) setRichtige((r) => r + 1)
  }

  function weiter() {
    if (index + 1 < fragen.length) {
      setIndex(index + 1)
      setAuswahl(null)
    } else {
      const prozent = Math.round((richtige / fragen.length) * 100)
      setFertig(true)
      onFertig(prozent)
    }
  }

  function nochmal() {
    setIndex(0)
    setAuswahl(null)
    setRichtige(0)
    setFertig(false)
  }

  if (fertig) {
    const prozent = Math.round((richtige / fragen.length) * 100)
    const bestanden = prozent >= QUIZ_BESTANDEN_PROZENT
    return (
      <div className="rounded-xl border border-rand bg-flaeche p-6 text-center">
        {bestanden ? (
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-long" />
        ) : (
          <XCircle className="mx-auto mb-3 h-10 w-10 text-short" />
        )}
        <p className="text-lg font-semibold text-white">
          {richtige} von {fragen.length} richtig ({prozent} %)
        </p>
        <p className="mt-1 text-sm text-gedimmt">
          {bestanden
            ? 'Quiz bestanden — die Lektion ist abgeschlossen.'
            : `Mindestens ${QUIZ_BESTANDEN_PROZENT} % nötig. Lies die Lektion noch einmal und versuch es erneut.`}
        </p>
        {!bestanden && (
          <button
            onClick={nochmal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-akzent px-4 py-2 text-sm font-semibold text-nacht hover:brightness-110"
          >
            <RotateCcw className="h-4 w-4" /> Nochmal versuchen
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-6">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gedimmt">
        Quiz — Frage {index + 1} von {fragen.length}
      </div>
      <p className="mb-4 font-semibold text-white">{frage.frage}</p>
      <div className="space-y-2">
        {frage.antworten.map((antwort, i) => {
          let stil = 'border-rand bg-nacht hover:border-gedimmt'
          if (beantwortet) {
            if (i === frage.richtigIndex) stil = 'border-long bg-long/10'
            else if (i === auswahl) stil = 'border-short bg-short/10'
            else stil = 'border-rand bg-nacht opacity-50'
          }
          return (
            <button
              key={i}
              onClick={() => antworten(i)}
              disabled={beantwortet}
              className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${stil}`}
            >
              {antwort}
            </button>
          )
        })}
      </div>
      {beantwortet && (
        <div className="mt-4 rounded-lg bg-nacht p-4 text-sm text-schrift">
          <span className={auswahl === frage.richtigIndex ? 'font-semibold text-long' : 'font-semibold text-short'}>
            {auswahl === frage.richtigIndex ? 'Richtig! ' : 'Leider falsch. '}
          </span>
          {frage.erklaerung}
          <div className="mt-3">
            <button
              onClick={weiter}
              className="rounded-lg bg-akzent px-4 py-2 text-sm font-semibold text-nacht hover:brightness-110"
            >
              {index + 1 < fragen.length ? 'Nächste Frage' : 'Ergebnis anzeigen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
