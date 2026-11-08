import type { Pruefung } from './types'
import { zeitKurz } from './engine'

// Anzeige eines KI-Urteils – im Journal (gespeichert) und in den Übungen (Sitzungsstand).

const URTEIL_FARBE: Record<Pruefung['urteil'], string> = { sauber: 'bg-long/15 text-long', 'mit Abstrichen': 'bg-akzent/15 text-akzent', herbeigesehnt: 'bg-short/15 text-short' }

export function PruefungKarte({ p, kontext }: { p: Pruefung; kontext?: string }) {
  return (
    <div className="rounded-xl border border-rand bg-nacht/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${URTEIL_FARBE[p.urteil]}`}>{p.urteil}</span>
        <span className="text-[11px] text-gedimmt">
          {kontext ?? (p.mitErgebnis ? 'mit Ergebnis' : 'Vorher-Blick, ohne Ergebnis')} · {zeitKurz(Math.floor(p.erstelltAm / 1000))}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-gedimmt">Setup</dt>
          <dd className="text-white">{p.setupVorhanden}</dd>
        </div>
        <div>
          <dt className="text-gedimmt">Einstieg</dt>
          <dd className="text-white">{p.einstieg}</dd>
        </div>
        <div>
          <dt className="text-gedimmt">Stop</dt>
          <dd className="text-white">{p.stop}</dd>
        </div>
      </dl>
      <p className="mt-2 whitespace-pre-wrap text-sm text-schrift">{p.text}</p>
      {p.naechstesMal.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-schrift">
          {p.naechstesMal.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
