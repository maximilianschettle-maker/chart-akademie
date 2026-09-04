import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle, RotateCcw, Target, WifiOff } from 'lucide-react'
import type { Candle } from '../types'
import { SZENARIEN } from '../content/szenarien'
import { getSzenarioDaten } from '../data/szenarien'
import { useReplay } from '../hooks/useReplay'
import { bewerteSzenario } from '../engine/szenarioGrader'
import { useProgressStore } from '../stores/progressStore'
import { ReplayChart } from '../components/chart/ReplayChart'
import { ReplayControls } from '../components/chart/ReplayControls'
import { OrderTicket } from '../components/simulator/OrderTicket'
import { PositionPanel } from '../components/simulator/PositionPanel'
import type { Scenario } from '../types'

const UEBUNGS_KAPITAL = 10000

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
}: {
  szenario: Scenario
  candles: Candle[]
  onNochmal: () => void
}) {
  const replay = useReplay(candles, szenario.startIndex, UEBUNGS_KAPITAL, szenario.id)
  const { broker } = replay
  const szenarioAbschliessen = useProgressStore((s) => s.szenarioAbschliessen)
  const gespeichertRef = useRef(false)

  const resultat = useMemo(
    () => (replay.fertig ? bewerteSzenario(szenario, candles, broker.trades) : null),
    [replay.fertig, szenario, candles, broker.trades],
  )

  useEffect(() => {
    if (resultat && !gespeichertRef.current) {
      gespeichertRef.current = true
      szenarioAbschliessen(szenario.id, {
        bewertung: resultat.bewertung,
        rMultiple: resultat.rMultiple,
      })
    }
  }, [resultat, szenario.id, szenarioAbschliessen])

  const anzeige = resultat ? BEWERTUNG_ANZEIGE[resultat.bewertung] : null

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-rand bg-flaeche p-3">
          <ReplayChart
            candles={candles}
            cursor={replay.cursor}
            zeitVerdeckt={szenario.datumVerdeckt && !replay.fertig}
            entryPreis={replay.fertig ? szenario.idealEntry : broker.position?.entryPreis}
            stopLoss={
              replay.fertig
                ? szenario.idealStopLoss
                : (broker.position?.stopLoss ?? broker.offeneOrder?.stopLoss)
            }
            takeProfit={
              replay.fertig
                ? szenario.idealTakeProfit
                : (broker.position?.takeProfit ?? broker.offeneOrder?.takeProfit)
            }
          />
          {replay.fertig && (
            <p className="mt-2 text-xs text-gedimmt">
              Eingezeichnet: der Ideal-Trade dieses Szenarios (Entry {szenario.idealEntry.toLocaleString('de-DE')} $,
              SL {szenario.idealStopLoss.toLocaleString('de-DE')} $, TP{' '}
              {szenario.idealTakeProfit.toLocaleString('de-DE')} $).
            </p>
          )}
        </div>
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
        />
      </div>

      <div className="space-y-4">
        {!replay.fertig && (
          <OrderTicket
            aktuellerPreis={replay.aktuellerPreis}
            kontostand={broker.kontostand}
            barIndex={replay.cursor}
            deaktiviert={
              !!broker.position || !!broker.offeneOrder || broker.trades.length > 0
            }
            onPlatzieren={replay.platzieren}
          />
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
            {broker.trades[0] && (
              <div className="tabular-nums mt-1 text-xs text-gedimmt">
                Dein Trade:{' '}
                <span className={broker.trades[0].rMultiple >= 0 ? 'text-long' : 'text-short'}>
                  {broker.trades[0].rMultiple >= 0 ? '+' : ''}
                  {broker.trades[0].rMultiple.toFixed(2)}R
                </span>{' '}
                ({broker.trades[0].pnl >= 0 ? '+' : ''}
                {broker.trades[0].pnl.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $)
              </div>
            )}
            <p className="mt-3 leading-relaxed text-schrift">{resultat.text}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onNochmal}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-nacht py-2 text-xs font-semibold text-schrift hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Nochmal
              </button>
              <Link
                to="/"
                className="flex-1 rounded-lg bg-akzent py-2 text-center text-xs font-bold text-nacht hover:brightness-110"
              >
                Zum Lernpfad
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function UebungPage() {
  const { szenarioId } = useParams<{ szenarioId: string }>()
  const szenario = szenarioId ? SZENARIEN[szenarioId] : undefined
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [fehler, setFehler] = useState(false)
  const [versuch, setVersuch] = useState(0)

  useEffect(() => {
    if (!szenario) return
    let aktiv = true
    getSzenarioDaten(szenario.datensatz)
      .then((d) => {
        if (aktiv) setCandles(d.candles.slice(0, szenario.endIndex + 1))
      })
      .catch(() => {
        if (aktiv) setFehler(true)
      })
    return () => {
      aktiv = false
    }
  }, [szenario])

  if (!szenario) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gedimmt">
        Übung nicht gefunden.{' '}
        <Link to="/" className="text-akzent underline">
          Zurück zum Lernpfad
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gedimmt hover:text-schrift">
        <ArrowLeft className="h-4 w-4" /> Lernpfad
      </Link>
      <div className="mt-3 mb-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-akzent">
          <Target className="h-4 w-4" /> Geführte Übung
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">{szenario.titel}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gedimmt">{szenario.aufgabe}</p>
      </div>

      {fehler ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-gedimmt">
          <WifiOff className="h-6 w-6" />
          <p className="text-sm">Szenario-Daten konnten nicht geladen werden.</p>
        </div>
      ) : candles === null ? (
        <div className="flex h-64 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <UebungSession
          key={versuch}
          szenario={szenario}
          candles={candles}
          onNochmal={() => setVersuch((v) => v + 1)}
        />
      )}
    </div>
  )
}
