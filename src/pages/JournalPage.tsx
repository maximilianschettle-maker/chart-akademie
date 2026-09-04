import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useSimulatorStore, START_KAPITAL } from '../stores/simulatorStore'
import { statistik } from '../engine/bewertung'
import { TradeHistorie } from '../components/simulator/TradeHistorie'

function Kachel({ titel, wert, farbe }: { titel: string; wert: string; farbe?: string }) {
  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <div className="text-xs text-gedimmt">{titel}</div>
      <div className={`tabular-nums mt-1 text-lg font-bold ${farbe ?? 'text-white'}`}>{wert}</div>
    </div>
  )
}

export function JournalPage() {
  const { kontostand, tradeHistorie, zuruecksetzen } = useSimulatorStore()
  const [bestaetigen, setBestaetigen] = useState(false)
  const stats = statistik(tradeHistorie)
  const gesamtPnl = kontostand - START_KAPITAL

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Trade-Journal</h1>
      <p className="mt-1 text-sm text-gedimmt">
        Alle Trades aus deinen Simulator-Sessions — dein wichtigstes Lernwerkzeug.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kachel
          titel="Kontostand"
          wert={`${kontostand.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`}
        />
        <Kachel
          titel="Gesamt-PnL"
          wert={`${gesamtPnl >= 0 ? '+' : ''}${gesamtPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`}
          farbe={gesamtPnl >= 0 ? 'text-long' : 'text-short'}
        />
        <Kachel titel="Trades" wert={String(stats.anzahl)} />
        <Kachel titel="Trefferquote" wert={`${stats.trefferquote.toFixed(0)} %`} />
        <Kachel
          titel="Ø R-Multiple"
          wert={`${stats.durchschnittR >= 0 ? '+' : ''}${stats.durchschnittR.toFixed(2)}`}
          farbe={stats.durchschnittR >= 0 ? 'text-long' : 'text-short'}
        />
        <Kachel
          titel="Profit-Faktor"
          wert={Number.isFinite(stats.profitFaktor) ? stats.profitFaktor.toFixed(2) : '∞'}
        />
      </div>

      <div className="mt-6 rounded-xl border border-rand bg-flaeche p-4">
        <h2 className="mb-2 text-sm font-semibold text-white">Alle Trades</h2>
        <TradeHistorie trades={tradeHistorie} />
      </div>

      <div className="mt-8 border-t border-rand pt-4">
        {bestaetigen ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gedimmt">
              Wirklich alles zurücksetzen? Konto und Historie gehen verloren.
            </span>
            <button
              onClick={() => {
                zuruecksetzen()
                setBestaetigen(false)
              }}
              className="rounded-lg bg-short px-3 py-1.5 font-semibold text-white"
            >
              Ja, zurücksetzen
            </button>
            <button
              onClick={() => setBestaetigen(false)}
              className="rounded-lg bg-flaeche px-3 py-1.5 text-gedimmt hover:text-white"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={() => setBestaetigen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-gedimmt hover:text-short"
          >
            <Trash2 className="h-3.5 w-3.5" /> Konto & Historie zurücksetzen
          </button>
        )}
      </div>
    </div>
  )
}
