import { useMemo } from 'react'
import type { Trade } from '../../types'
import { equityKurve, kennzahlen, logischeTrades } from '../../engine/auswertung'
import { fmtGeld, fmtGeldVz, fmtR } from '../../engine/format'
import { EquityKurve } from '../journal/EquityKurve'

function Zahl({ titel, wert, farbe, hinweis }: { titel: string; wert: string; farbe?: string; hinweis?: string }) {
  return (
    <div title={hinweis}>
      <dt className="text-[11px] text-gedimmt">{titel}</dt>
      <dd className={`tabular-nums text-sm font-semibold ${farbe ?? 'text-white'}`}>{wert}</dd>
    </div>
  )
}

const vz = (n: number) => (n >= 0 ? 'text-long' : 'text-short')

/** Live-Kennzahlen der laufenden Sitzung: Trefferquote, Erwartungswert, Drawdown, Equity-Kurve. */
export function SitzungsStatistik({ trades, startKapital }: { trades: Trade[]; startKapital: number }) {
  const logisch = useMemo(() => logischeTrades(trades), [trades])
  const k = useMemo(() => kennzahlen(logisch, startKapital), [logisch, startKapital])
  const equity = useMemo(() => equityKurve(logisch, startKapital), [logisch, startKapital])

  if (k.anzahl === 0) {
    return (
      <div className="rounded-xl border border-rand bg-flaeche p-4">
        <h3 className="text-sm font-semibold text-white">Statistik dieser Sitzung</h3>
        <p className="mt-2 text-xs text-gedimmt">
          Erscheint nach dem ersten abgeschlossenen Trade. Ab etwa 20–30 Trades werden Trefferquote und
          Erwartungswert aussagekräftig.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h3 className="text-sm font-semibold text-white">Statistik dieser Sitzung</h3>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3">
        <Zahl titel="Trades" wert={String(k.anzahl)} />
        <Zahl titel="Trefferquote" wert={`${k.trefferquote.toFixed(0)} %`} />
        <Zahl
          titel="Profit-Faktor"
          wert={Number.isFinite(k.profitFaktor) ? k.profitFaktor.toFixed(2) : '∞'}
          farbe={k.profitFaktor >= 1 ? 'text-long' : 'text-short'}
          hinweis="Summe der Gewinne geteilt durch Summe der Verluste — über 1 ist profitabel"
        />
        <Zahl titel="PnL" wert={fmtGeldVz(k.summePnl)} farbe={vz(k.summePnl)} />
        <Zahl titel="Summe R" wert={fmtR(k.summeR)} farbe={vz(k.summeR)} />
        <Zahl
          titel="Ø je Trade"
          wert={fmtR(k.durchschnittR)}
          farbe={vz(k.durchschnittR)}
          hinweis="Erwartungswert: so viel R bringt ein Trade im Schnitt"
        />
        <Zahl titel="Ø Gewinner" wert={fmtR(k.durchschnittGewinnR)} />
        <Zahl titel="Ø Verlierer" wert={fmtR(k.durchschnittVerlustR)} />
        <Zahl
          titel="Max. Drawdown"
          wert={`−${k.maxDrawdownProzent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`}
          hinweis={`Größter Rückgang vom bisherigen Höchststand des Kontos: ${fmtGeld(-k.maxDrawdown)}`}
        />
        <Zahl titel="Verlustserie" wert={`${k.laengsteVerlustserie} in Folge`} />
        {k.mfeAusbeute !== null && (
          <Zahl
            titel="MFE-Ausbeute"
            wert={`${(k.mfeAusbeute * 100).toFixed(0)} %`}
            hinweis="Wie viel vom maximalen Buchgewinn deine Gewinner am Ende mitgenommen haben"
          />
        )}
      </dl>
      <div className="mt-3">
        <EquityKurve punkte={equity} startKapital={startKapital} hoehe={130} breite={300} />
      </div>
    </div>
  )
}
