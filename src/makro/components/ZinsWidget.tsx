import { Link } from 'react-router-dom'
import { ArrowRight, Landmark, RefreshCw, TriangleAlert } from 'lucide-react'
import { useMakro } from '../useMakro'
import { istVeraltet } from '../laden'
import { fmtStand } from '../format'
import { ZinsKarte } from './ZinsKarte'

// Dashboard-Widget „Nächste Zinsentscheidung“: Fed und EZB kompakt, Stand, Link zur Makro-Seite.
// Ohne Daten (JSON fehlt, Netz weg) zeigt es einen Hinweis statt zu crashen.

export function ZinsWidget() {
  const { daten, status, fehler, ausCache, jetzt, neuLaden } = useMakro()

  return (
    <section className="mt-6 rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
          <Landmark className="h-4 w-4 text-akzent" /> Nächste Zinsentscheidung
        </h2>
        <Link to="/analyse/makro" className="inline-flex items-center gap-1 text-xs font-semibold text-akzent hover:underline">
          Details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {status === 'laedt' && <p className="mt-3 text-sm text-gedimmt">Lade Zinsdaten …</p>}

      {status === 'fehler' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gedimmt">
          <span className="inline-flex items-center gap-1.5">
            <TriangleAlert className="h-4 w-4 text-akzent" /> Zinsdaten gerade nicht verfügbar{fehler ? ` (${fehler})` : ''}.
          </span>
          <button onClick={neuLaden} className="inline-flex items-center gap-1 text-xs text-akzent hover:underline">
            <RefreshCw className="h-3 w-3" /> Erneut laden
          </button>
        </div>
      )}

      {daten && (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ZinsKarte bank="fed" daten={daten.fed} jetzt={jetzt} kompakt />
            <ZinsKarte bank="ezb" daten={daten.ezb} jetzt={jetzt} kompakt />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-gedimmt">
            <span>Stand: {fmtStand(daten.lastUpdated)} Uhr</span>
            {istVeraltet(daten, jetzt) && (
              <span className="inline-flex items-center gap-1 text-akzent">
                <TriangleAlert className="h-3 w-3" /> älter als 36 Stunden
              </span>
            )}
            {ausCache && <span>(aus dem Gerätespeicher, Netz nicht erreichbar)</span>}
          </p>
        </>
      )}
    </section>
  )
}
