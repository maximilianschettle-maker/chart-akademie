import { TriangleAlert, Info, Sparkles } from 'lucide-react'
import type { Hinweis } from '../../engine/auswertung'

export function Fehlermuster({ hinweise, anzahlTrades }: { hinweise: Hinweis[]; anzahlTrades: number }) {
  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h3 className="text-sm font-semibold text-white">Muster in deinem Journal</h3>
      <p className="mt-0.5 text-xs text-gedimmt">
        Regelbasiert aus deinen Trades abgeleitet — kein Urteil, sondern Hinweise, wo du genauer hinschauen solltest.
      </p>
      {anzahlTrades < 3 ? (
        <p className="mt-3 text-xs text-gedimmt">Ab drei abgeschlossenen Trades wird hier ausgewertet.</p>
      ) : hinweise.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-long">
          <Sparkles className="h-4 w-4" /> Keine auffälligen Muster — sauberes Handwerk.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {hinweise.map((h) => {
            const Icon = h.schwere === 'warnung' ? TriangleAlert : Info
            return (
              <li
                key={h.id}
                className={`rounded-lg border p-3 ${h.schwere === 'warnung' ? 'border-akzent/40' : 'border-rand'}`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon className={`h-4 w-4 ${h.schwere === 'warnung' ? 'text-akzent' : 'text-gedimmt'}`} />
                  {h.titel}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-schrift">{h.text}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
