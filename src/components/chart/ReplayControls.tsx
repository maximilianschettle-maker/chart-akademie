import { Play, Pause, StepForward } from 'lucide-react'
import type { Geschwindigkeit } from '../../hooks/useReplay'

interface ReplayControlsProps {
  laufend: boolean
  geschwindigkeit: Geschwindigkeit
  fertig: boolean
  verbleibendeBars: number
  onLaufend: (laufend: boolean) => void
  onGeschwindigkeit: (g: Geschwindigkeit) => void
  onStep: () => void
}

const STUFEN: Geschwindigkeit[] = [1, 2, 5, 10]

export function ReplayControls({
  laufend,
  geschwindigkeit,
  fertig,
  verbleibendeBars,
  onLaufend,
  onGeschwindigkeit,
  onStep,
}: ReplayControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rand bg-flaeche px-4 py-3">
      <button
        onClick={() => onLaufend(!laufend)}
        disabled={fertig}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-akzent text-nacht hover:brightness-110 disabled:opacity-40"
        title={laufend ? 'Pause' : 'Abspielen'}
      >
        {laufend ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
      </button>
      <button
        onClick={onStep}
        disabled={fertig || laufend}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-nacht text-schrift hover:text-white disabled:opacity-40"
        title="Eine Kerze weiter"
      >
        <StepForward className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-1">
        {STUFEN.map((s) => (
          <button
            key={s}
            onClick={() => onGeschwindigkeit(s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
              geschwindigkeit === s ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="tabular-nums ml-auto text-xs text-gedimmt">
        {fertig ? 'Session beendet' : `${verbleibendeBars} Kerzen verbleibend`}
      </div>
    </div>
  )
}
