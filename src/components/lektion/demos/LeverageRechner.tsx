import { useState } from 'react'
import type { Richtung } from '../../../types'

// Vereinfachte Liquidationsformel (ohne Wartungsmarge/Gebühren):
// Long:  liq = entry * (1 - 1/hebel)   Short: liq = entry * (1 + 1/hebel)
// Reale Börsen liquidieren wegen der Wartungsmarge etwas FRÜHER.

export function LeverageRechner() {
  const [richtung, setRichtung] = useState<Richtung>('long')
  const [hebel, setHebel] = useState(10)
  const entry = 60000

  const liqPreis =
    richtung === 'long' ? entry * (1 - 1 / hebel) : entry * (1 + 1 / hebel)
  const abstandProzent = (Math.abs(liqPreis - entry) / entry) * 100

  const gefahr =
    abstandProzent < 2 ? 'extrem' : abstandProzent < 5 ? 'hoch' : abstandProzent < 10 ? 'erhöht' : 'moderat'
  const gefahrFarbe =
    gefahr === 'extrem' || gefahr === 'hoch' ? 'text-short' : gefahr === 'erhöht' ? 'text-akzent' : 'text-long'

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-6">
      <h3 className="mb-1 font-semibold text-white">Liquidations-Rechner</h3>
      <p className="mb-4 text-sm text-gedimmt">
        Entry fix bei 60.000 $ — spiele mit Hebel und Richtung.
      </p>

      <div className="mb-4 flex gap-2">
        {(['long', 'short'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRichtung(r)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold uppercase transition-colors ${
              richtung === r
                ? r === 'long'
                  ? 'bg-long text-nacht'
                  : 'bg-short text-white'
                : 'bg-nacht text-gedimmt hover:text-schrift'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-sm text-gedimmt">
        Hebel: <span className="font-semibold text-white">{hebel}x</span>
      </label>
      <input
        type="range"
        min={2}
        max={125}
        value={hebel}
        onChange={(e) => setHebel(Number(e.target.value))}
        className="w-full accent-akzent"
      />
      <div className="mt-1 flex justify-between text-xs text-gedimmt">
        <span>2x</span>
        <span>125x</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-nacht p-4">
          <div className="text-xs text-gedimmt">Liquidationspreis (ca.)</div>
          <div className="tabular-nums mt-1 text-lg font-bold text-white">
            {liqPreis.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $
          </div>
        </div>
        <div className="rounded-lg bg-nacht p-4">
          <div className="text-xs text-gedimmt">Abstand zum Entry</div>
          <div className="tabular-nums mt-1 text-lg font-bold text-white">
            {richtung === 'long' ? '−' : '+'}
            {abstandProzent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %
          </div>
        </div>
        <div className="rounded-lg bg-nacht p-4">
          <div className="text-xs text-gedimmt">Gefahr durch Marktrauschen</div>
          <div className={`mt-1 text-lg font-bold capitalize ${gefahrFarbe}`}>{gefahr}</div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gedimmt">
        Vereinfachte Rechnung ohne Wartungsmarge und Gebühren — echte Börsen liquidieren etwas
        früher. Zur Einordnung: BTC schwankt an normalen Tagen 2–5 %.
      </p>
    </div>
  )
}
