import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, TriangleAlert } from 'lucide-react'
import { useTracker } from '../useTracker'
import { kerzenAusKompakt } from '../engine/analyse'
import { aktuellerKurs, useLiveKurse, vortagesSchluss } from '../liveKurse'
import { fmtDatumKurz, fmtKurs, fmtProzentVz, fmtStand, richtungFarbe } from '../format'

// Dashboard-Karte: Kurse auf einen Blick (live über den Worker, wenn eingetragen) und die neuesten Signale.

export function TrackerWidget() {
  const { daten, status, fehler } = useTracker()
  const symbole = useMemo(() => (daten ? daten.instrumente.map((i) => i.symbol) : []), [daten])
  const live = useLiveKurse(symbole)
  const signale = daten
    ? daten.instrumente
        .flatMap((i) => [...i.signale, ...(i.stunde?.signale ?? [])].map((s) => ({ ...s, name: i.name })))
        .sort((a, b) => (b.kerzeZeit ?? b.datum).localeCompare(a.kerzeZeit ?? a.datum) || b.zeit.localeCompare(a.zeit))
        .slice(0, 5)
    : []
  const neuesterKurs = daten ? Math.max(...daten.instrumente.map((i) => Math.max(live[i.symbol]?.zeit ?? 0, i.analyse ? Date.parse(i.analyse.kursZeit) : 0))) : 0

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
            {daten.instrumente.map((i) => {
              const k = aktuellerKurs(i.analyse, live[i.symbol])
              const vortag = k ? vortagesSchluss(kerzenAusKompakt(i.kerzen.slice(-3)), k.zeitMs) : null
              const aenderung = k && vortag ? k.preis / vortag - 1 : (i.analyse?.aenderungTag ?? 0)
              return (
                <div key={i.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-schrift">{i.name}</span>
                  {k ? (
                    <span className="tabular-nums text-xs">
                      <span className="text-white">{fmtKurs(k.preis, i.dezimalen, i.waehrung)}</span>{' '}
                      <span className={aenderung > 0 ? 'text-long' : aenderung < 0 ? 'text-short' : 'text-gedimmt'}>{fmtProzentVz(aenderung)}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-gedimmt">–</span>
                  )}
                </div>
              )
            })}
          </div>
          {signale.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-rand pt-2 text-xs">
              {signale.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular-nums text-gedimmt">{fmtDatumKurz(s.datum)}</span>
                  <span className="text-schrift">
                    {s.name}
                    {s.ebene === 'stunde' && <span className="text-gedimmt"> (1h)</span>}:
                  </span>
                  <span className={`font-semibold ${richtungFarbe(s.richtung)}`}>{s.titel}</span>
                  {s.vorlaeufig && <span className="text-[10px] uppercase tracking-wide text-gedimmt">vorläufig</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-gedimmt">
            Kurse {neuesterKurs > 0 ? fmtStand(new Date(neuesterKurs).toISOString()) : '–'} Uhr · Signale vom Lauf {fmtStand(daten.lastUpdated)} Uhr
          </p>
        </>
      )}
    </section>
  )
}
