import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Dices, LoaderCircle, RotateCcw, Target, WifiOff } from 'lucide-react'
import type { Candle, Scenario, Zeichnung } from '../types'
import { SZENARIEN } from '../content/szenarien'
import { strategieName } from '../content/strategien'
import { getSzenarioDaten } from '../data/szenarien'
import { zufaelligerAbschnittMitVersuchen } from '../data/zufall'
import { useReplay } from '../hooks/useReplay'
import { useSchmal, chartHoehe } from '../hooks/useSchmal'
import { bewerteSzenario } from '../engine/szenarioGrader'
import { findeSetup, setupZuSzenario } from '../engine/setupErkennung'
import { HOEHERE_TIMEFRAMES } from '../engine/aggregation'
import { useProgressStore } from '../stores/progressStore'
import { HandelsChart, type ChartLinie, type ZeichenModus } from '../components/chart/HandelsChart'
import { CHART_FARBEN } from '../components/chart/ChartPanel'
import { useHandel } from '../hooks/useHandel'
import { letzterAtr } from '../engine/indikatoren/atr'
import { ReplayControls } from '../components/chart/ReplayControls'
import { ZeichenLeiste } from '../components/chart/ZeichenLeiste'
import { OrderTicket } from '../components/simulator/OrderTicket'
import { PositionPanel } from '../components/simulator/PositionPanel'

const UEBUNGS_KAPITAL = 10000
const ZUFALL_NACHLAUF = 80

const BEWERTUNG_ANZEIGE = {
  perfekt: { label: 'Perfekt!', farbe: 'text-long', rahmen: 'border-long/50' },
  ok: { label: 'Solide — mit Luft nach oben', farbe: 'text-akzent', rahmen: 'border-akzent/50' },
  verpasst: { label: 'Verpasst', farbe: 'text-akzent', rahmen: 'border-akzent/50' },
  falsch: { label: 'Daneben', farbe: 'text-short', rahmen: 'border-short/50' },
} as const

function UebungSession({
  szenario,
  candles,
  onNochmal,
  onNeu,
}: {
  szenario: Scenario
  candles: Candle[]
  onNochmal: () => void
  /** Nur bei Zufalls-Übungen: neue Übung generieren */
  onNeu?: () => void
}) {
  const replay = useReplay(candles, szenario.startIndex, UEBUNGS_KAPITAL, szenario.id)
  const { broker } = replay
  const schmal = useSchmal()
  const [zeichnungen, setZeichnungen] = useState<Zeichnung[]>([])
  const [zeichenModus, setZeichenModus] = useState<ZeichenModus>('aus')
  const [kontextSek, setKontextSek] = useState<number | null>(null)
  const [keinTradeErklaert, setKeinTradeErklaert] = useState(false)
  const timeframes = HOEHERE_TIMEFRAMES[szenario.interval] ?? []
  const szenarioAbschliessen = useProgressStore((s) => s.szenarioAbschliessen)
  const gespeichertRef = useRef(false)

  const resultat = useMemo(
    () => (replay.fertig ? bewerteSzenario(szenario, candles, broker.trades) : null),
    [replay.fertig, szenario, candles, broker.trades],
  )

  useEffect(() => {
    if (resultat && !gespeichertRef.current && !szenario.generiert) {
      gespeichertRef.current = true
      szenarioAbschliessen(szenario.id, {
        bewertung: resultat.bewertung,
        rMultiple: resultat.rMultiple,
      })
    }
  }, [resultat, szenario.id, szenario.generiert, szenarioAbschliessen])

  const anzeige = resultat ? BEWERTUNG_ANZEIGE[resultat.bewertung] : null
  const ersterTrade = broker.trades[0]
  const gesamtR = resultat?.rMultiple ?? 0
  const gesamtPnl = broker.trades.reduce((s, t) => s + t.pnl, 0)
  const zeigeIdeal = replay.fertig && szenario.richtung !== 'keiner'
  const handel = useHandel(broker, replay.aktuellerPreis, { stopsSetzen: replay.stopsSetzen })
  const atr = useMemo(() => letzterAtr(candles, replay.cursor), [candles, replay.cursor])
  // Nach dem Ende: statt der eigenen Linien den Ideal-Trade des Szenarios zeigen
  const linien = useMemo((): ChartLinie[] => {
    if (!zeigeIdeal) return handel.linien
    const ideal: ChartLinie[] = []
    if (szenario.idealEntry) ideal.push({ id: 'ideal-entry', preis: szenario.idealEntry, farbe: '#F59E0B', titel: 'Entry', imBlick: true })
    if (szenario.idealStopLoss) ideal.push({ id: 'ideal-sl', preis: szenario.idealStopLoss, farbe: CHART_FARBEN.short, titel: 'SL', imBlick: true })
    if (szenario.idealTakeProfit) ideal.push({ id: 'ideal-tp', preis: szenario.idealTakeProfit, farbe: CHART_FARBEN.long, titel: 'TP', imBlick: true })
    return ideal
  }, [zeigeIdeal, handel.linien, szenario.idealEntry, szenario.idealStopLoss, szenario.idealTakeProfit])

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
              candles={candles}
              cursor={replay.cursor}
              hoehe={schmal ? 180 : 220}
              zeitVerdeckt={szenario.datumVerdeckt && !replay.fertig}
              bucketSek={kontextSek}
              kompakt
              zeichnungen={zeichnungen}
            />
          </div>
        )}
        <div className="rounded-xl border border-rand bg-flaeche p-3">
          <HandelsChart
            candles={candles}
            cursor={replay.cursor}
            hoehe={chartHoehe(schmal)}
            zeitVerdeckt={szenario.datumVerdeckt && !replay.fertig}
            zeichnungen={zeichnungen}
            zeichenModus={zeichenModus}
            onZeichnung={(z) => setZeichnungen((alt) => [...alt, z])}
            linien={linien}
            onLinieZiehen={handel.onLinieZiehen}
            onLinieLos={handel.onLinieLos}
            onPick={handel.onPick}
          />
          {zeigeIdeal && szenario.idealEntry !== undefined && (
            <p className="mt-2 text-xs text-gedimmt">
              Eingezeichnet: der Ideal-Trade dieses Szenarios (Entry{' '}
              {szenario.idealEntry.toLocaleString('de-DE')} $, SL{' '}
              {szenario.idealStopLoss?.toLocaleString('de-DE')} $, TP{' '}
              {szenario.idealTakeProfit?.toLocaleString('de-DE')} $).
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
          onLaufend={replay.setLaufend}
          onGeschwindigkeit={replay.setGeschwindigkeit}
          onStep={replay.step}
        />
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
              deaktiviert={
                !!broker.position || !!broker.offeneOrder || broker.trades.length > 0
              }
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
          </>
        )}
        {!replay.fertig && broker.trades.length > 0 && !broker.position && (
          <p className="rounded-xl border border-rand bg-flaeche p-4 text-xs text-gedimmt">
            Dein Trade ist geschlossen. Lass das Replay bis zum Ende laufen, um die Auswertung zu
            sehen.
          </p>
        )}
        {resultat && anzeige && (
          <div className={`rounded-xl border ${anzeige.rahmen} bg-flaeche p-4 text-sm`}>
            <div className={`text-lg font-bold ${anzeige.farbe}`}>{anzeige.label}</div>
            {szenario.ansageVerdeckt && (
              <div className="mt-1 text-xs text-gedimmt">
                Auflösung: <span className="font-semibold text-white">{strategieName(szenario.strategieId)}</span>
                {' · '}
                {szenario.symbol} ({szenario.interval})
              </div>
            )}
            {ersterTrade ? (
              <div className="tabular-nums mt-1 text-xs text-gedimmt">
                Dein Trade:{' '}
                <span className={gesamtR >= 0 ? 'text-long' : 'text-short'}>
                  {gesamtR >= 0 ? '+' : ''}
                  {gesamtR.toFixed(2)}R
                </span>{' '}
                ({gesamtPnl >= 0 ? '+' : ''}
                {gesamtPnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $)
                {broker.trades.length > 1 && ` · ${broker.trades.length} Teil-Exits`}
              </div>
            ) : (
              keinTradeErklaert && (
                <div className="mt-1 text-xs text-gedimmt">Deine Entscheidung: kein Trade.</div>
              )
            )}
            <p className="mt-3 leading-relaxed text-schrift">{resultat.text}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onNochmal}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-nacht py-2 text-xs font-semibold text-schrift hover:text-white"
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
}

/** Zufalls-Übung: zufälligen Abschnitt laden, bis die Erkennung ein Setup findet. */
async function zufallsUebung(): Promise<Geladen> {
  for (let versuch = 0; versuch < 6; versuch++) {
    const abschnitt = await zufaelligerAbschnittMitVersuchen(700, 2)
    const setup = findeSetup(abschnitt.candles, ZUFALL_NACHLAUF)
    if (!setup) continue
    const szenario = setupZuSzenario(setup, abschnitt.symbol, abschnitt.interval, ZUFALL_NACHLAUF)
    return { szenario, candles: abschnitt.candles.slice(0, szenario.endIndex + 1) }
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

  useEffect(() => {
    let aktiv = true
    setGeladen(null)
    setFehler(false)
    const laden = istZufall
      ? zufallsUebung()
      : kuratiert
        ? getSzenarioDaten(kuratiert.datensatz).then((d) => ({
            szenario: kuratiert,
            candles: d.candles.slice(0, kuratiert.endIndex + 1),
          }))
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
  const aufgabe = szenario?.aufgabe

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
          onNochmal={() => setVersuch((v) => v + 1)}
          onNeu={istZufall ? () => setGeneration((g) => g + 1) : undefined}
        />
      )}
    </div>
  )
}
