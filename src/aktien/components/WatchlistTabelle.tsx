import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Trash2 } from 'lucide-react'
import { ladeFirma } from '../data/service'
import { fmtBetrag, fmtFaktor, fmtKurs, fmtProzent, fmtZeitpunkt } from '../engine/format'
import { kennzahlen } from '../engine/kennzahlen'
import { kursFuerKennzahlen } from '../engine/waehrung'
import { useAktienStore } from '../store'
import type { Fundamentaldaten } from '../types'
import { KNOPF, QuellenBadge } from './ui'

interface Zeile {
  symbol: string
  name: string
  daten: Fundamentaldaten | null
  fehler?: string
}

/** Watchlist mit Kurs und Kernkennzahlen. Zeigt den lokalen Stand; „Auffrischen“ holt alles neu. */
export function WatchlistTabelle() {
  const watchlist = useAktienStore((s) => s.watchlist)
  const entfernen = useAktienStore((s) => s.watchlistEntfernen)
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const [laeuft, setLaeuft] = useState(false)

  const laden = useCallback(
    async (netz: boolean, frisch = false) => {
      setLaeuft(true)
      const neu: Zeile[] = []
      for (const w of watchlist) {
        try {
          const daten = await ladeFirma(w.symbol, netz ? { frisch } : { nurCache: true })
          neu.push({ symbol: w.symbol, name: daten?.firma.name ?? w.name, daten })
        } catch (e) {
          neu.push({ symbol: w.symbol, name: w.name, daten: null, fehler: e instanceof Error ? e.message : String(e) })
        }
        setZeilen([...neu, ...watchlist.slice(neu.length).map((r) => ({ symbol: r.symbol, name: r.name, daten: null }))])
      }
      setLaeuft(false)
    },
    [watchlist],
  )

  // Beim Öffnen: lokaler Cache; was dort fehlt, wird einmal vom Worker geholt.
  useEffect(() => {
    let abgebrochen = false
    ;(async () => {
      await laden(false)
      if (abgebrochen) return
      const fehlt = await Promise.all(watchlist.map(async (w) => (await ladeFirma(w.symbol, { nurCache: true })) === null))
      if (!abgebrochen && fehlt.some(Boolean)) await laden(true)
    })()
    return () => {
      abgebrochen = true
    }
  }, [laden, watchlist])

  if (watchlist.length === 0) return <p className="mt-3 text-sm text-gedimmt">Noch leer — such oben eine Firma und tipp auf „+“.</p>

  return (
    <div className="mt-3">
      <div className="flex items-center justify-end gap-2">
        <button type="button" className={KNOPF} onClick={() => laden(true, true)} disabled={laeuft}>
          <RefreshCw className={`h-3.5 w-3.5 ${laeuft ? 'animate-spin' : ''}`} /> Alle auffrischen
        </button>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-rand text-[10px] uppercase tracking-wide text-gedimmt">
              <th className="py-1.5 pr-3">Firma</th>
              <th className="py-1.5 pr-3 text-right">Kurs</th>
              <th className="py-1.5 pr-3 text-right">Marktkap.</th>
              <th className="py-1.5 pr-3 text-right">KGV</th>
              <th className="py-1.5 pr-3 text-right">FCF-Rendite</th>
              <th className="py-1.5 pr-3 text-right">Umsatz 5 J.</th>
              <th className="py-1.5 pr-3">Quellen</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {zeilen.map((z) => {
              const d = z.daten
              const k = d ? kennzahlen(d.jahre, kursFuerKennzahlen(d), d.firma.waehrung) : null
              return (
                <tr key={z.symbol} className="border-b border-rand/50">
                  <td className="py-2 pr-3">
                    <Link to={`/analyse/aktien/${encodeURIComponent(z.symbol)}`} className="font-semibold text-schrift hover:text-white">
                      {z.name}
                    </Link>
                    <div className="text-[11px] text-gedimmt">
                      {z.symbol}
                      {z.fehler && <span className="ml-2 text-short">{z.fehler}</span>}
                      {d?.veraltet && (
                        <span className="ml-2 text-akzent" title="Worker nicht erreichbar – gespeicherter Stand">
                          Stand {fmtZeitpunkt(d.standAm)}
                        </span>
                      )}
                      {!d && !z.fehler && <span className="ml-2">lädt …</span>}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right text-white">{fmtKurs(d?.kurs?.preis, d?.kurs?.waehrung)}</td>
                  <td className="py-2 pr-3 text-right">{fmtBetrag(d?.kurs?.marktkap, d?.kurs?.waehrung, 0)}</td>
                  <td className="py-2 pr-3 text-right">{fmtFaktor(k?.kgv)}</td>
                  <td className="py-2 pr-3 text-right">{fmtProzent(k?.fcfRendite)}</td>
                  <td className={`py-2 pr-3 text-right ${k?.umsatzWachstum5 !== null && k?.umsatzWachstum5 !== undefined ? (k.umsatzWachstum5 >= 0 ? 'text-long' : 'text-short') : ''}`}>
                    {fmtProzent(k?.umsatzWachstum5, 1, true)}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex gap-1">{d?.quellen.map((q) => <QuellenBadge key={q} quelle={q} />)}</span>
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" title="Von der Watchlist entfernen" className="text-gedimmt hover:text-short" onClick={() => entfernen(z.symbol)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
