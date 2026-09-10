import { useState } from 'react'
import { X, Scissors, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import type { Order, Position } from '../../types'

interface PositionPanelProps {
  position: Position | null
  offeneOrder: Order | null
  aktuellerPreis: number
  onSchliessen: () => void
  onStornieren: () => void
  onTeilSchliessen?: (anteil: number) => void
  onBreakEven?: () => void
  onStopsSetzen?: (neu: { stopLoss?: number; takeProfit?: number; trailingAbstand?: number | null }) => void
}

function geld(n: number, stellen = 2) {
  return n.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

function zahl(wert: string): number {
  const n = parseFloat(wert.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function PositionPanel({
  position,
  offeneOrder,
  aktuellerPreis,
  onSchliessen,
  onStornieren,
  onTeilSchliessen,
  onBreakEven,
  onStopsSetzen,
}: PositionPanelProps) {
  const [bearbeiten, setBearbeiten] = useState(false)
  const [slText, setSlText] = useState('')
  const [tpText, setTpText] = useState('')
  const [trailingText, setTrailingText] = useState('')

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
  const rOffen = position.risikoBetrag > 0 ? pnl / position.risikoBetrag : 0
  const imGewinn = pnl > 0
  const breakEvenAktiv = Math.abs(position.stopLoss - position.entryPreis) < 1e-9

  function uebernehmen() {
    const neu: { stopLoss?: number; takeProfit?: number; trailingAbstand?: number | null } = {}
    if (slText.trim()) neu.stopLoss = zahl(slText)
    if (tpText.trim()) neu.takeProfit = zahl(tpText)
    if (trailingText.trim()) {
      const t = zahl(trailingText)
      neu.trailingAbstand = t > 0 ? t : null
    }
    onStopsSetzen?.(neu)
    setSlText('')
    setTpText('')
    setTrailingText('')
    setBearbeiten(false)
  }

  const knopf =
    'inline-flex items-center gap-1 rounded-lg bg-nacht px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
  const eingabeStil =
    'w-full rounded-lg border border-rand bg-nacht px-2 py-1.5 text-sm text-schrift outline-none focus:border-akzent'

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
            {geld(position.menge, 6)} · Entry {geld(position.entryPreis)} $ · SL {geld(position.stopLoss)} $
            {breakEvenAktiv && <span className="text-akzent"> (BE)</span>} · TP {geld(position.takeProfit)} $
            {position.trailingAbstand && (
              <span className="text-akzent"> · Trailing {geld(position.trailingAbstand, 0)} $</span>
            )}
          </span>
        </div>
        <div className={`tabular-nums text-sm font-bold ${pnl >= 0 ? 'text-long' : 'text-short'}`}>
          {pnl >= 0 ? '+' : ''}
          {geld(pnl)} $ <span className="font-normal opacity-80">({rOffen >= 0 ? '+' : ''}{rOffen.toFixed(2)}R)</span>
        </div>
      </div>

      {position.fundingKosten !== 0 && (
        <p className="tabular-nums mt-1 text-xs text-gedimmt">
          Funding bisher:{' '}
          <span className={position.fundingKosten > 0 ? 'text-short' : 'text-long'}>
            {position.fundingKosten > 0 ? '−' : '+'}
            {geld(Math.abs(position.fundingKosten))} $
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onSchliessen} className={knopf}>
          Position schließen
        </button>
        {onTeilSchliessen && (
          <button onClick={() => onTeilSchliessen(0.5)} className={knopf} title="Hälfte glattstellen, Rest laufen lassen">
            <Scissors className="h-3.5 w-3.5" /> 50 % raus
          </button>
        )}
        {onBreakEven && (
          <button
            onClick={onBreakEven}
            disabled={!imGewinn || breakEvenAktiv}
            className={knopf}
            title={imGewinn ? 'SL auf den Einstiegskurs ziehen' : 'Erst möglich, wenn die Position im Gewinn liegt'}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> SL → Break-even
          </button>
        )}
        {onStopsSetzen && (
          <button onClick={() => setBearbeiten((b) => !b)} className={knopf}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> SL/TP ändern
          </button>
        )}
      </div>

      {bearbeiten && (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-nacht/60 p-3 sm:grid-cols-3">
          <label className="block text-xs text-gedimmt">
            Neuer SL
            <input value={slText} onChange={(e) => setSlText(e.target.value)} placeholder={geld(position.stopLoss)} className={eingabeStil} inputMode="decimal" />
          </label>
          <label className="block text-xs text-gedimmt">
            Neuer TP
            <input value={tpText} onChange={(e) => setTpText(e.target.value)} placeholder={geld(position.takeProfit)} className={eingabeStil} inputMode="decimal" />
          </label>
          <label className="block text-xs text-gedimmt">
            Trailing ($, 0 = aus)
            <input
              value={trailingText}
              onChange={(e) => setTrailingText(e.target.value)}
              placeholder={position.trailingAbstand ? geld(position.trailingAbstand, 0) : 'aus'}
              className={eingabeStil}
              inputMode="decimal"
            />
          </label>
          <div className="sm:col-span-3 flex items-center gap-2">
            <button onClick={uebernehmen} className="rounded-lg bg-akzent px-3 py-1.5 text-xs font-bold text-nacht hover:brightness-110">
              Übernehmen
            </button>
            <span className="text-xs text-gedimmt">
              Ein SL/TP auf der falschen Seite des Kurses wird ignoriert.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
