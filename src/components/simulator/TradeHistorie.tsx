import type { ExitGrund, Trade } from '../../types'
import { strategieName } from '../../content/strategien'

const GRUND_TEXT: Record<ExitGrund, string> = {
  sl: 'Stop-Loss',
  tp: 'Take-Profit',
  manuell: 'Manuell',
  szenarioEnde: 'Session-Ende',
  teil: 'Teilverkauf',
  trailing: 'Trailing-Stop',
}

export function TradeHistorie({ trades, mitSetup = false }: { trades: Trade[]; mitSetup?: boolean }) {
  if (trades.length === 0) {
    return <p className="py-6 text-center text-sm text-gedimmt">Noch keine Trades.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-rand text-xs uppercase tracking-wide text-gedimmt">
            <th className="py-2 pr-3">Richtung</th>
            {mitSetup && <th className="py-2 pr-3">Setup</th>}
            <th className="py-2 pr-3">Entry</th>
            <th className="py-2 pr-3">Exit</th>
            <th className="py-2 pr-3">Grund</th>
            <th className="py-2 pr-3 text-right">R</th>
            <th className="py-2 text-right">PnL</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...trades].reverse().map((t) => (
            <tr key={t.id} className="border-b border-rand/50">
              <td className={`py-2 pr-3 font-semibold uppercase ${t.richtung === 'long' ? 'text-long' : 'text-short'}`}>
                {t.richtung}
              </td>
              {mitSetup && <td className="py-2 pr-3 text-gedimmt">{strategieName(t.strategieId)}</td>}
              <td className="py-2 pr-3">{t.entryPreis.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 pr-3">{t.exitPreis.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</td>
              <td className="py-2 pr-3 text-gedimmt">{GRUND_TEXT[t.exitGrund] ?? t.exitGrund}</td>
              <td className={`py-2 pr-3 text-right ${t.rMultiple >= 0 ? 'text-long' : 'text-short'}`}>
                {t.rMultiple >= 0 ? '+' : ''}
                {t.rMultiple.toFixed(2)}R
              </td>
              <td className={`py-2 text-right font-semibold ${t.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                {t.pnl >= 0 ? '+' : ''}
                {t.pnl.toLocaleString('de-DE', { maximumFractionDigits: 2 })} $
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
