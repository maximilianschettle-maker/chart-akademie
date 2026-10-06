import type { ReactNode } from 'react'
import { Play, Pause, StepForward, ChevronsRight } from 'lucide-react'

interface ReplayControlsProps<T extends number> {
  laufend: boolean
  geschwindigkeit: T
  fertig: boolean
  /** leer lassen bei offenem Ende (Simulator) */
  verbleibendeBars?: number
  onLaufend: (laufend: boolean) => void
  onGeschwindigkeit: (g: T) => void
  onStep: () => void
  stufen?: readonly T[]
  /** mehrere Kerzen auf einmal weiter (z.B. 10) */
  onSprung?: () => void
  sprungWeite?: number
  /** rechter Bereich (Status, Schalter) */
  children?: ReactNode
}

const STANDARD_STUFEN = [1, 2, 5, 10] as const

export function ReplayControls<T extends number>({
  laufend,
  geschwindigkeit,
  fertig,
  verbleibendeBars,
  onLaufend,
  onGeschwindigkeit,
  onStep,
  stufen = STANDARD_STUFEN as unknown as readonly T[],
  onSprung,
  sprungWeite = 10,
  children,
}: ReplayControlsProps<T>) {
  const rund = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-rand bg-flaeche px-3 py-2.5 sm:px-4">
      <button
        onClick={() => onLaufend(!laufend)}
        disabled={fertig}
        className={`${rund} bg-akzent text-nacht hover:brightness-110`}
        title={laufend ? 'Pause (Leertaste)' : 'Abspielen (Leertaste)'}
      >
        {laufend ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
      </button>
      <button
        onClick={onStep}
        disabled={fertig || laufend}
        className={`${rund} bg-nacht text-schrift hover:text-white`}
        title="Eine Kerze weiter (Pfeil rechts)"
      >
        <StepForward className="h-5 w-5" />
      </button>
      {onSprung && (
        <button
          onClick={onSprung}
          disabled={fertig || laufend}
          className={`${rund} bg-nacht text-schrift hover:text-white`}
          title={`${sprungWeite} Kerzen weiter (Umschalt + Pfeil rechts)`}
        >
          <ChevronsRight className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-center gap-1">
        {stufen.map((s) => (
          <button
            key={s}
            onClick={() => onGeschwindigkeit(s)}
            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
              geschwindigkeit === s ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'
            }`}
            title={`${s} Kerzen pro Sekunde`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="tabular-nums ml-auto flex items-center gap-3 text-xs text-gedimmt">
        {children}
        {verbleibendeBars !== undefined && (
          <span>{fertig ? 'Session beendet' : `${verbleibendeBars} Kerzen verbleibend`}</span>
        )}
      </div>
    </div>
  )
}
