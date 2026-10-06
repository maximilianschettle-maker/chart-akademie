import type { ExitGrund, Trade } from '../../types'
import { strategieName } from '../../content/strategien'
import { fmtGeldVz, fmtPreis, fmtR } from '../../engine/format'

const GRUND_TEXT: Record<ExitGrund, string> = {
  sl: 'Stop-Loss',
  tp: 'Take-Profit',
  manuell: 'Manuell',
  szenarioEnde: 'Session-Ende',
  teil: 'Teilverkauf',
  trailing: 'Trailing-Stop',
}

function zeit(t: number) {
  return new Date(t * 1000).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

interface TradeHistorieProps {
  trades: Trade[]
  mitSetup?: boolean
  /** MFE/MAE-Spalten: wie weit lief der Kurs maximal für bzw. gegen den Trade? */
  mitExkursion?: boolean
  /** Einstiegszeit (UTC) zeigen — im Blind-Modus erst nach der Auflösung */
  mitZeit?: boolean
}

export function TradeHistorie({ trades, mitSetup = false, mitExkursion = false, mitZeit = false }: TradeHistorieProps) {
  if (trades.length === 0) {
    return <p className="py-6 text-center text-sm text-gedimmt">Noch keine Trades.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-rand text-xs uppercase tracking-wide text-gedimmt">
            <th className="py-2 pr-3">Richtung</th>
            {mitZeit && <th className="py-2 pr-3">Einstieg (UTC)</th>}
            {mitSetup && <th className="py-2 pr-3">Setup</th>}
            <th className="py-2 pr-3">Entry</th>
            <th className="py-2 pr-3">Exit</th>
            <th className="py-2 pr-3">Grund</th>
            {mitExkursion && (
              <>
                <th className="py-2 pr-3 text-right" title="Maximaler Buchgewinn während der Haltezeit">
                  MFE
                </th>
                <th className="py-2 pr-3 text-right" title="Maximaler Buchverlust während der Haltezeit">
                  MAE
                </th>
              </>
            )}
            <th className="py-2 pr-3 text-right">R</th>
            <th className="py-2 text-right">PnL</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...trades].reverse().map((t) => (
            <tr key={t.id} className="border-b border-rand/50" title={t.notiz}>
              <td className={`py-2 pr-3 font-semibold uppercase ${t.richtung === 'long' ? 'text-long' : 'text-short'}`}>
                {t.richtung}
              </td>
              {mitZeit && <td className="whitespace-nowrap py-2 pr-3 text-gedimmt">{zeit(t.entryTime)}</td>}
              {mitSetup && (
                <td className="py-2 pr-3 text-gedimmt">
                  {strategieName(t.strategieId)}
                  {t.notiz && <span className="block max-w-[14rem] truncate text-[11px] opacity-70">{t.notiz}</span>}
                </td>
              )}
              <td className="py-2 pr-3">{fmtPreis(t.entryPreis)}</td>
              <td className="py-2 pr-3">{fmtPreis(t.exitPreis, t.entryPreis)}</td>
              <td className="py-2 pr-3 text-gedimmt">{GRUND_TEXT[t.exitGrund] ?? t.exitGrund}</td>
              {mitExkursion && (
                <>
                  <td className="py-2 pr-3 text-right text-gedimmt">
                    {t.mfeR !== undefined ? `+${t.mfeR.toFixed(2)}R` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right text-gedimmt">
                    {t.maeR !== undefined ? `−${t.maeR.toFixed(2)}R` : '—'}
                  </td>
                </>
              )}
              <td className={`py-2 pr-3 text-right ${t.rMultiple >= 0 ? 'text-long' : 'text-short'}`}>
                {fmtR(t.rMultiple)}
              </td>
              <td className={`py-2 text-right font-semibold ${t.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                {fmtGeldVz(t.pnl, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
