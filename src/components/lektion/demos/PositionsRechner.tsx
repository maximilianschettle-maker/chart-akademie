import { useState } from 'react'
import { mengeAusRisiko } from '../../../engine/broker'

export function PositionsRechner() {
  const [konto, setKonto] = useState(10000)
  const [risikoProzent, setRisikoProzent] = useState(1)
  const [entry, setEntry] = useState(60000)
  const [sl, setSl] = useState(58800)

  const risikoBetrag = (konto * risikoProzent) / 100
  const menge = mengeAusRisiko(risikoBetrag, entry, sl)
  const positionswert = menge * entry
  const slAbstandProzent = entry > 0 ? (Math.abs(entry - sl) / entry) * 100 : 0

  const eingabeStil =
    'w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent tabular-nums'

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-6">
      <h3 className="mb-1 font-semibold text-white">Positionsgrößen-Rechner</h3>
      <p className="mb-4 text-sm text-gedimmt">
        Größe = Risikobetrag ÷ SL-Abstand. Spiele mit den Werten.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-gedimmt">
          Konto ($)
          <input
            type="number"
            value={konto}
            onChange={(e) => setKonto(Number(e.target.value))}
            className={eingabeStil}
          />
        </label>
        <label className="block text-xs text-gedimmt">
          Risiko: <span className="font-semibold text-white">{risikoProzent} %</span>
          <input
            type="range"
            min={0.25}
            max={5}
            step={0.25}
            value={risikoProzent}
            onChange={(e) => setRisikoProzent(Number(e.target.value))}
            className="mt-2.5 w-full accent-akzent"
          />
        </label>
        <label className="block text-xs text-gedimmt">
          Entry ($)
          <input
            type="number"
            value={entry}
            onChange={(e) => setEntry(Number(e.target.value))}
            className={eingabeStil}
          />
        </label>
        <label className="block text-xs text-gedimmt">
          Stop-Loss ($)
          <input
            type="number"
            value={sl}
            onChange={(e) => setSl(Number(e.target.value))}
            className={eingabeStil}
          />
        </label>
      </div>

      <div className="tabular-nums mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-nacht p-4">
          <div className="text-xs text-gedimmt">Riskierter Betrag</div>
          <div className="mt-1 text-lg font-bold text-white">
            {risikoBetrag.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $
          </div>
        </div>
        <div className="rounded-lg bg-nacht p-4">
          <div className="text-xs text-gedimmt">Positionsgröße</div>
          <div className="mt-1 text-lg font-bold text-akzent">
            {menge > 0 ? menge.toFixed(4) : '—'} BTC
          </div>
        </div>
        <div className="rounded-lg bg-nacht p-4">
          <div className="text-xs text-gedimmt">Positionswert</div>
          <div className="mt-1 text-lg font-bold text-white">
            {menge > 0
              ? `${positionswert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`
              : '—'}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gedimmt">
        SL-Abstand: {slAbstandProzent.toFixed(2)} % vom Entry. Beachte: Engerer SL → größere
        Position, weiterer SL → kleinere Position — der riskierte Betrag bleibt konstant bei{' '}
        {risikoBetrag.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $.
      </p>
    </div>
  )
}
