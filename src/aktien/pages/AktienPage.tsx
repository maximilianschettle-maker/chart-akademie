import { useEffect } from 'react'
import { Suche } from '../components/Suche'
import { WatchlistTabelle } from '../components/WatchlistTabelle'
import { WorkerEinstellungen } from '../components/WorkerEinstellungen'
import { Abschnitt } from '../components/ui'
import { workerKonfiguriert } from '../data/client'
import { syncStarten, useSyncFehler } from '../data/sync'
import { useAktienStore } from '../store'

/** Einstieg in den Aktien-Bereich: Suche, Watchlist, Worker-Einstellungen. */
export function AktienPage() {
  useEffect(() => syncStarten(), [])
  const syncFehler = useSyncFehler()
  // Store abonnieren, damit die Seite bei geänderten Einstellungen neu rendert
  useAktienStore((s) => s.workerUrl)
  useAktienStore((s) => s.secret)
  const konfiguriert = workerKonfiguriert()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Aktien</h1>
      <p className="mt-1 text-gedimmt">Fundamentalanalyse für US- und EU-Aktien: Bilanzen aus SEC EDGAR und Yahoo, Kennzahlen, Fair-Value-Rechner.</p>

      {!konfiguriert ? (
        <div className="mt-6 rounded-xl border border-akzent/40 bg-flaeche p-4 text-sm">
          <p className="font-semibold text-white">Noch nicht verbunden</p>
          <p className="mt-1 text-gedimmt">
            Dieser Bereich holt seine Daten über deinen eigenen Cloudflare Worker. Trag unten die Worker-URL und das Geheimnis ein (siehe README, Abschnitt „Aktien“). Der Lernpfad
            und der Simulator laufen davon unabhängig.
          </p>
        </div>
      ) : (
        <>
          <Abschnitt titel="Firma suchen" kinder={<div className="mt-2"><Suche /></div>} />
          <Abschnitt
            titel="Watchlist"
            kinder={<WatchlistTabelle />}
            rechts={syncFehler ? <span className="text-[11px] text-short">Sync: {syncFehler}</span> : <span className="text-[11px] text-gedimmt">auf allen Geräten gleich</span>}
          />
        </>
      )}

      <div className="mt-10">
        <WorkerEinstellungen offen={!konfiguriert} />
      </div>
      <p className="mt-6 text-xs text-gedimmt">
        Quellen: SEC EDGAR (XBRL „companyconcept“, geprüfte 10-K/10-Q/20-F) und Yahoo Finance (inoffiziell). Keine Anlageberatung. Zahlen können Lücken oder
        Zuordnungsfehler enthalten — im Zweifel den Geschäftsbericht lesen.
      </p>
    </div>
  )
}
