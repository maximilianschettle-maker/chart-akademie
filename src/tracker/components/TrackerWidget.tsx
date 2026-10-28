import { Link } from 'react-router-dom'
import { Activity, ArrowRight, TriangleAlert } from 'lucide-react'
import { useTracker } from '../useTracker'
import { fmtDatumKurz, fmtKurs, fmtProzentVz, fmtStand, richtungFarbe } from '../format'

// Dashboard-Karte: Kurse auf einen Blick und die neuesten Signale.

export function TrackerWidget() {
  const { daten, status, fehler } = useTracker()
  const signale = daten
    ? daten.instrumente
        .flatMap((i) => i.signale.map((s) => ({ ...s, name: i.name })))
        .sort((a, b) => b.datum.localeCompare(a.datum) || b.zeit.localeCompare(a.zeit))
        .slice(0, 4)
    : []

  return (
    <section className="mt-4 rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
          <Activity className="h-4 w-4 text-akzent" /> Markt-Tracker
        </h2>
        <Link to="/tracker" className="inline-flex items-center gap-1 text-xs font-semibold text-akzent hover:underline">
          Details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {status === 'laedt' && <p className="mt-3 text-sm text-gedimmt">Lade Kurse …</p>}
      {status === 'fehler' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-gedimmt">
          <TriangleAlert className="h-4 w-4 text-akzent" /> Noch keine Tracker-Daten{fehler ? ` (${fehler})` : ''}. Sie entstehen beim ersten Lauf der Action.
        </p>
      )}

      {daten && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {daten.instrumente.map((i) => (
              <div key={i.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate text-schrift">{i.name}</span>
                {i.analyse ? (
                  <span className="tabular-nums text-xs">
                    <span className="text-white">{fmtKurs(i.analyse.kurs, i.dezimalen, i.waehrung)}</span>{' '}
                    <span className={i.analyse.aenderungTag > 0 ? 'text-long' : i.analyse.aenderungTag < 0 ? 'text-short' : 'text-gedimmt'}>
                      {fmtProzentVz(i.analyse.aenderungTag)}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-gedimmt">–</span>
                )}
              </div>
            ))}
          </div>
          {signale.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-rand pt-2 text-xs">
              {signale.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular-nums text-gedimmt">{fmtDatumKurz(s.datum)}</span>
                  <span className="text-schrift">{s.name}:</span>
                  <span className={`font-semibold ${richtungFarbe(s.richtung)}`}>{s.titel}</span>
                  {s.vorlaeufig && <span className="text-[10px] uppercase tracking-wide text-gedimmt">vorläufig</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-gedimmt">Stand: {fmtStand(daten.lastUpdated)} Uhr</p>
        </>
      )}
    </section>
  )
}
