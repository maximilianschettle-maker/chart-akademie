import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useSimulatorStore, START_KAPITAL } from '../stores/simulatorStore'
import { statistik } from '../engine/bewertung'
import {
  logischeTrades,
  equityKurve,
  gruppiere,
  tageszeit,
  haltedauer,
  rVerteilung,
  fehlerMuster,
} from '../engine/auswertung'
import { strategieName } from '../content/strategien'
import { TradeHistorie } from '../components/simulator/TradeHistorie'
import { EquityKurve } from '../components/journal/EquityKurve'
import { RVerteilung } from '../components/journal/RVerteilung'
import { Auswertungstabelle } from '../components/journal/Auswertungstabelle'
import { Fehlermuster } from '../components/journal/Fehlermuster'
import { SetupBilanz } from '../components/journal/SetupBilanz'

function Kachel({ titel, wert, farbe }: { titel: string; wert: string; farbe?: string }) {
  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <div className="text-xs text-gedimmt">{titel}</div>
      <div className={`tabular-nums mt-1 text-lg font-bold ${farbe ?? 'text-white'}`}>{wert}</div>
    </div>
  )
}

export function JournalPage() {
  const { kontostand, tradeHistorie, rueckblicke, zuruecksetzen } = useSimulatorStore()
  const [bestaetigen, setBestaetigen] = useState(false)
  const gesamtPnl = kontostand - START_KAPITAL

  const logisch = useMemo(() => logischeTrades(tradeHistorie), [tradeHistorie])
  const stats = useMemo(() => statistik(tradeHistorie), [tradeHistorie])
  const equity = useMemo(() => equityKurve(logisch, START_KAPITAL), [logisch])
  const bins = useMemo(() => rVerteilung(logisch), [logisch])
  const nachSetup = useMemo(() => gruppiere(logisch, (t) => strategieName(t.strategieId)), [logisch])
  const nachZeit = useMemo(() => gruppiere(logisch, tageszeit), [logisch])
  const nachDauer = useMemo(() => gruppiere(logisch, haltedauer), [logisch])
  const hinweise = useMemo(() => fehlerMuster(logisch), [logisch])
  const gebuehren = tradeHistorie.reduce((s, t) => s + (t.gebuehren ?? 0) + (t.funding ?? 0), 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Trade-Journal</h1>
      <p className="mt-1 text-sm text-gedimmt">
        Alle Trades aus deinen Simulator-Sessions — dein wichtigstes Lernwerkzeug.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kachel
          titel="Kontostand"
          wert={`${kontostand.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`}
        />
        <Kachel
          titel="Gesamt-PnL"
          wert={`${gesamtPnl >= 0 ? '+' : ''}${gesamtPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`}
          farbe={gesamtPnl >= 0 ? 'text-long' : 'text-short'}
        />
        <Kachel titel="Trades" wert={`${logisch.length}${stats.anzahl !== logisch.length ? ` (${stats.anzahl} Exits)` : ''}`} />
        <Kachel titel="Trefferquote" wert={`${(logisch.length ? (logisch.filter((t) => t.pnl > 0).length / logisch.length) * 100 : 0).toFixed(0)} %`} />
        <Kachel
          titel="Ø R-Multiple"
          wert={`${stats.durchschnittR >= 0 ? '+' : ''}${(logisch.length ? logisch.reduce((s, t) => s + t.rMultiple, 0) / logisch.length : 0).toFixed(2)}`}
          farbe={stats.durchschnittR >= 0 ? 'text-long' : 'text-short'}
        />
        <Kachel
          titel="Profit-Faktor"
          wert={Number.isFinite(stats.profitFaktor) ? stats.profitFaktor.toFixed(2) : '∞'}
        />
        <Kachel
          titel="Max. Drawdown"
          wert={`−${stats.maxDrawdown.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`}
          farbe="text-short"
        />
        <Kachel
          titel="Gebühren + Funding"
          wert={`−${gebuehren.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`}
          farbe="text-gedimmt"
        />
      </div>

      <div className="mt-6 rounded-xl border border-rand bg-flaeche p-4">
        <h2 className="text-sm font-semibold text-white">Equity-Kurve</h2>
        <p className="mb-2 text-xs text-gedimmt">Kontostand nach jedem abgeschlossenen Trade. Gestrichelt: Startkapital.</p>
        <EquityKurve punkte={equity} startKapital={START_KAPITAL} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-rand bg-flaeche p-4">
          <h2 className="text-sm font-semibold text-white">R-Verteilung</h2>
          <p className="mb-3 text-xs text-gedimmt">
            Ein gesundes System: viele kleine Verlierer um −1R, einige Gewinner ab +1,5R.
          </p>
          <RVerteilung bins={bins} />
        </div>
        <Fehlermuster hinweise={hinweise} anzahlTrades={logisch.length} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Auswertungstabelle
          titel="Nach Setup"
          gruppen={nachSetup}
          hinweis="Setup-Tag aus dem Order-Ticket. Welches deiner Setups verdient Geld?"
        />
        <Auswertungstabelle
          titel="Nach Tageszeit (Entry, UTC)"
          gruppen={nachZeit}
          hinweis="Historische Sessions — zeigt, in welcher Marktphase deine Entries funktionieren."
        />
        <Auswertungstabelle
          titel="Nach Haltedauer"
          gruppen={nachDauer}
          hinweis="In Kerzen des jeweiligen Timeframes."
        />
        <Auswertungstabelle
          titel="Nach Richtung"
          gruppen={gruppiere(logisch, (t) => (t.richtung === 'long' ? 'Long' : 'Short'))}
        />
      </div>

      <div className="mt-4">
        <SetupBilanz rueckblicke={rueckblicke} />
      </div>

      <div className="mt-6 rounded-xl border border-rand bg-flaeche p-4">
        <h2 className="mb-2 text-sm font-semibold text-white">Alle Exits</h2>
        <TradeHistorie trades={tradeHistorie} mitSetup mitExkursion mitZeit />
      </div>

      <div className="mt-8 border-t border-rand pt-4">
        {bestaetigen ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
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
