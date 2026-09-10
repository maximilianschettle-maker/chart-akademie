import { Link } from 'react-router-dom'
import { Lightbulb, TriangleAlert, Pin, Target, CheckCircle2 } from 'lucide-react'
import type { Lesson, LessonBlock } from '../../types'
import { Quiz } from './Quiz'
import { ChartBlock } from './ChartBlock'
import { DemoRegistry } from './demos'
import { SZENARIEN } from '../../content/szenarien'
import { useProgressStore } from '../../stores/progressStore'

interface LektionRendererProps {
  lektion: Lesson
  onQuizFertig: (prozent: number) => void
  /** Pro Quizfrage (Index über alle Quiz-Blöcke der Lektion): richtig/falsch */
  onFrage?: (frageIndex: number, richtig: boolean) => void
}

const CALLOUT_STIL = {
  tipp: { icon: Lightbulb, rahmen: 'border-akzent/40', titel: 'Tipp' },
  warnung: { icon: TriangleAlert, rahmen: 'border-short/40', titel: 'Achtung' },
  merke: { icon: Pin, rahmen: 'border-long/40', titel: 'Merke' },
} as const

function Block({
  block,
  onQuizFertig,
  onFrage,
  frageOffset,
}: {
  block: LessonBlock
  onQuizFertig: (p: number) => void
  onFrage?: (frageIndex: number, richtig: boolean) => void
  frageOffset: number
}) {
  switch (block.typ) {
    case 'text':
      return (
        <div
          className="lektion-text text-[15px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      )
    case 'callout': {
      const stil = CALLOUT_STIL[block.variante]
      const Icon = stil.icon
      return (
        <div className={`rounded-xl border ${stil.rahmen} bg-flaeche p-4`}>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
            <Icon className="h-4 w-4 text-akzent" /> {stil.titel}
          </div>
          <div
            className="lektion-text text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </div>
      )
    }
    case 'begriffe':
      return (
        <div className="rounded-xl border border-rand bg-flaeche p-4">
          <div className="mb-3 text-sm font-semibold text-white">Begriffe dieser Lektion</div>
          <dl className="space-y-2">
            {block.eintraege.map((e) => (
              <div key={e.begriff} className="text-sm">
                <dt className="inline font-semibold text-akzent">{e.begriff}: </dt>
                <dd className="inline text-schrift">{e.erklaerung}</dd>
              </div>
            ))}
          </dl>
        </div>
      )
    case 'demo': {
      const Demo = DemoRegistry[block.demoId]
      if (!Demo) return null
      return <Demo config={block.config} />
    }
    case 'chart':
      return (
        <ChartBlock
          titel={block.titel}
          symbol={block.symbol}
          interval={block.interval}
          von={block.von}
          bis={block.bis}
          annotationen={block.annotationen}
          beschreibung={block.beschreibung}
          emaPerioden={block.emaPerioden}
        />
      )
    case 'quiz':
      return (
        <Quiz
          fragen={block.fragen}
          onFertig={onQuizFertig}
          onFrage={onFrage ? (i, r) => onFrage(frageOffset + i, r) : undefined}
        />
      )
    case 'uebung':
      return <UebungKarte szenarioId={block.szenarioId} />
  }
}

function UebungKarte({ szenarioId }: { szenarioId: string }) {
  const szenario = SZENARIEN[szenarioId]
  const ergebnis = useProgressStore((s) => s.szenarioErgebnisse[szenarioId])
  if (!szenario) return null
  return (
    <Link
      to={`/uebung/${szenarioId}`}
      className="flex items-center justify-between rounded-xl border border-akzent/40 bg-flaeche p-4 transition-colors hover:border-akzent"
    >
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-akzent">
          <Target className="h-4 w-4" /> Chart-Übung
        </div>
        <div className="mt-1 font-semibold text-white">{szenario.titel}</div>
        <div className="text-xs text-gedimmt">
          Am echten historischen Chart — Kerze für Kerze.
        </div>
      </div>
      {ergebnis && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-long">
          <CheckCircle2 className="h-4 w-4" /> {ergebnis.bewertung}
        </span>
      )}
    </Link>
  )
}

export function LektionRenderer({ lektion, onQuizFertig, onFrage }: LektionRendererProps) {
  // Frage-Indizes laufen über alle Quiz-Blöcke der Lektion durch (für die Wiederholungs-Box)
  let offset = 0
  return (
    <div className="space-y-6">
      {lektion.bloecke.map((block, i) => {
        const eigenerOffset = offset
        if (block.typ === 'quiz') offset += block.fragen.length
        return (
          <Block
            key={i}
            block={block}
            onQuizFertig={onQuizFertig}
            onFrage={onFrage}
            frageOffset={eigenerOffset}
          />
        )
      })}
    </div>
  )
}
