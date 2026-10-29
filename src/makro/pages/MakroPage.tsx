import { ExternalLink, Landmark, RefreshCw, TriangleAlert } from 'lucide-react'
import { useMakro } from '../useMakro'
import { istVeraltet } from '../laden'
import { bankName, fmtDatumKurz, fmtStand, fmtTagKurz, fmtUhr } from '../format'
import type { Bank, MakroDaten, QuellenStatus, ZinsTermin } from '../types'
import { ZinsKarte } from '../components/ZinsKarte'
import { ZinsChart } from '../components/ZinsChart'
import { PushEinstellungen } from '../components/PushEinstellungen'
import { Wirtschaftskalender } from '../../board/Wirtschaftskalender'

// Makro-Seite: beide Banken ausführlich, Zinshistorie, kommende Termine, letzte
// Pressemitteilungen, Push- und Kalender-Einstellungen, Herkunft der Daten.

const QUELLEN_TEXT: Record<QuellenStatus, string> = {
  live: 'live',
  fallback: 'Fallback-Datei',
  alt: 'alter Stand',
  fehler: 'fehlgeschlagen',
}

function kommendeTermine(daten: MakroDaten, jetzt: number, anzahl: number): { bank: Bank; termin: ZinsTermin }[] {
  const alle = [
    ...daten.fed.termine.map((termin) => ({ bank: 'fed' as const, termin })),
    ...daten.ezb.termine.map((termin) => ({ bank: 'ezb' as const, termin })),
  ]
  return alle
    .filter((e) => Date.parse(e.termin.entscheidungUtc) >= jetzt - 3 * 3_600_000)
    .sort((a, b) => a.termin.datum.localeCompare(b.termin.datum))
    .slice(0, anzahl)
}

export function MakroPage() {
  const { daten, status, fehler, ausCache, jetzt, neuLaden } = useMakro()

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            <Landmark className="h-6 w-6 text-akzent" /> Makro
          </h1>
          <p className="mt-1 text-gedimmt">
            Fed und EZB mit Leitzins, nächster Sitzung und Ergebnis am Entscheidungstag, dazu der Wirtschaftskalender für USA und Euroraum. Geopolitik steht unter „News“. Alle Zeiten in deutscher Zeit.
          </p>
        </div>
        <button onClick={neuLaden} className="tipp inline-flex items-center gap-1.5 rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white">
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </button>
      </div>

      {status === 'laedt' && <p className="mt-6 text-sm text-gedimmt">Lade Zinsdaten …</p>}
      {status === 'fehler' && (
        <div className="mt-6 rounded-xl border border-rand bg-flaeche p-4 text-sm text-gedimmt">
          <p className="inline-flex items-center gap-1.5">
            <TriangleAlert className="h-4 w-4 text-akzent" /> Zinsdaten nicht verfügbar{fehler ? ` (${fehler})` : ''}.
          </p>
          <p className="mt-1">
            Die Datei <code className="rounded bg-nacht px-1 text-akzent">data/macro.json</code> wird von der GitHub Action „Makro-Daten“
            erzeugt. Läuft sie noch nicht, fehlt die Datei.
          </p>
        </div>
      )}

      {daten && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ZinsKarte bank="fed" daten={daten.fed} jetzt={jetzt} />
            <ZinsKarte bank="ezb" daten={daten.ezb} jetzt={jetzt} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-gedimmt">
            <span>Stand: {fmtStand(daten.lastUpdated)} Uhr</span>
            {istVeraltet(daten, jetzt) && (
              <span className="inline-flex items-center gap-1 text-akzent">
                <TriangleAlert className="h-3 w-3" /> älter als 36 Stunden – die Action hat vermutlich nicht gelaufen
              </span>
            )}
            {ausCache && <span>(aus dem Gerätespeicher)</span>}
          </p>

          <section className="mt-6 rounded-xl border border-rand bg-flaeche p-4">
            <h2 className="text-base font-bold text-white">Zinshistorie</h2>
            <div className="mt-3">
              <ZinsChart fed={daten.fed.historie} ezb={daten.ezb.historie} jetzt={jetzt} />
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-rand bg-flaeche p-4">
            <h2 className="text-base font-bold text-white">Kommende Termine</h2>
            <ul className="mt-3 divide-y divide-rand text-sm">
              {kommendeTermine(daten, jetzt, 10).map(({ bank, termin }) => (
                <li key={`${bank}-${termin.datum}`} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <span className="inline-flex items-baseline gap-2">
                    <span className={`w-8 text-xs font-bold ${bank === 'fed' ? 'text-blue-400' : 'text-purple-400'}`}>{bankName(bank)}</span>
                    <span className="text-schrift">
                      {fmtTagKurz(termin.entscheidungUtc)}
                      {termin.beginn && <span className="text-gedimmt"> (Sitzung ab {fmtDatumKurz(termin.beginn)})</span>}
                    </span>
                    {termin.sep && (
                      <span className="rounded bg-nacht px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gedimmt" title="Mit Projektionen (SEP) und Dot Plot">
                        SEP
                      </span>
                    )}
                    {termin.hinweis && <span className="text-xs text-gedimmt">({termin.hinweis})</span>}
                  </span>
                  <span className="tabular-nums text-gedimmt">{fmtUhr(termin.entscheidungUtc)} Uhr</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-gedimmt">
              Fed: Statement 14:00 Uhr New York. EZB: Entscheidung 14:15 Uhr, Pressekonferenz 14:45 Uhr Frankfurt. SEP = Sitzung mit
              Projektionen.
            </p>
          </section>

          <div className="mt-6">
            <Wirtschaftskalender />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(['fed', 'ezb'] as Bank[]).map((bank) => (
              <section key={bank} className="rounded-xl border border-rand bg-flaeche p-4">
                <h2 className="text-sm font-bold text-white">{bankName(bank)}: Pressemitteilungen</h2>
                {daten[bank].meldungen.length === 0 ? (
                  <p className="mt-2 text-xs text-gedimmt">Noch keine geldpolitischen Meldungen im Feed.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {daten[bank].meldungen.slice(0, 6).map((m) => (
                      <li key={m.link}>
                        <a href={m.link} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1 text-schrift hover:text-white">
                          <span>
                            <span className="tabular-nums text-gedimmt">{fmtDatumKurz(m.datum.slice(0, 10))}</span> {m.titel}
                          </span>
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gedimmt group-hover:text-akzent" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-6">
            <PushEinstellungen publicKey={daten.push?.publicKey ?? null} />
          </div>

          <p className="mt-6 text-[11px] text-gedimmt">
            Quellen: Fed-Zins FRED (DFEDTARU/DFEDTARL), FOMC-Kalender federalreserve.gov, Fed-RSS „Monetary Policy“; EZB-Einlagesatz ECB Data
            Portal, EZB-Sitzungskalender und Presse-Feed ecb.europa.eu. Letzter Lauf:{' '}
            {Object.entries(daten.quellen)
              .map(([k, v]) => `${k} ${QUELLEN_TEXT[v] ?? v}`)
              .join(' · ')}
            . Keine Anlageberatung.
          </p>
        </>
      )}
    </div>
  )
}
