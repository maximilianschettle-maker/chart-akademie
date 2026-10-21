import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Check, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { AbschlussTabelle } from '../components/AbschlussTabelle'
import { DcfRechner } from '../components/DcfRechner'
import { KennzahlenKacheln } from '../components/KennzahlenKacheln'
import { KursChart } from '../components/KursChart'
import { EINGABE, KNOPF, Kachel, Meldung, QuellenBadge } from '../components/ui'
import { firmenCache } from '../data/cache'
import { ladeFirma } from '../data/service'
import { syncStarten } from '../data/sync'
import { fmtBetrag, fmtKurs, fmtProzent, fmtZeitpunkt } from '../engine/format'
import { kennzahlen } from '../engine/kennzahlen'
import { useAktienStore } from '../store'
import type { Fundamentaldaten } from '../types'

type Tab = 'ueberblick' | 'zahlen' | 'fairvalue'
const TABS: { id: Tab; titel: string }[] = [
  { id: 'ueberblick', titel: 'Überblick' },
  { id: 'zahlen', titel: 'Zahlen' },
  { id: 'fairvalue', titel: 'Fair Value' },
]

export function FirmaPage() {
  const { symbol: roh } = useParams()
  const symbol = decodeURIComponent(roh ?? '').toUpperCase()
  const [daten, setDaten] = useState<Fundamentaldaten | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(true)
  const [tab, setTab] = useState<Tab>('ueberblick')
  const watchlist = useAktienStore((s) => s.watchlist)
  const hinzu = useAktienStore((s) => s.watchlistHinzu)
  const entfernen = useAktienStore((s) => s.watchlistEntfernen)
  const cikManuell = useAktienStore((s) => s.cikManuell[symbol])
  const cikSetzen = useAktienStore((s) => s.cikSetzen)
  const aufListe = watchlist.some((w) => w.symbol === symbol)

  const laden = useCallback(
    async (frisch: boolean) => {
      setLaeuft(true)
      setFehler(null)
      try {
        const d = await ladeFirma(symbol, { frisch })
        setDaten(d)
        if (!d) setFehler('Keine Daten gefunden.')
      } catch (e) {
        setFehler(e instanceof Error ? e.message : String(e))
      } finally {
        setLaeuft(false)
      }
    },
    [symbol],
  )

  useEffect(() => {
    syncStarten()
    laden(false)
  }, [laden])

  const k = useMemo(() => (daten ? kennzahlen(daten.jahre, daten.kurs, daten.firma.waehrung) : null), [daten])

  async function cikAnwenden(wert: string) {
    const cik = wert.replace(/\D/g, '')
    cikSetzen(symbol, cik || null)
    await firmenCache.entfernen(symbol)
    await laden(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/aktien" className="inline-flex items-center gap-1 text-xs text-gedimmt hover:text-schrift">
        <ArrowLeft className="h-3.5 w-3.5" /> Zur Watchlist
      </Link>

      {laeuft && !daten && <p className="mt-6 text-sm text-gedimmt">Lade {symbol} … (beim ersten Mal ein paar Sekunden, danach aus dem Cache)</p>}
      {fehler && !daten && <Meldung text={fehler} fehler />}

      {daten && (
        <>
          <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">{daten.firma.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gedimmt">
                <span className="font-semibold text-schrift">{daten.firma.symbol}</span>
                {daten.firma.boerse && <span>{daten.firma.boerse}</span>}
                {daten.firma.sektor && <span>· {daten.firma.sektor}</span>}
                {daten.firma.branche && <span>· {daten.firma.branche}</span>}
                {daten.firma.land && <span>· {daten.firma.land}</span>}
                <span className="inline-flex gap-1">{daten.quellen.map((q) => <QuellenBadge key={q} quelle={q} />)}</span>
                {daten.veraltet && <span className="rounded border border-short/40 px-1.5 py-0.5 text-[10px] text-short">veraltet</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/aktien/vergleich?s=${encodeURIComponent(symbol)}`} className={KNOPF} title="Mit anderen Firmen vergleichen">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Vergleich
              </Link>
              <button type="button" className={KNOPF} onClick={() => laden(true)} disabled={laeuft} title="Beim Worker neu laden">
                <RefreshCw className={`h-3.5 w-3.5 ${laeuft ? 'animate-spin' : ''}`} />
              </button>
              {aufListe ? (
                <button type="button" className={KNOPF} onClick={() => entfernen(symbol)}>
                  <Trash2 className="h-3.5 w-3.5" /> Von Watchlist
                </button>
              ) : (
                <button type="button" className={`${KNOPF} bg-akzent text-nacht hover:text-nacht`} onClick={() => hinzu(symbol, daten.firma.name)}>
                  <Plus className="h-3.5 w-3.5" /> Watchlist
                </button>
              )}
            </div>
          </header>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kachel titel="Kurs" wert={daten.kurs ? fmtKurs(daten.kurs.preis, daten.kurs.waehrung) : '–'} hinweis={daten.kurs ? fmtZeitpunkt(daten.kurs.zeit * 1000) : undefined} />
            <Kachel titel="Marktkapitalisierung" wert={fmtBetrag(daten.kurs?.marktkap, daten.kurs?.waehrung, 1)} />
            <Kachel titel="52-Wochen-Spanne" wert={daten.kurs?.tief52w && daten.kurs?.hoch52w ? `${fmtKurs(daten.kurs.tief52w)} – ${fmtKurs(daten.kurs.hoch52w)}` : '–'} />
            <Kachel
              titel="Analysten-Kursziel"
              wert={fmtKurs(daten.kurs?.kursziel, daten.kurs?.waehrung)}
              hinweis={daten.kurs?.kursziel && daten.kurs.preis ? fmtProzent(daten.kurs.kursziel / daten.kurs.preis - 1, 0, true) + ' zum Kurs' : undefined}
            />
          </div>

          {(daten.hinweise.length > 0 || fehler) && (
            <ul className="mt-3 space-y-1 text-xs text-gedimmt">
              {fehler && <li className="text-short">{fehler}</li>}
              {daten.hinweise.map((h) => (
                <li key={h}>· {h}</li>
              ))}
            </ul>
          )}

          <nav className="mt-5 flex gap-1 border-b border-rand">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-akzent text-white' : 'border-transparent text-gedimmt hover:text-schrift'}`}
                onClick={() => setTab(t.id)}
              >
                {t.titel}
              </button>
            ))}
          </nav>

          <div className="mt-5">
            {tab === 'ueberblick' && k && (
              <div className="space-y-6">
                <KursChart symbol={symbol} />
                <KennzahlenKacheln k={k} waehrung={daten.firma.waehrung} kursWaehrung={daten.kurs?.waehrung} kursbezugMoeglich={daten.kurs?.waehrung === daten.firma.waehrung} />
                {daten.firma.beschreibung && (
                  <details className="text-sm text-gedimmt">
                    <summary className="cursor-pointer text-schrift hover:text-white">Über die Firma</summary>
                    <p className="mt-2 leading-relaxed">{daten.firma.beschreibung}</p>
                    <p className="mt-2 text-xs">
                      {daten.firma.mitarbeiter && <span>{daten.firma.mitarbeiter.toLocaleString('de-DE')} Mitarbeiter · </span>}
                      {daten.firma.website && (
                        <a href={daten.firma.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-akzent hover:underline">
                          Website <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </p>
                  </details>
                )}
                <SecZuordnung daten={daten} cikManuell={cikManuell} onAnwenden={cikAnwenden} />
              </div>
            )}
            {tab === 'zahlen' && <AbschlussTabelle jahre={daten.jahre} quartale={daten.quartale} waehrung={daten.firma.waehrung} />}
            {tab === 'fairvalue' && <DcfRechner daten={daten} />}
          </div>

          <p className="mt-8 text-[11px] text-gedimmt">
            Datenstand {fmtZeitpunkt(daten.standAm)} · Abschlüsse in {daten.firma.waehrung}
            {daten.firma.cik && (
              <>
                {' '}
                ·{' '}
                <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${daten.firma.cik}&type=10-K&dateb=&owner=include&count=10`} target="_blank" rel="noreferrer" className="text-akzent hover:underline">
                  SEC-Einreichungen (CIK {daten.firma.cik.replace(/^0+/, '')})
                </a>
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

/** Zeigt, wie die SEC-Zuordnung zustande kam, und erlaubt eine manuelle CIK. */
function SecZuordnung({ daten, cikManuell, onAnwenden }: { daten: Fundamentaldaten; cikManuell?: string; onAnwenden: (cik: string) => void }) {
  const [wert, setWert] = useState(cikManuell ?? '')
  const text =
    daten.secZuordnung === 'ticker'
      ? 'über den Ticker zugeordnet'
      : daten.secZuordnung === 'name'
        ? 'über den Firmennamen zugeordnet — bitte prüfen, ob die SEC-Einreichungen wirklich zu dieser Firma gehören'
        : daten.secZuordnung === 'manuell'
          ? 'manuell zugeordnet'
          : 'keine Zuordnung (Firma reicht vermutlich nicht bei der SEC ein)'
  return (
    <details className="rounded-xl border border-rand bg-flaeche/50 p-3 text-xs text-gedimmt">
      <summary className="cursor-pointer text-schrift hover:text-white">SEC-Zuordnung: {text}</summary>
      <p className="mt-2">
        Falls die SEC-Daten zur falschen Firma gehören oder fehlen, obwohl die Firma in den USA gelistet ist: CIK eintragen (10-stellige Nummer auf{' '}
        <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany" target="_blank" rel="noreferrer" className="text-akzent hover:underline">
          sec.gov
        </a>
        ). Leer lassen und anwenden = automatische Zuordnung.
      </p>
      <div className="mt-2 flex gap-2">
        <input className={EINGABE} value={wert} onChange={(e) => setWert(e.target.value)} placeholder="z.B. 0001000184" inputMode="numeric" />
        <button type="button" className={KNOPF} onClick={() => onAnwenden(wert)}>
          <Check className="h-3.5 w-3.5" /> Anwenden
        </button>
      </div>
    </details>
  )
}
