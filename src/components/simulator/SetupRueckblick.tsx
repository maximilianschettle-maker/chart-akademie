import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, Eye, LoaderCircle, RotateCcw, SearchCheck } from 'lucide-react'
import type { Candle, ChartAnnotation, Trade } from '../../types'
import type { ErkanntesSetup } from '../../engine/setupErkennung'
import { rueckblick, rueckblickSumme, sucheSetups, type SetupFund } from '../../engine/rueckblick'
import { STRATEGIEN, strategieName } from '../../content/strategien'
import { fmtPreis, fmtR } from '../../engine/format'
import { ChartPanel, CHART_FARBEN } from '../chart/ChartPanel'

// Setup-Rückblick am Sitzungsende: Was hat der gespielte Abschnitt angeboten,
// was davon wurde gehandelt, was verpasst — mit Chart zum Moment der
// Entscheidung, Erkennungsmerkmalen und (auf Wunsch) der Auflösung.

const VORLAUF = 140 // Kerzen vor dem Signal im Detail-Chart
const EBENEN_FARBE = '#3B82F6'

interface SetupRueckblickProps {
  candles: Candle[]
  /** erste und letzte gespielte Kerze */
  startIndex: number
  endIndex: number
  trades: Trade[]
  /** Stelle als Wiederholung spielen (Zeit der Signalkerze); fehlt → kein Knopf */
  onNochmal?: (signalZeit: number) => void
}

const datum = (t: number) =>
  new Date(t * 1000).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })

const STATUS = {
  verpasst: { text: 'verpasst', stil: 'bg-akzent/15 text-akzent' },
  gehandelt: { text: 'gehandelt', stil: 'bg-long/15 text-long' },
  belegt: { text: 'im Trade', stil: 'bg-rand text-gedimmt' },
} as const

function ErgebnisText({ fund }: { fund: SetupFund }) {
  const { art, r } = fund.ergebnis
  if (art === 'tp') return <span className="text-long">Ziel erreicht {fmtR(r)}</span>
  if (art === 'sl') return <span className="text-short">ausgestoppt {fmtR(r)}</span>
  return <span className="text-gedimmt">noch offen ({fmtR(r)})</span>
}

function FundDetail({
  fund,
  candles,
  endIndex,
  onNochmal,
}: {
  fund: SetupFund
  candles: Candle[]
  endIndex: number
  onNochmal?: (signalZeit: number) => void
}) {
  const [aufgeloest, setAufgeloest] = useState(false)
  const { setup } = fund
  const i = setup.signalIndex
  const von = Math.max(0, i - VORLAUF)
  const bis = aufgeloest ? Math.min(endIndex, fund.ergebnis.exitIndex + 15) : i

  const ausschnitt = useMemo(() => candles.slice(von, bis + 1), [candles, von, bis])

  const annotationen = useMemo((): ChartAnnotation[] => {
    const liste: ChartAnnotation[] = []
    for (const e of setup.ebenen) liste.push({ typ: 'preislinie', preis: e.preis, text: e.text, farbe: EBENEN_FARBE })
    liste.push({ typ: 'preislinie', preis: fund.entry, text: 'Entry', farbe: '#F59E0B' })
    liste.push({ typ: 'preislinie', preis: fund.stopLoss, text: 'SL', farbe: CHART_FARBEN.short })
    liste.push({ typ: 'preislinie', preis: fund.takeProfit, text: 'TP', farbe: CHART_FARBEN.long })
    for (const p of setup.punkte) {
      if (p.index < von || p.index > bis) continue
      liste.push({
        typ: 'marker',
        time: candles[p.index].time,
        position: p.oben ? 'aboveBar' : 'belowBar',
        form: 'circle',
        text: p.text,
        farbe: EBENEN_FARBE,
      })
    }
    const long = setup.richtung === 'long'
    liste.push({
      typ: 'marker',
      time: candles[i].time,
      position: long ? 'belowBar' : 'aboveBar',
      form: long ? 'arrowUp' : 'arrowDown',
      text: 'Signal',
      farbe: '#F59E0B',
    })
    if (aufgeloest && fund.ergebnis.art !== 'offen') {
      const gewinn = fund.ergebnis.art === 'tp'
      liste.push({
        typ: 'marker',
        time: candles[fund.ergebnis.exitIndex].time,
        position: 'aboveBar',
        form: 'circle',
        text: gewinn ? `Ziel ${fmtR(fund.ergebnis.r)}` : `Stop ${fmtR(fund.ergebnis.r)}`,
        farbe: gewinn ? CHART_FARBEN.long : CHART_FARBEN.short,
      })
    }
    return liste
  }, [setup, fund, candles, von, bis, i, aufgeloest])

  const lektion = STRATEGIEN.find((s) => s.id === setup.strategieId)?.lektionId
  const ref = fund.entry

  return (
    <div className="grid gap-4 border-t border-rand/60 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-gedimmt">
          <span>
            {aufgeloest
              ? 'Was danach geschah'
              : 'Der Chart im Moment des Signals — so viel war zu sehen, mehr nicht.'}
          </span>
          <button
            onClick={() => setAufgeloest((a) => !a)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-nacht px-2.5 py-1.5 font-semibold text-schrift hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" /> {aufgeloest ? 'Zurück zum Signal' : 'Auflösung zeigen'}
          </button>
        </div>
        <ChartPanel
          candles={ausschnitt}
          annotationen={annotationen}
          hoehe={340}
          emaPerioden={setup.emaPerioden}
          randRechts={aufgeloest ? 4 : 10}
        />
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <h4 className="font-semibold text-white">Woran du es hättest erkennen können</h4>
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-schrift">
            {setup.merkmale.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg bg-nacht p-3">
          <h4 className="text-xs font-semibold text-white">Der regelkonforme Trade</h4>
          <dl className="tabular-nums mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gedimmt">
            <dt>Einstieg (Schlusskurs Signal)</dt>
            <dd className="text-right text-white">{fmtPreis(fund.entry)}</dd>
            <dt>Stop-Loss</dt>
            <dd className="text-right text-short">{fmtPreis(fund.stopLoss, ref)}</dd>
            <dt>Take-Profit</dt>
            <dd className="text-right text-long">{fmtPreis(fund.takeProfit, ref)}</dd>
            <dt>CRV</dt>
            <dd className="text-right text-white">{fund.crv.toFixed(2)}</dd>
            {aufgeloest && (
              <>
                <dt>Ergebnis</dt>
                <dd className="text-right font-semibold">
                  <ErgebnisText fund={fund} />
                </dd>
              </>
            )}
          </dl>
          {aufgeloest && fund.eigenerTrade && (
            <p className="tabular-nums mt-2 border-t border-rand pt-2 text-xs text-gedimmt">
              Dein Trade hier:{' '}
              <span className={fund.eigenerTrade.rMultiple >= 0 ? 'text-long' : 'text-short'}>
                {fmtR(fund.eigenerTrade.rMultiple)}
              </span>{' '}
              (Einstieg {fmtPreis(fund.eigenerTrade.entryPreis)}).
            </p>
          )}
          {aufgeloest && fund.ergebnis.art === 'sl' && (
            <p className="mt-2 border-t border-rand pt-2 text-xs leading-relaxed text-gedimmt">
              Auch ein sauberes Setup verliert regelmäßig — verpasst heißt hier nicht „Geld liegen gelassen“. Es
              zählt, ob du es gesehen hättest.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {onNochmal && (
            <button
              onClick={() => onNochmal(candles[i].time)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-akzent px-3 py-2 text-xs font-bold text-nacht hover:brightness-110"
              title="Startet kurz vor dem Signal — zählt nicht fürs Journal"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Stelle nochmal spielen
            </button>
          )}
          {lektion && (
            <Link
              to={`/lektion/${lektion}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-nacht px-3 py-2 text-xs font-semibold text-schrift hover:text-white"
            >
              <BookOpen className="h-3.5 w-3.5" /> Lektion ansehen
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

type Filter = 'verpasst' | 'gehandelt' | 'alle'

export function SetupRueckblick({ candles, startIndex, endIndex, trades, onNochmal }: SetupRueckblickProps) {
  const [setups, setSetups] = useState<ErkanntesSetup[] | null>(null)
  const [fortschritt, setFortschritt] = useState(0)
  const [offen, setOffen] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter | null>(null)

  // Suche einmal anstoßen — in Häppchen, damit die Seite bedienbar bleibt
  useEffect(() => {
    let abgebrochen = false
    void sucheSetups(candles, startIndex, endIndex, {
      onFortschritt: (anteil) => {
        if (!abgebrochen) setFortschritt(anteil)
      },
      abgebrochen: () => abgebrochen,
    }).then((gefunden) => {
      if (!abgebrochen) setSetups(gefunden)
    })
    return () => {
      abgebrochen = true
    }
  }, [candles, startIndex, endIndex])

  const funde = useMemo(
    () => (setups ? rueckblick(candles, setups, trades, endIndex) : []),
    [setups, candles, trades, endIndex],
  )
  const summe = useMemo(() => rueckblickSumme(funde), [funde])

  const karte = 'rounded-xl border border-rand bg-flaeche'

  if (setups === null) {
    return (
      <div className={`${karte} flex items-center gap-3 p-4 text-sm text-gedimmt`}>
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Suche nach Setups im gespielten Abschnitt … {Math.round(fortschritt * 100)} %
      </div>
    )
  }

  const aktiverFilter: Filter = filter ?? (summe.verpasst > 0 ? 'verpasst' : 'alle')
  const sichtbar = funde.filter((f) => aktiverFilter === 'alle' || f.status === aktiverFilter)
  const chip = (aktiv: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
      aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'
    }`

  return (
    <div className={karte}>
      <div className="p-4">
        <h2 className="flex items-center gap-2 font-bold text-white">
          <SearchCheck className="h-5 w-5 text-akzent" /> Setup-Rückblick
        </h2>
        {summe.gesamt === 0 ? (
          <p className="mt-1.5 text-sm text-gedimmt">
            In diesem Abschnitt hat die Erkennung kein Setup aus Level 4 gefunden
            {endIndex - startIndex < 60 ? ' — er war auch recht kurz' : ''}. Wenn du trotzdem gehandelt hast:
            Prüfe im Journal, ob die Trades ein eigenes Setup hatten.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-sm leading-relaxed text-gedimmt">
              Der Abschnitt hat <span className="font-semibold text-white">{summe.gesamt} Setups</span> aus Level 4
              angeboten: <span className="text-long">{summe.gehandelt} gehandelt</span>,{' '}
              <span className="text-akzent">{summe.verpasst} verpasst</span>
              {summe.belegt > 0 && <>, {summe.belegt} während eines laufenden Trades</>}.
              {summe.verpasst > 0 && summe.verpassteGewinner + summe.verpassteVerlierer > 0 && (
                <>
                  {' '}
                  Von den verpassten liefen {summe.verpassteGewinner} ins Ziel und {summe.verpassteVerlierer} in
                  den Stop — zusammen{' '}
                  <span className={summe.verpassteR >= 0 ? 'text-long' : 'text-short'}>{fmtR(summe.verpassteR)}</span>
                  {summe.verpassteOffen > 0 && <> ({summe.verpassteOffen} noch offen)</>}.
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-gedimmt">
              Regelbasierte Erkennung: Sie findet nicht jedes Setup, und nicht jedes gefundene ist ein gutes.
              Ergebnisse ohne Gebühren, Einstieg zum Schlusskurs der Signalkerze.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button onClick={() => setFilter('verpasst')} className={chip(aktiverFilter === 'verpasst')}>
                Verpasst ({summe.verpasst})
              </button>
              <button onClick={() => setFilter('gehandelt')} className={chip(aktiverFilter === 'gehandelt')}>
                Gehandelt ({summe.gehandelt})
              </button>
              <button onClick={() => setFilter('alle')} className={chip(aktiverFilter === 'alle')}>
                Alle ({summe.gesamt})
              </button>
            </div>
          </>
        )}
      </div>

      {sichtbar.length > 0 && (
        <ul>
          {sichtbar.map((f) => {
            const auf = offen === f.id
            const status = STATUS[f.status]
            return (
              <li key={f.id} className="border-t border-rand">
                <button
                  onClick={() => setOffen(auf ? null : f.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm hover:bg-nacht/40"
                  aria-expanded={auf}
                >
                  {auf ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-gedimmt" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gedimmt" />
                  )}
                  <span className="font-semibold text-white">{strategieName(f.setup.strategieId)}</span>
                  <span
                    className={`text-xs font-bold uppercase ${f.setup.richtung === 'long' ? 'text-long' : 'text-short'}`}
                  >
                    {f.setup.richtung}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${status.stil}`}>{status.text}</span>
                  <span className="tabular-nums text-xs text-gedimmt">
                    {datum(candles[f.setup.signalIndex].time)} · Kerze {f.setup.signalIndex - startIndex + 1}
                  </span>
                  <span className="tabular-nums ml-auto text-xs">
                    <ErgebnisText fund={f} />
                  </span>
                </button>
                {auf && <FundDetail fund={f} candles={candles} endIndex={endIndex} onNochmal={onNochmal} />}
              </li>
            )
          })}
        </ul>
      )}
      {summe.gesamt > 0 && sichtbar.length === 0 && (
        <p className="border-t border-rand px-4 py-3 text-sm text-gedimmt">
          {aktiverFilter === 'verpasst' ? 'Nichts verpasst — stark.' : 'Keine Einträge in dieser Ansicht.'}
        </p>
      )}
    </div>
  )
}
