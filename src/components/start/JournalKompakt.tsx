import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, NotebookPen } from 'lucide-react'
import { START_KAPITAL, useSimulatorStore } from '../../stores/simulatorStore'
import { logischeTrades } from '../../engine/auswertung'
import { fmtGeldVz, fmtR } from '../../engine/format'
import { strategieName } from '../../content/strategien'

// Startseite: Kontostand, Gesamt-PnL und die drei letzten Trades aus dem Journal.

function datum(t: number): string {
  return new Date(t * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })
}

export function JournalKompakt() {
  const tradeHistorie = useSimulatorStore((s) => s.tradeHistorie)
  const kontostand = useSimulatorStore((s) => s.kontostand)
  const letzte = useMemo(() => [...logischeTrades(tradeHistorie)].sort((a, b) => b.exitTime - a.exitTime).slice(0, 3), [tradeHistorie])
  const gesamt = kontostand - START_KAPITAL
  // Symbol je logischem Trade (steht nur an den Einzel-Exits)
  const symbole = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of letzte) {
      const roh = tradeHistorie.find((x) => x.entryTime === l.entryTime && x.richtung === l.richtung && x.entryPreis === l.entryPreis && x.symbol)
      if (roh?.symbol) m.set(l.key, roh.symbol)
    }
    return m
  }, [letzte, tradeHistorie])

  return (
    <section className="mt-4 rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
          <NotebookPen className="h-4 w-4 text-akzent" /> Journal
        </h2>
        <Link to="/training/journal" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-akzent hover:underline">
          Alle Trades <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="text-gedimmt">
          Konto <span className="tabular-nums text-white">{kontostand.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $</span>
        </span>
        <span className={`tabular-nums ${gesamt >= 0 ? 'text-long' : 'text-short'}`}>{fmtGeldVz(gesamt)}</span>
        <span className="text-gedimmt">{logischeTrades(tradeHistorie).length} Trades</span>
      </p>
      {letzte.length === 0 ? (
        <p className="mt-2 text-sm text-gedimmt">
          Noch keine Trades —{' '}
          <Link to="/training/simulator" className="text-akzent underline">
            starte eine Simulator-Session
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-rand text-xs">
          {letzte.map((t) => (
            <li key={t.key} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
              <span className="inline-flex items-baseline gap-2">
                <span className="tabular-nums text-gedimmt">{datum(t.exitTime)}</span>
                <span className={`font-semibold ${t.richtung === 'long' ? 'text-long' : 'text-short'}`}>{t.richtung === 'long' ? 'Long' : 'Short'}</span>
                <span className="text-schrift">{symbole.get(t.key) ?? ''}</span>
                <span className="text-gedimmt">{strategieName(t.strategieId)}</span>
              </span>
              <span className="tabular-nums">
                <span className={t.rMultiple >= 0 ? 'text-long' : 'text-short'}>{fmtR(t.rMultiple)}</span>
                <span className="ml-2 text-gedimmt">{fmtGeldVz(t.pnl)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
