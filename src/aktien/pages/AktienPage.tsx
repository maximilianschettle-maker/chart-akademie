import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Suche } from '../components/Suche'
import { WatchlistTabelle } from '../components/WatchlistTabelle'
import { ZugangKarte } from '../../zugang/ZugangKarte'
import { DatenStatus } from '../components/DatenStatus'
import { Abschnitt } from '../components/ui'
import { codeVorhanden } from '../data/client'
import { syncStarten, useSyncFehler } from '../data/sync'
import { useAktienStore } from '../store'

/** Einstieg in den Aktien-Bereich: Suche, Watchlist, Zugang. */
export function AktienPage() {
  useEffect(() => syncStarten(), [])
  const syncFehler = useSyncFehler()
  // Store abonnieren, damit die Seite bei Code-Wechsel neu rendert
  useAktienStore((s) => s.code)
  const konfiguriert = codeVorhanden()
  const watchlist = useAktienStore((s) => s.watchlist)
  const vergleichZiel = `/aktien/vergleich?s=${encodeURIComponent(watchlist.slice(0, 4).map((w) => w.symbol).join(','))}`

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold text-white">Aktien</h1>
        <DatenStatus />
      </div>
      <p className="mt-1 text-gedimmt">Fundamentalanalyse für US- und EU-Aktien: Bilanzen aus SEC EDGAR und Yahoo, Kennzahlen, Fair-Value-Rechner.</p>

      {!konfiguriert ? (
        <div className="mt-6">
          <ZugangKarte />
        </div>
      ) : (
        <>
          <Abschnitt titel="Firma suchen" kinder={<div className="mt-2"><Suche /></div>} />
          <Abschnitt
            titel="Watchlist"
            kinder={<WatchlistTabelle />}
            rechts={
              <span className="flex items-center gap-3 text-[11px]">
                {syncFehler ? <span className="text-short">Sync: {syncFehler}</span> : <span className="text-gedimmt">auf allen Geräten gleich</span>}
                {watchlist.length >= 2 && (
                  <Link to={vergleichZiel} className="font-semibold text-akzent hover:underline">
                    Vergleichen →
                  </Link>
                )}
              </span>
            }
          />
        </>
      )}

      {konfiguriert && (
        <div className="mt-10">
          <ZugangKarte kompakt />
        </div>
      )}
      <p className="mt-6 text-xs text-gedimmt">
        Quellen: SEC EDGAR (XBRL „companyconcept“, geprüfte 10-K/10-Q/20-F) und Yahoo Finance (inoffiziell). Keine Anlageberatung. Zahlen können Lücken oder
        Zuordnungsfehler enthalten — im Zweifel den Geschäftsbericht lesen.
      </p>
    </div>
  )
}
