import { ExternalLink } from 'lucide-react'
import type { Bank, Entscheidung, EzbDaten, FedDaten, ZinsTermin } from '../types'
import { bankLang, bankName, fmtBp, fmtDatum, fmtDatumKurz, fmtKorridor, fmtProzent, fmtRestzeit, fmtTagKurz, fmtUhr, naechsterTermin } from '../format'

// Eine Bank: aktueller Zins, letzte Änderung, nächste Entscheidung mit Countdown,
// Ergebnis am Entscheidungstag, Link zum letzten Statement.

interface ZinsKarteProps {
  bank: Bank
  daten: FedDaten | EzbDaten
  jetzt: number
  /** knapp fürs Dashboard, ausführlich auf der Makro-Seite */
  kompakt?: boolean
}

const NACHLAUF_MS = 3 * 3_600_000

function zinsText(bank: Bank, daten: FedDaten | EzbDaten): string | null {
  if (!daten.zins) return null
  if (bank === 'fed') {
    const z = (daten as FedDaten).zins!
    return fmtKorridor(z.unten, z.oben)
  }
  return `${fmtProzent((daten as EzbDaten).zins!.einlage)} %`
}

/** Was zum nächsten Termin anzuzeigen ist */
function terminZustand(termin: ZinsTermin | null, letzte: Entscheidung | null, jetzt: number) {
  if (!termin) return { art: 'keiner' as const }
  const T = Date.parse(termin.entscheidungUtc)
  if (letzte && letzte.datum === termin.datum) return { art: 'ergebnis' as const, termin, ergebnis: letzte }
  if (jetzt >= T) return { art: 'laeuft' as const, termin }
  return { art: 'bevor' as const, termin, rest: fmtRestzeit(termin.entscheidungUtc, jetzt) }
}

export function ZinsKarte({ bank, daten, jetzt, kompakt = false }: ZinsKarteProps) {
  const zins = zinsText(bank, daten)
  const termin = naechsterTermin(daten.termine, jetzt, NACHLAUF_MS)
  const zustand = terminZustand(termin, daten.letzteEntscheidung, jetzt)
  const bp = daten.zins?.letzteAenderungBp ?? 0
  const bpFarbe = bp > 0 ? 'text-short' : bp < 0 ? 'text-long' : 'text-gedimmt'
  const statement = daten.letzteEntscheidung?.link ?? daten.meldungen[0]?.link
  const farbe = bank === 'fed' ? 'text-blue-400' : 'text-purple-400'

  return (
    <div className="rounded-xl border border-rand bg-nacht/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-bold ${farbe}`}>{bankName(bank)}</span>
          {!kompakt && <span className="text-[11px] text-gedimmt">{bankLang(bank)}</span>}
        </div>
        {zins ? (
          <span className="tabular-nums text-base font-bold text-white">{zins}</span>
        ) : (
          <span className="text-xs text-gedimmt">Zins unbekannt</span>
        )}
      </div>

      {daten.zins && (
        <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] text-gedimmt">
          <span>{bank === 'fed' ? 'Zielkorridor Fed Funds' : 'Einlagesatz'}</span>
          <span>
            Letzte Änderung <span className={`tabular-nums font-semibold ${bpFarbe}`}>{fmtBp(bp)}</span>
            {' · '}gültig ab {kompakt ? fmtDatumKurz(daten.zins.gueltigAb) : fmtDatum(daten.zins.gueltigAb)}
          </span>
        </div>
      )}

      <div className="mt-2 border-t border-rand pt-2 text-sm">
        {zustand.art === 'keiner' && <span className="text-gedimmt">Kein Termin bekannt.</span>}
        {zustand.art === 'bevor' && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-schrift">
              {fmtTagKurz(zustand.termin.entscheidungUtc)}, {fmtUhr(zustand.termin.entscheidungUtc)} Uhr
              {zustand.termin.sep && (
                <span className="ml-1.5 rounded bg-flaeche px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gedimmt" title="Mit Projektionen (Summary of Economic Projections)">
                  SEP
                </span>
              )}
            </span>
            <span className="tabular-nums font-semibold text-akzent">{zustand.rest}</span>
          </div>
        )}
        {zustand.art === 'laeuft' && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-schrift">
              Heute, {fmtUhr(zustand.termin.entscheidungUtc)} Uhr
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-akzent">
              <span className="h-2 w-2 animate-pulse rounded-full bg-akzent" /> Veröffentlichung läuft, Ergebnis folgt
            </span>
          </div>
        )}
        {zustand.art === 'ergebnis' && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-gedimmt">Entscheidung {fmtDatumKurz(zustand.termin.datum)}:</span>
            <span className="font-semibold text-white">{zustand.ergebnis.text}</span>
          </div>
        )}
      </div>

      {!kompakt && zustand.art !== 'ergebnis' && daten.letzteEntscheidung && (
        <p className="mt-1.5 text-xs text-gedimmt">
          Zuletzt ({fmtDatumKurz(daten.letzteEntscheidung.datum)}): {daten.letzteEntscheidung.text}
        </p>
      )}

      {statement && (
        <a
          href={statement}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs text-akzent hover:underline"
        >
          Letztes Statement <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
