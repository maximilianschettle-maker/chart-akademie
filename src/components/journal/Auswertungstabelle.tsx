import type { Gruppe } from '../../engine/auswertung'

// Gruppen-Auswertung (Setup, Tageszeit, Haltedauer) als Tabelle mit einem
// dünnen Balken für die Summe R — Text trägt die Werte, der Balken nur den Vergleich.

export function Auswertungstabelle({ titel, gruppen, hinweis }: { titel: string; gruppen: Gruppe[]; hinweis?: string }) {
  const sortiert = [...gruppen].sort((a, b) => b.summeR - a.summeR)
  const maxAbs = Math.max(0.01, ...gruppen.map((g) => Math.abs(g.summeR)))

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h3 className="text-sm font-semibold text-white">{titel}</h3>
      {hinweis && <p className="mt-0.5 text-xs text-gedimmt">{hinweis}</p>}
      {sortiert.length === 0 ? (
        <p className="py-4 text-center text-xs text-gedimmt">Noch keine Daten.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-rand text-[10px] uppercase tracking-wide text-gedimmt">
                <th className="py-1.5 pr-3">Gruppe</th>
                <th className="py-1.5 pr-3 text-right">Trades</th>
                <th className="py-1.5 pr-3 text-right">Treffer</th>
                <th className="py-1.5 pr-3 text-right">Ø R</th>
                <th className="py-1.5 pr-3 text-right">Σ R</th>
                <th className="py-1.5 w-28"></th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sortiert.map((g) => (
                <tr key={g.label} className="border-b border-rand/50">
                  <td className="py-1.5 pr-3 text-schrift">{g.label}</td>
                  <td className="py-1.5 pr-3 text-right">{g.anzahl}</td>
                  <td className="py-1.5 pr-3 text-right">{g.trefferquote.toFixed(0)} %</td>
                  <td className={`py-1.5 pr-3 text-right ${g.durchschnittR >= 0 ? 'text-long' : 'text-short'}`}>
                    {g.durchschnittR >= 0 ? '+' : ''}
                    {g.durchschnittR.toFixed(2)}
                  </td>
                  <td className={`py-1.5 pr-3 text-right font-semibold ${g.summeR >= 0 ? 'text-long' : 'text-short'}`}>
                    {g.summeR >= 0 ? '+' : ''}
                    {g.summeR.toFixed(1)}R
                  </td>
                  <td className="py-1.5">
                    <div className="flex h-2 items-center">
                      <div className="relative h-1 w-full rounded bg-nacht">
                        <div
                          className={`absolute top-0 h-1 rounded ${g.summeR >= 0 ? 'bg-long' : 'bg-short'}`}
                          style={{
                            width: `${(Math.abs(g.summeR) / maxAbs) * 50}%`,
                            left: g.summeR >= 0 ? '50%' : `${50 - (Math.abs(g.summeR) / maxAbs) * 50}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
