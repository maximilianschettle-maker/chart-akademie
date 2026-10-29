import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, TriangleAlert } from 'lucide-react'
import { useMakro } from '../../makro/useMakro'
import { bankName, fmtKorridor, fmtProzent, fmtRestzeit, fmtTagKurz, fmtUhr } from '../../makro/format'
import type { Bank, EzbDaten, FedDaten, MakroDaten, ZinsTermin } from '../../makro/types'

// Startseite: die nächsten Notenbank-Termine kompakt (Bank, Tag, Uhrzeit, Restzeit, aktueller Zins).

const NACHLAUF_MS = 3 * 3_600_000

function zinsText(bank: Bank, daten: FedDaten | EzbDaten): string {
  if (!daten.zins) return '–'
  if (bank === 'fed') {
    const z = (daten as FedDaten).zins!
    return fmtKorridor(z.unten, z.oben)
  }
  return `${fmtProzent((daten as EzbDaten).zins!.einlage)} %`
}

function naechste(daten: MakroDaten, jetzt: number, anzahl: number): { bank: Bank; termin: ZinsTermin }[] {
  return [...daten.fed.termine.map((termin) => ({ bank: 'fed' as const, termin })), ...daten.ezb.termine.map((termin) => ({ bank: 'ezb' as const, termin }))]
    .filter((e) => Date.parse(e.termin.entscheidungUtc) >= jetzt - NACHLAUF_MS)
    .sort((a, b) => a.termin.entscheidungUtc.localeCompare(b.termin.entscheidungUtc))
    .slice(0, anzahl)
}

export function TermineKompakt() {
  const { daten, status, jetzt } = useMakro()
  const termine = daten ? naechste(daten, jetzt, 3) : []

  return (
    <section className="mt-4 rounded-xl border border-rand bg-flaeche p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-white">
          <CalendarClock className="h-4 w-4 text-akzent" /> Nächste Termine
        </h2>
        <Link to="/analyse/makro" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-akzent hover:underline">
          Makro <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {status === 'laedt' && <p className="mt-3 text-sm text-gedimmt">Lade Termine …</p>}
      {status === 'fehler' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-gedimmt">
          <TriangleAlert className="h-4 w-4 text-akzent" /> Termine gerade nicht verfügbar.
        </p>
      )}
      {daten && (
        <ul className="mt-3 divide-y divide-rand text-sm">
          {termine.map(({ bank, termin }) => {
            const T = Date.parse(termin.entscheidungUtc)
            const ergebnis = daten[bank].letzteEntscheidung?.datum === termin.datum ? daten[bank].letzteEntscheidung : null
            return (
              <li key={`${bank}-${termin.datum}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                <span className="inline-flex items-baseline gap-2">
                  <span className={`w-8 text-xs font-bold ${bank === 'fed' ? 'text-blue-400' : 'text-purple-400'}`}>{bankName(bank)}</span>
                  <span className="text-schrift">
                    {fmtTagKurz(termin.entscheidungUtc)} <span className="tabular-nums text-gedimmt">{fmtUhr(termin.entscheidungUtc)} Uhr</span>
                  </span>
                </span>
                <span className="tabular-nums text-xs text-gedimmt">
                  {ergebnis ? <span className="text-white">{ergebnis.text ?? 'Ergebnis liegt vor'}</span> : jetzt < T ? fmtRestzeit(termin.entscheidungUtc, jetzt) : 'läuft'}
                  <span className="ml-2 text-schrift">{zinsText(bank, daten[bank])}</span>
                </span>
              </li>
            )
          })}
          {termine.length === 0 && <li className="py-2 text-gedimmt">Keine Termine bekannt.</li>}
        </ul>
      )}
    </section>
  )
}
