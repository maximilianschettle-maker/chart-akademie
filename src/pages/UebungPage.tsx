import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Dices, LoaderCircle, PauseCircle, RotateCcw, Target, WifiOff } from 'lucide-react'
import type { Candle, Scenario, Zeichnung } from '../types'
import { SZENARIEN } from '../content/szenarien'
import { strategieName } from '../content/strategien'
import { getSzenarioDaten, getSzenarioUnterkerzen } from '../data/szenarien'
import { zufaelligerAbschnittMitVersuchen } from '../data/zufall'
import { getCandles } from '../data/candleService'
import { UNTER_INTERVALL } from '../engine/intrabar'
import { intervalSekunden } from '../engine/aggregation'
import { useSimulatorStore } from '../stores/simulatorStore'
import { useReplay } from '../hooks/useReplay'
import { useSchmal, chartHoehe } from '../hooks/useSchmal'
import { type KriteriumStatus, datumZeitText, textFuellen } from '../engine/szenarioGrader'
import { reviewAnzeige, tradeMarker } from '../engine/uebungsReview'
import { autoPauseGrund } from '../engine/autoPause'
import { type Durchlauf, type TradeBewertung, alleBewertungen, uebungsErgebnis, zusammenfassung } from '../engine/uebungsVerlauf'
import { BEWERTUNG_ANZEIGE } from '../components/ui/bewertungAnzeige'
import { BewertungsBadge } from '../components/ui/BewertungsBadge'
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import { findeSetup, setupZuSzenario } from '../engine/setupErkennung'
import { HOEHERE_TIMEFRAMES } from '../engine/aggregation'
import { fmtR } from '../engine/format'
import { useProgressStore } from '../stores/progressStore'
import { HandelsChart, type ChartLinie, type ZeichenModus } from '../components/chart/HandelsChart'
import { useHandel } from '../hooks/useHandel'
import { letzterAtr } from '../engine/indikatoren/atr'
import { ReplayControls } from '../components/chart/ReplayControls'
import { ZeichenLeiste } from '../components/chart/ZeichenLeiste'
import { OrderTicket } from '../components/simulator/OrderTicket'
import { PositionPanel } from '../components/simulator/PositionPanel'

const UEBUNGS_KAPITAL = 10000
const ZUFALL_NACHLAUF = 80

const KRITERIUM_STATUS: Record<KriteriumStatus, { Icon: typeof CircleCheck; farbe: string; titel: string }> = {
  ok: { Icon: CircleCheck, farbe: 'text-long', titel: 'erfüllt' },
  warnung: { Icon: TriangleAlert, farbe: 'text-akzent', titel: 'Warnung' },
  fehler: { Icon: CircleX, farbe: 'text-short', titel: 'Fehler' },
}

/** Eine Zeile der Trade-Liste: Nummer, Zeitpunkt, Richtung, R, Bewertung. */
function TradeZeile({
  b,
  aktiv,
  onClick,
}: {
  b: TradeBewertung
  aktiv?: boolean
  onClick?: () => void
}) {
  const inhalt = (
    <>
      <span className="w-6 shrink-0 font-semibold text-white">#{b.nr}</span>
      <span className="tabular-nums flex-1 truncate text-gedimmt">
        {datumZeitText(b.entryTime)} · {b.richtung === 'long' ? 'Long' : 'Short'}
      </span>
      <span className={`tabular-nums shrink-0 font-semibold ${b.rMultiple >= 0 ? 'text-long' : 'text-short'}`}>{fmtR(b.rMultiple)}</span>
      <span className="shrink-0">
        <BewertungsBadge bewertung={b.resultat.bewertung} />
      </span>
    </>
  )
  const klasse = `flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
    aktiv ? 'bg-nacht ring-1 ring-akzent/60' : onClick ? 'hover:bg-nacht' : ''
  }`
  return onClick ? (
    <button onClick={onClick} className={klasse} aria-pressed={aktiv}>
      {inhalt}
    </button>
  ) : (
    <div className={klasse}>{inhalt}</div>
  )
}

function UebungSession({
  szenario,
  candles,
  unter,
  durchlaufNr,
  fruehere,
  onFertig,
  onNochmal,
  onNeu,
}: {
  szenario: Scenario
  candles: Candle[]
  /** Unterkerzen (15m zu 1h) für das Intrabar-Replay; null → OHLC-Annäherung */
  unter: Candle[] | null
  /** 1-basierte Nummer dieses Durchlaufs (Nochmal zählt hoch) */
  durchlaufNr: number
  /** Frühere Durchläufe derselben Übung — bleiben über „Nochmal“ erhalten */
  fruehere: Durchlauf[]
  onFertig: (durchlauf: Durchlauf) => void
  onNochmal: () => void
  /** Nur bei Zufalls-Übungen: neue Übung generieren */
  onNeu?: () => void
}) {
  const replay = useReplay(candles, szenario.startIndex, UEBUNGS_KAPITAL, szenario.id, unter)
  const { broker } = replay
  const schmal = useSchmal()
  // Anzeige: wachsende Hauptkerze (Standard) oder die Unterkerzen selbst (Einstellung, wie im Simulator)
  const unterkerzenAnzeigen = useSimulatorStore((s) => s.einstellungen.unterkerzenAnzeigen)
  const einstellungenSetzen = useSimulatorStore((s) => s.einstellungenSetzen)
  const zeigeUnter = unterkerzenAnzeigen && replay.unterVerfuegbar
  const chartBasis = zeigeUnter ? replay.basisUnter : replay.sichtbar
  const hauptSek = useMemo(() => intervalSekunden(candles), [candles])
  const unterInterval = UNTER_INTERVALL[szenario.interval]
  const [zeichnungen, setZeichnungen] = useState<Zeichnung[]>([])
  const [zeichenModus, setZeichenModus] = useState<ZeichenModus>('aus')
  const [kontextSek, setKontextSek] = useState<number | null>(null)
  const [keinTradeErklaert, setKeinTradeErklaert] = useState(false)
  const [auswahl, setAuswahl] = useState<string | null>(null)
  const [pauseHinweis, setPauseHinweis] = useState<string | null>(null)
  // scharf = die nächste Annäherung an die Zone darf wieder pausieren
  const pauseScharfRef = useRef(true)
  const hoehere = HOEHERE_TIMEFRAMES[szenario.interval] ?? []
  // Bei Unterkerzen-Anzeige ist das Haupt-Intervall selbst ein höherer Timeframe
  const timeframes = zeigeUnter ? [{ label: szenario.interval, sek: hauptSek }, ...hoehere] : hoehere
  const szenarioAbschliessen = useProgressStore((s) => s.szenarioAbschliessen)
  const gespeichertRef = useRef(false)

  // Jeder Trade wird einzeln bewertet; das Übungsergebnis ist der beste Trade
  const ergebnis = useMemo(
    () => (replay.fertig ? uebungsErgebnis(szenario, candles, broker.trades, broker.offeneOrder) : null),
    [replay.fertig, szenario, candles, broker.trades, broker.offeneOrder],
  )

  useEffect(() => {
    if (ergebnis && !gespeichertRef.current) {
      gespeichertRef.current = true
      if (!szenario.generiert) {
        szenarioAbschliessen(szenario.id, {
          bewertung: ergebnis.resultat.bewertung,
          rMultiple: ergebnis.resultat.rMultiple,
        })
      }
      onFertig({ nr: durchlaufNr, bewertungen: ergebnis.bewertungen })
    }
  }, [ergebnis, szenario.id, szenario.generiert, szenarioAbschliessen, onFertig, durchlaufNr])

  // Angezeigter Trade: Auswahl aus der Liste, sonst der beste
  const gewaehlt = ergebnis ? (ergebnis.bewertungen.find((b) => b.key === auswahl) ?? ergebnis.bester) : undefined
  const resultat = gewaehlt?.resultat ?? ergebnis?.resultat ?? null
  const gesamtAnzeige = ergebnis ? BEWERTUNG_ANZEIGE[ergebnis.resultat.bewertung] : null
  const anzeige = resultat ? BEWERTUNG_ANZEIGE[resultat.bewertung] : null
  const zeigeIdeal = replay.fertig && szenario.richtung !== 'keiner'
  // Geführte Übung: Limit/Stop vorausgewählt — die Order gehört vorab in die Zone
  const handel = useHandel(broker, replay.aktuellerPreis, { stopsSetzen: replay.stopsSetzen, standardTyp: 'preis' })

  // Auto-Pause: einmal je Annäherung an die Entry-Zone, nur im laufenden Replay ohne Position/Order
  const { laufend, setLaufend, cursor, fertig, aktuelleBar } = replay
  useEffect(() => {
    if (fertig) return
    const grund = autoPauseGrund(szenario, candles, cursor, aktuelleBar)
    if (!grund) {
      pauseScharfRef.current = true
      return
    }
    if (!pauseScharfRef.current) return
    pauseScharfRef.current = false
    if (!laufend || broker.position || broker.offeneOrder) return
    setLaufend(false)
    setPauseHinweis(grund.text)
  }, [szenario, candles, cursor, aktuelleBar, fertig, laufend, setLaufend, broker.position, broker.offeneOrder])

  function weiter(wert: boolean) {
    if (wert) setPauseHinweis(null)
    replay.setLaufend(wert)
  }
  function schritt() {
    setPauseHinweis(null)
    replay.step()
  }
  const atr = useMemo(() => letzterAtr(replay.sichtbar, replay.cursor), [replay.sichtbar, replay.cursor])
  // Nach dem Ende: Review mit eigenem Trade UND Ideal-Trade, Entry-Fenster als Box
  const review = useMemo(
    () => (zeigeIdeal && resultat ? reviewAnzeige(szenario, candles, broker.trades, resultat.ideal, gewaehlt?.key) : null),
    [zeigeIdeal, resultat, szenario, candles, broker.trades, gewaehlt?.key],
  )
  // Während des Replays: Marker der bereits geschlossenen Trades
  const laufMarker = useMemo(() => tradeMarker(broker.trades), [broker.trades])
  const linien: ChartLinie[] = review ? review.linien : handel.linien
  const gesamt = useMemo(
    () => (ergebnis ? zusammenfassung(alleBewertungen([...fruehere, { nr: durchlaufNr, bewertungen: ergebnis.bewertungen }])) : null),
    [ergebnis, fruehere, durchlaufNr],
  )
  const dieserDurchlauf = ergebnis ? zusammenfassung(ergebnis.bewertungen) : null
  const geschlossen = broker.trades.length > 0 && !broker.position && !broker.offeneOrder

  // Kein Trade: Entscheidung festhalten und den Rest des Replays durchlaufen lassen
  function keinTrade() {
    setKeinTradeErklaert(true)
    replay.zumEnde()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {kontextSek !== null && (
          <div className="rounded-xl border border-rand bg-flaeche p-3">
            <HandelsChart
              candles={chartBasis}
              cursor={chartBasis.length - 1}
              hoehe={schmal ? 180 : 220}
              zeitVerdeckt={szenario.datumVerdeckt && !replay.fertig}
              bucketSek={kontextSek}
              kompakt
              zeichnungen={zeichnungen}
            />
          </div>
        )}
        {pauseHinweis && !replay.laufend && !replay.fertig && (
          <div className="flex items-start gap-2 rounded-xl border border-akzent/50 bg-akzent/10 p-3 text-xs text-schrift" role="status">
            <PauseCircle className="h-4 w-4 shrink-0 text-akzent" />
            <span className="flex-1 leading-snug">{pauseHinweis}</span>
            <button onClick={() => setPauseHinweis(null)} className="shrink-0 rounded-md bg-nacht px-2 py-1 font-semibold text-gedimmt hover:text-white">
              OK
            </button>
          </div>
        )}
        <div className="rounded-xl border border-rand bg-flaeche p-3">
          <HandelsChart
            candles={chartBasis}
            cursor={chartBasis.length - 1}
            hoehe={chartHoehe(schmal)}
            zeitVerdeckt={szenario.datumVerdeckt && !replay.fertig}
            zeichnungen={zeichnungen}
            zeichenModus={zeichenModus}
            onZeichnung={(z) => setZeichnungen((alt) => [...alt, z])}
            linien={linien}
            marker={review ? review.marker : laufMarker}
            boxen={review?.boxen}
            onLinieZiehen={handel.onLinieZiehen}
            onLinieLos={handel.onLinieLos}
            onPick={handel.onPick}
          />
          {review && (
            <p className="mt-2 text-xs text-gedimmt">
              <span className="font-semibold text-akzent">Durchgezogen/gestrichelt</span> = dein Trade
              {gewaehlt && ergebnis && ergebnis.bewertungen.length > 1 ? ` #${gewaehlt.nr}` : ''} (Entry, SL, TP) ·{' '}
              <span className="font-semibold text-[#3B82F6]">blau gepunktet</span> = Ideal-Trade
              {resultat?.ideal && (
                <>
                  {' '}
                  (Entry {resultat.ideal.entry.toLocaleString('de-DE')} $, SL{' '}
                  {resultat.ideal.stopLoss.toLocaleString('de-DE')} $, TP {resultat.ideal.takeProfit.toLocaleString('de-DE')} $)
                </>
              )}{' '}
              · <span className="font-semibold text-[#3B82F6]">blaue Box</span> = Entry-Fenster (Zone × Zeitraum)
              {szenario.kriterien?.trigger && (
                <>
                  {' '}
                  · <span className="font-semibold text-[#A855F7]">Trigger</span> = {szenario.kriterien.trigger.beschreibung}
                </>
              )}
            </p>
          )}
        </div>
        <ZeichenLeiste
          modus={zeichenModus}
          onModus={setZeichenModus}
          anzahl={zeichnungen.length}
          onLoeschen={() => setZeichnungen([])}
          timeframes={timeframes}
          kontextSek={kontextSek}
          onKontext={setKontextSek}
        />
        <ReplayControls
          laufend={replay.laufend}
          geschwindigkeit={replay.geschwindigkeit}
          fertig={replay.fertig}
          verbleibendeBars={candles.length - 1 - replay.cursor}
          onLaufend={weiter}
          onGeschwindigkeit={replay.setGeschwindigkeit}
          onStep={schritt}
        >
          {replay.unterVerfuegbar ? (
            <label className="inline-flex cursor-pointer items-center gap-1.5" title="Chart zeigt die Unterkerzen statt der wachsenden Hauptkerze">
              <input
                type="checkbox"
                checked={unterkerzenAnzeigen}
                onChange={(e) => einstellungenSetzen({ unterkerzenAnzeigen: e.target.checked })}
                className="accent-akzent"
              />
              {unterInterval}-Kerzen zeigen
            </label>
          ) : (
            <span title="Keine Unterkerzen vorhanden — die Kerze wird über den OHLC-Pfad angenähert">Intrabar: OHLC-Annäherung</span>
          )}
        </ReplayControls>
        <PositionPanel
          position={broker.position}
          offeneOrder={broker.offeneOrder}
          aktuellerPreis={replay.aktuellerPreis}
          onSchliessen={replay.schliessen}
          onStornieren={replay.stornieren}
          onTeilSchliessen={replay.teilweiseSchliessen}
          onBreakEven={replay.aufBreakEven}
          onStopsSetzen={replay.stopsSetzen}
        />
      </div>

      <div className="space-y-4">
        {!replay.fertig && (
          <>
            <OrderTicket
              entwurf={handel.entwurf}
              onEntwurf={handel.entwurfTeil}
              aktuellerPreis={replay.aktuellerPreis}
              kontostand={broker.kontostand}
              barIndex={replay.cursor}
              // Nur eine offene Position/Order gleichzeitig — geschlossene Trades sperren nicht
              deaktiviert={!!broker.position || !!broker.offeneOrder}
              onPlatzieren={replay.platzieren}
              atr={atr}
              tpPflicht
              pickZiel={handel.pickZiel}
              onPickZiel={handel.setPickZiel}
            />
            {broker.trades.length === 0 && !broker.position && !broker.offeneOrder && (
              <button
                onClick={keinTrade}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rand bg-flaeche py-2.5 text-sm font-semibold text-schrift hover:border-akzent hover:text-white"
                title="Entscheidung: Hier gibt es kein regelkonformes Setup"
              >
                <Ban className="h-4 w-4 text-akzent" /> Kein Trade — hier gibt es nichts zu handeln
              </button>
            )}
            {geschlossen && (
              <p className="rounded-xl border border-rand bg-flaeche p-4 text-xs text-gedimmt">
                {broker.trades.length === 1 ? 'Dein Trade ist' : `${broker.trades.length} Trades sind`} geschlossen. Du kannst
                weiter handeln — oder das Replay bis zum Ende laufen lassen, dann wird jeder Trade einzeln bewertet.
              </p>
            )}
          </>
        )}
        {ergebnis && resultat && anzeige && gesamtAnzeige && (
          <div className={`rounded-xl border ${gesamtAnzeige.rahmen} bg-flaeche p-4 text-sm`}>
            <div className={`inline-flex items-center gap-2 text-lg font-bold ${gesamtAnzeige.farbe}`}>
              <gesamtAnzeige.Icon className="h-5 w-5" /> {gesamtAnzeige.label}
            </div>
            {szenario.ansageVerdeckt && (
              <div className="mt-1 text-xs text-gedimmt">
                Auflösung: <span className="font-semibold text-white">{strategieName(szenario.strategieId)}</span>
                {' · '}
                {szenario.symbol} ({szenario.interval})
              </div>
            )}
            {ergebnis.bewertungen.length === 0 && keinTradeErklaert && (
              <div className="mt-1 text-xs text-gedimmt">Deine Entscheidung: kein Trade.</div>
            )}

            {ergebnis.bewertungen.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gedimmt">
                  {ergebnis.bewertungen.length === 1 ? 'Dein Trade' : `Deine Trades (Durchlauf ${durchlaufNr})`}
                </div>
                <div className="space-y-0.5">
                  {ergebnis.bewertungen.map((b) => (
                    <TradeZeile
                      key={b.key}
                      b={b}
                      aktiv={gewaehlt?.key === b.key}
                      onClick={ergebnis.bewertungen.length > 1 ? () => setAuswahl(b.key) : undefined}
                    />
                  ))}
                </div>
                {dieserDurchlauf && ergebnis.bewertungen.length > 1 && (
                  <p className="tabular-nums mt-1 text-[11px] text-gedimmt">{dieserDurchlauf.text}. Gewertet wird der beste Trade.</p>
                )}
              </div>
            )}

            {gewaehlt && resultat.bilanz.ergebnis && (
              <div className="mt-3 rounded-lg bg-nacht p-3 text-xs">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {ergebnis.bewertungen.length > 1 && <span className="font-semibold text-white">Trade #{gewaehlt.nr}</span>}
                  <span>
                    Prozess: <span className={`font-semibold ${anzeige.farbe}`}>{resultat.bilanz.prozess}</span>
                  </span>
                  <span className="tabular-nums">
                    Ergebnis:{' '}
                    <span className={`font-semibold ${gewaehlt.rMultiple >= 0 ? 'text-long' : 'text-short'}`}>{resultat.bilanz.ergebnis}</span>
                  </span>
                </div>
                <p className="mt-1 text-gedimmt">{resultat.bilanz.fazit}</p>
              </div>
            )}
            {resultat.kriterien.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <tbody>
                  {resultat.kriterien.map((k) => {
                    const s = KRITERIUM_STATUS[k.status]
                    return (
                      <tr key={k.id} className="border-t border-rand align-top">
                        <td className="py-1.5 pr-2">
                          <s.Icon className={`h-4 w-4 ${s.farbe}`} aria-label={s.titel} />
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap font-semibold text-white">{k.titel}</td>
                        <td className="py-1.5 leading-snug text-gedimmt">
                          {k.text}
                          <div className="tabular-nums mt-0.5 text-[10px] opacity-80">
                            Soll: {k.soll} · Ist: {k.ist}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-3 leading-relaxed text-schrift">{resultat.text}</p>

            {fruehere.length > 0 && gesamt && (
              <div className="mt-4 border-t border-rand pt-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gedimmt">Frühere Durchläufe</div>
                <div className="space-y-0.5">
                  {fruehere.map((d) =>
                    d.bewertungen.length === 0 ? (
                      <div key={d.nr} className="px-2 py-1 text-xs text-gedimmt">
                        Durchlauf {d.nr}: kein Trade
                      </div>
                    ) : (
                      d.bewertungen.map((b) => <TradeZeile key={`${d.nr}-${b.key}`} b={{ ...b, nr: d.nr }} />)
                    ),
                  )}
                </div>
                <p className="tabular-nums mt-2 text-[11px] text-gedimmt">Alle Durchläufe: {gesamt.text}</p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={onNochmal}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-nacht py-2 text-xs font-semibold text-schrift hover:text-white"
                title="Chart zurück auf den Ausgangspunkt — die Historie bleibt"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Nochmal
              </button>
              {onNeu ? (
                <button
                  onClick={onNeu}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-akzent py-2 text-xs font-bold text-nacht hover:brightness-110"
                >
                  <Dices className="h-3.5 w-3.5" /> Neue Zufalls-Übung
                </button>
              ) : (
                <Link
                  to="/"
                  className="flex-1 rounded-lg bg-akzent py-2 text-center text-xs font-bold text-nacht hover:brightness-110"
                >
                  Zum Lernpfad
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface Geladen {
  szenario: Scenario
  candles: Candle[]
  unter: Candle[] | null
}

/** Unterkerzen auf den Zeitraum der Hauptkerzen beschneiden. */
function unterBeschneiden(unter: Candle[] | null, candles: Candle[]): Candle[] | null {
  if (!unter || unter.length === 0 || candles.length === 0) return null
  const sek = intervalSekunden(candles)
  const ende = candles[candles.length - 1].time + sek
  const teil = unter.filter((c) => c.time >= candles[0].time && c.time < ende)
  return teil.length > 0 ? teil : null
}

/** Zufalls-Übung: zufälligen Abschnitt laden, bis die Erkennung ein Setup findet. */
async function zufallsUebung(): Promise<Geladen> {
  for (let versuch = 0; versuch < 6; versuch++) {
    const abschnitt = await zufaelligerAbschnittMitVersuchen(700, 2)
    const setup = findeSetup(abschnitt.candles, ZUFALL_NACHLAUF)
    if (!setup) continue
    const szenario = setupZuSzenario(setup, abschnitt.symbol, abschnitt.interval, ZUFALL_NACHLAUF)
    const candles = abschnitt.candles.slice(0, szenario.endIndex + 1)
    // Unterkerzen für das Intrabar-Replay — wenn nicht ladbar, läuft die Übung über den OHLC-Pfad
    let unter: Candle[] | null = null
    const unterIv = UNTER_INTERVALL[abschnitt.interval]
    if (unterIv) {
      try {
        const sek = intervalSekunden(candles)
        unter = await getCandles(abschnitt.symbol, unterIv, candles[0].time, candles[candles.length - 1].time + sek - 1)
      } catch {
        unter = null
      }
    }
    return { szenario, candles, unter: unterBeschneiden(unter, candles) }
  }
  throw new Error('Kein Setup gefunden')
}

export function UebungPage() {
  const { szenarioId } = useParams<{ szenarioId: string }>()
  const istZufall = szenarioId === 'zufall'
  const kuratiert = !istZufall && szenarioId ? SZENARIEN[szenarioId] : undefined
  const [geladen, setGeladen] = useState<Geladen | null>(null)
  const [fehler, setFehler] = useState(false)
  const [versuch, setVersuch] = useState(0)
  const [generation, setGeneration] = useState(0)
  // Historie der Durchläufe dieser Übung — „Nochmal“ setzt nur den Chart zurück
  const [durchlaeufe, setDurchlaeufe] = useState<Durchlauf[]>([])

  useEffect(() => {
    let aktiv = true
    setGeladen(null)
    setFehler(false)
    setDurchlaeufe([])
    setVersuch(0)
    const laden = istZufall
      ? zufallsUebung()
      : kuratiert
        ? Promise.all([getSzenarioDaten(kuratiert.datensatz), getSzenarioUnterkerzen(kuratiert.datensatz, kuratiert.interval)]).then(
            ([d, u]) => {
              const candles = d.candles.slice(0, kuratiert.endIndex + 1)
              return { szenario: kuratiert, candles, unter: unterBeschneiden(u, candles) }
            },
          )
        : Promise.reject(new Error('unbekannt'))
    laden
      .then((g) => {
        if (aktiv) setGeladen(g)
      })
      .catch(() => {
        if (aktiv) setFehler(true)
      })
    return () => {
      aktiv = false
    }
  }, [istZufall, kuratiert, generation])

  if (!istZufall && !kuratiert) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gedimmt">
        Übung nicht gefunden.{' '}
        <Link to="/" className="text-akzent underline">
          Zurück zum Lernpfad
        </Link>
      </div>
    )
  }

  const szenario = geladen?.szenario ?? kuratiert
  // Zone im Aufgabentext kommt aus derselben Config wie die Bewertung
  const aufgabe = szenario ? textFuellen(szenario.aufgabe, szenario) : undefined

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gedimmt hover:text-schrift">
        <ArrowLeft className="h-4 w-4" /> Lernpfad
      </Link>
      <div className="mt-3 mb-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-akzent">
          {istZufall ? <Dices className="h-4 w-4" /> : <Target className="h-4 w-4" />}
          {istZufall ? 'Zufalls-Übung' : 'Geführte Übung'}
          {szenario?.ansageVerdeckt && (
            <span className="rounded bg-flaeche px-1.5 py-0.5 text-[10px] text-gedimmt">ohne Ansage</span>
          )}
          {versuch > 0 && (
            <span className="rounded bg-flaeche px-1.5 py-0.5 text-[10px] text-gedimmt">Durchlauf {versuch + 1}</span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">
          {istZufall ? 'Erkenne das Setup' : szenario?.titel}
        </h1>
        {aufgabe && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gedimmt">{aufgabe}</p>}
        {istZufall && !geladen && !fehler && (
          <p className="mt-2 text-xs text-gedimmt">
            Suche in zufälligen Marktabschnitten nach einem Setup aus Level 4 …
          </p>
        )}
      </div>

      {fehler ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-gedimmt">
          <WifiOff className="h-6 w-6" />
          <p className="text-sm">
            {istZufall
              ? 'Kein Setup gefunden oder Kursdaten nicht erreichbar.'
              : 'Szenario-Daten konnten nicht geladen werden.'}
          </p>
          {istZufall && (
            <button
              onClick={() => setGeneration((g) => g + 1)}
              className="mt-2 rounded-lg bg-flaeche px-4 py-2 text-sm hover:text-white"
            >
              Erneut versuchen
            </button>
          )}
        </div>
      ) : geladen === null ? (
        <div className="flex h-64 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <UebungSession
          key={`${geladen.szenario.id}-${versuch}`}
          szenario={geladen.szenario}
          candles={geladen.candles}
          unter={geladen.unter}
          durchlaufNr={versuch + 1}
          fruehere={durchlaeufe.filter((d) => d.nr <= versuch)}
          onFertig={(d) => setDurchlaeufe((alt) => [...alt.filter((x) => x.nr !== d.nr), d])}
          onNochmal={() => setVersuch((v) => v + 1)}
          onNeu={istZufall ? () => setGeneration((g) => g + 1) : undefined}
        />
      )}
    </div>
  )
}
