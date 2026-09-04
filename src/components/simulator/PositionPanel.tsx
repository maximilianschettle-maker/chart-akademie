import { X } from 'lucide-react'
import type { Order, Position } from '../../types'

interface PositionPanelProps {
  position: Position | null
  offeneOrder: Order | null
  aktuellerPreis: number
  onSchliessen: () => void
  onStornieren: () => void
}

function geld(n: number, stellen = 2) {
  return n.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

export function PositionPanel({
  position,
  offeneOrder,
  aktuellerPreis,
  onSchliessen,
  onStornieren,
}: PositionPanelProps) {
  if (!position && !offeneOrder) return null

  if (offeneOrder && !position) {
    return (
      <div className="rounded-xl border border-akzent/40 bg-flaeche p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-bold uppercase text-akzent">{offeneOrder.richtung}</span>{' '}
            <span className="text-gedimmt">
              {offeneOrder.typ === 'limit'
                ? `Limit @ ${geld(offeneOrder.limitPreis ?? 0)} $ — wartet auf Ausführung`
                : 'Market — füllt mit der nächsten Kerze'}
            </span>
          </div>
          <button
            onClick={onStornieren}
            className="inline-flex items-center gap-1 rounded-lg bg-nacht px-3 py-1.5 text-xs text-gedimmt hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Stornieren
          </button>
        </div>
      </div>
    )
  }

  if (!position) return null
  const pnl =
    position.richtung === 'long'
      ? (aktuellerPreis - position.entryPreis) * position.menge
      : (position.entryPreis - aktuellerPreis) * position.menge

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span
            className={`font-bold uppercase ${position.richtung === 'long' ? 'text-long' : 'text-short'}`}
          >
            {position.richtung}
          </span>{' '}
          <span className="tabular-nums text-gedimmt">
            Entry {geld(position.entryPreis)} $ · SL {geld(position.stopLoss)} $ · TP{' '}
            {geld(position.takeProfit)} $
          </span>
        </div>
        <div
          className={`tabular-nums text-sm font-bold ${pnl >= 0 ? 'text-long' : 'text-short'}`}
        >
          {pnl >= 0 ? '+' : ''}
          {geld(pnl)} $
        </div>
        <button
          onClick={onSchliessen}
          className="rounded-lg bg-nacht px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white"
        >
          Position schließen
        </button>
      </div>
    </div>
  )
}
