import { Briefcase, ChartCandlestick } from 'lucide-react'
import { useAnsichtStore, type Ansicht } from './ansichtStore'

// Trader | Investor – Umschalter im Analyse-Bereich; Wahl wird gespeichert (ansichtStore).

const OPTIONEN: { id: Ansicht; text: string; titel: string; Icon: typeof Briefcase }[] = [
  { id: 'trader', text: 'Trader', titel: 'Kerzen, Intraday, EMA/RSI/Volumen, Zeichenwerkzeuge, CRV-Rechner', Icon: ChartCandlestick },
  { id: 'investor', text: 'Investor', titel: 'Linienchart, Wochen/Monate, Log-Skala, Kennzahlen, Leitzins-Overlay', Icon: Briefcase },
]

export function AnsichtSchalter() {
  const ansicht = useAnsichtStore((s) => s.ansicht)
  const setAnsicht = useAnsichtStore((s) => s.setAnsicht)
  return (
    <div role="radiogroup" aria-label="Ansicht" className="inline-flex rounded-lg bg-flaeche p-0.5">
      {OPTIONEN.map(({ id, text, titel, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={ansicht === id}
          title={titel}
          onClick={() => setAnsicht(id)}
          className={`inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors ${ansicht === id ? 'bg-akzent text-nacht' : 'text-gedimmt hover:text-schrift'}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden /> {text}
        </button>
      ))}
    </div>
  )
}
