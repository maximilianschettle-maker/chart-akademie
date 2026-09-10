import { useState } from 'react'
import type { RBin } from '../../engine/auswertung'

// Histogramm der R-Multiples: Verlust-Bins rot, Gewinn-Bins grün (Polarität),
// dünne Balken mit 2px Abstand, Hover-Tooltip pro Balken, Werte als Text.

export function RVerteilung({ bins }: { bins: RBin[] }) {
  const [aktiv, setAktiv] = useState<number | null>(null)
  const max = Math.max(1, ...bins.map((b) => b.anzahl))
  const gesamt = bins.reduce((s, b) => s + b.anzahl, 0)

  if (gesamt === 0) {
    return <p className="py-8 text-center text-sm text-gedimmt">Noch keine Trades für eine Verteilung.</p>
  }

  return (
    <div>
      <div className="flex h-36 items-end gap-0.5" role="img" aria-label="Verteilung der R-Multiples">
        {bins.map((b, i) => {
          const h = (b.anzahl / max) * 100
          const verlust = b.bis <= 0
          return (
            <div
              key={b.label}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setAktiv(i)}
              onMouseLeave={() => setAktiv(null)}
            >
              {b.anzahl > 0 && (
                <span className="tabular-nums mb-1 text-center text-[10px] text-gedimmt">{b.anzahl}</span>
              )}
              <div
                className={`w-full rounded-t ${verlust ? 'bg-short' : 'bg-long'} ${aktiv === i ? 'brightness-125' : ''}`}
                style={{ height: `${Math.max(b.anzahl > 0 ? 3 : 0, h)}%` }}
              />
              {aktiv === i && (
                <div className="tabular-nums pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-rand bg-nacht/95 px-2 py-1 text-[11px] text-gedimmt">
                  {b.label}: <span className="text-white">{b.anzahl}</span> ({Math.round((b.anzahl / gesamt) * 100)} %)
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-0.5">
        {bins.map((b) => (
          <div key={b.label} className="flex-1 truncate text-center text-[10px] text-gedimmt" title={b.label}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  )
}
