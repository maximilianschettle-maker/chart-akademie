import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Star } from 'lucide-react'
import { useAktienStore } from '../../aktien/store'
import { workerKonfiguriert } from '../../aktien/data/client'
import { ladeFirma, ladeKurs } from '../../aktien/data/service'
import { fmtBetrag, fmtKurs, fmtZeitpunkt } from '../../aktien/engine/format'
import type { Kurs } from '../../aktien/types'

// Startseite: Aktien-Watchlist kompakt (Name, Kurs, Marktkapitalisierung). Erst aus dem
// Gerätespeicher, dann frische Kurse vom Worker (15-Minuten-Cache, mit Wiederholung).

interface Zeile {
  symbol: string
  name: string
  kurs: Kurs | null
  marktkap?: number
  waehrung?: string
}

export function WatchlistKompakt() {
  const watchlist = useAktienStore((s) => s.watchlist)
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const schluessel = watchlist.map((w) => w.symbol).join(',')

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      const basis: Zeile[] = []
      for (const w of watchlist) {
        const d = await ladeFirma(w.symbol, { nurCache: true }).catch(() => null)
        basis.push({ symbol: w.symbol, name: d?.firma.name ?? w.name, kurs: d?.kurs ?? null, marktkap: d?.kurs?.marktkap, waehrung: d?.kurs?.waehrung })
      }
      if (!aktiv) return
      setZeilen(basis)
      if (!workerKonfiguriert()) return
      const kurse = await Promise.all(watchlist.map((w) => ladeKurs(w.symbol).catch(() => null)))
      if (!aktiv) return
      setZeilen(basis.map((z, i) => (kurse[i] ? { ...z, kurs: kurse[i], marktkap: kurse[i]?.marktkap ?? z.marktkap, waehrung: kurse[i]?.waehrung ?? z.waehrung } : z)))
    })()
    return () => {
      aktiv = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel])

  return (
    <section className="mt-4 rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
          <Star className="h-4 w-4 text-akzent" /> Watchlist
        </h2>
        <Link to="/analyse/aktien" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-akzent hover:underline">
          Aktien <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {watchlist.length === 0 ? (
        <p className="mt-2 text-sm text-gedimmt">
          Noch leer — unter{' '}
          <Link to="/analyse/aktien" className="text-akzent underline">
            Aktien
          </Link>{' '}
          eine Firma suchen und mit „+“ merken.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-rand text-sm">
          {(zeilen.length ? zeilen : watchlist.map((w) => ({ symbol: w.symbol, name: w.name, kurs: null }) as Zeile)).map((z) => (
            <li key={z.symbol}>
              <Link to={`/analyse/aktien/${encodeURIComponent(z.symbol)}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 hover:text-white">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-schrift">{z.name}</span>
                  <span className="text-[11px] text-gedimmt">
                    {z.symbol}
                    {z.kurs?.veraltet && <span className="ml-2 text-akzent">Stand {z.kurs.standAm ? fmtZeitpunkt(z.kurs.standAm) : 'alt'}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block text-white">{z.kurs ? fmtKurs(z.kurs.preis, z.kurs.waehrung) : '–'}</span>
                  <span className="block text-[11px] text-gedimmt">{z.marktkap ? fmtBetrag(z.marktkap, z.waehrung, 0) : ''}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
