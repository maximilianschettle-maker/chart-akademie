import { useEffect, useState } from 'react'
import { Dices, LoaderCircle, WifiOff, EyeOff } from 'lucide-react'
import type { Trade, Zeichnung } from '../types'
import { zufaelligerAbschnittMitVersuchen, type Abschnitt } from '../data/zufall'
import { useReplay } from '../hooks/useReplay'
import { useSchmal, chartHoehe } from '../hooks/useSchmal'
import { useSimulatorStore } from '../stores/simulatorStore'
import { statistik } from '../engine/bewertung'
import { HOEHERE_TIMEFRAMES } from '../engine/aggregation'
import { ReplayChart, type ZeichenModus } from '../components/chart/ReplayChart'
import { ReplayControls } from '../components/chart/ReplayControls'
import { ZeichenLeiste } from '../components/chart/ZeichenLeiste'
import { OrderTicket } from '../components/simulator/OrderTicket'
import { PositionPanel } from '../components/simulator/PositionPanel'
import { TradeHistorie } from '../components/simulator/TradeHistorie'

// Freier Replay-Modus: zufälliger historischer Abschnitt, Datum und Symbol
// verdeckt, damit man nicht aus der Erinnerung "schummeln" kann.

const GESAMT_BARS = 800
const START_CURSOR = 500 // sichtbarer Kontext; danach ~300 Bars Replay

type Session = Abschnitt

function ReplaySession({ session, onNeueSession }: { session: Session; onNeueSession: () => void }) {
  const kontostandStore = useSimulatorStore((s) => s.kontostand)
  const tradesUebernehmen = useSimulatorStore((s) => s.tradesUebernehmen)
  // Startkapital der Session einmalig einfrieren (der Store ändert sich während der Session)
  const [startKapital] = useState(kontostandStore)

  const replay = useReplay(session.candles, START_CURSOR, startKapital)
  const { broker } = replay
  const schmal = useSchmal()

  const [zeichnungen, setZeichnungen] = useState<Zeichnung[]>([])
  const [zeichenModus, setZeichenModus] = useState<ZeichenModus>('aus')
  const [kontextSek, setKontextSek] = useState<number | null>(null)
  const timeframes = HOEHERE_TIMEFRAMES[session.interval] ?? []

  // Abgeschlossene Trades laufend in den persistenten Store übernehmen
  useEffect(() => {
    if (broker.trades.length === 0) return
    tradesUebernehmen(
      broker.trades.map((t): Trade => ({ ...t, id: `${session.id}:${t.id}`, interval: session.interval })),
    )
  }, [broker.trades, session.id, session.interval, tradesUebernehmen])

  const unrealisiert = broker.position
    ? broker.position.richtung === 'long'
      ? (replay.aktuellerPreis - broker.position.entryPreis) * broker.position.menge
      : (broker.position.entryPreis - replay.aktuellerPreis) * broker.position.menge
    : 0

  const stats = statistik(broker.trades)
  const datumFormat = (t: number) =>
    new Date(t * 1000).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })

  const linien = {
    entryPreis: broker.position?.entryPreis,
    stopLoss: broker.position?.stopLoss ?? broker.offeneOrder?.stopLoss,
    takeProfit: broker.position?.takeProfit ?? broker.offeneOrder?.takeProfit,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-rand bg-flaeche px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-white">
          <EyeOff className="h-4 w-4 text-akzent" />
          {replay.fertig ? session.symbol : session.anzeigeName}
        </span>
        <span className="text-gedimmt">{session.interval}-Kerzen</span>
        {session.offline && (
          <span className="rounded bg-nacht px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gedimmt" title="Kursdaten-API nicht erreichbar — eingebauter Abschnitt">
            offline-Vorrat
          </span>
        )}
        <span className="text-gedimmt">
          {replay.fertig
            ? `${datumFormat(session.candles[0].time)} – ${datumFormat(session.candles[session.candles.length - 1].time)}`
            : 'Zeitraum verdeckt'}
        </span>
        <span className="tabular-nums ml-auto">
          Konto:{' '}
          <span className="font-semibold text-white">
            {broker.kontostand.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $
          </span>
          {broker.position && (
            <span className={unrealisiert >= 0 ? 'text-long' : 'text-short'}>
              {' '}
              ({unrealisiert >= 0 ? '+' : ''}
              {unrealisiert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $)
            </span>
          )}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {kontextSek !== null && (
            <div className="rounded-xl border border-rand bg-flaeche p-3">
              <div className="mb-1 text-xs text-gedimmt">
                Kontext: {timeframes.find((t) => t.sek === kontextSek)?.label} — dieselben Kerzen, gröber
                zusammengefasst. Trend und große Zonen erkennst du hier, den Entry unten.
              </div>
              <ReplayChart
                candles={session.candles}
                cursor={replay.cursor}
                hoehe={schmal ? 180 : 220}
                zeitVerdeckt={!replay.fertig}
                bucketSek={kontextSek}
                kompakt
                zeichnungen={zeichnungen}
                {...linien}
              />
            </div>
          )}
          <div className="rounded-xl border border-rand bg-flaeche p-3">
            <ReplayChart
              candles={session.candles}
              cursor={replay.cursor}
              hoehe={chartHoehe(schmal)}
              zeitVerdeckt={!replay.fertig}
              zeichnungen={zeichnungen}
              zeichenModus={zeichenModus}
              onZeichnung={(z) => setZeichnungen((alt) => [...alt, z])}
              {...linien}
            />
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
            verbleibendeBars={session.candles.length - 1 - replay.cursor}
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
          <OrderTicket
            aktuellerPreis={replay.aktuellerPreis}
            kontostand={broker.kontostand}
            barIndex={replay.cursor}
            deaktiviert={!!broker.position || !!broker.offeneOrder || replay.fertig}
            onPlatzieren={replay.platzieren}
            mitSetupTag
          />
          {replay.fertig && (
            <div className="rounded-xl border border-akzent/40 bg-flaeche p-4 text-sm">
              <h3 className="font-bold text-white">Session beendet — Auflösung</h3>
              <p className="mt-1 text-gedimmt">
                Das war {session.symbol} ({session.interval}).
              </p>
              <div className="tabular-nums mt-3 space-y-1 text-gedimmt">
                <div>
                  Trades: <span className="text-white">{stats.anzahl}</span> · Trefferquote:{' '}
                  <span className="text-white">{stats.trefferquote.toFixed(0)} %</span>
                </div>
                <div>
                  PnL:{' '}
                  <span className={stats.summePnl >= 0 ? 'text-long' : 'text-short'}>
                    {stats.summePnl >= 0 ? '+' : ''}
                    {stats.summePnl.toLocaleString('de-DE', { maximumFractionDigits: 2 })} $
                  </span>{' '}
                  · Ø R: <span className="text-white">{stats.durchschnittR.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={onNeueSession}
                className="mt-3 w-full rounded-lg bg-akzent py-2 text-sm font-bold text-nacht hover:brightness-110"
              >
                Neue Session starten
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-rand bg-flaeche p-4">
        <h3 className="mb-2 text-sm font-semibold text-white">Trades dieser Session</h3>
        <TradeHistorie trades={broker.trades} mitSetup />
      </div>
    </div>
  )
}

export function SimulatorPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'idle' | 'laedt' | 'fehler'>('idle')

  async function starten() {
    setStatus('laedt')
    setSession(null)
    try {
      // 3 Online-Versuche, danach automatisch der eingebaute Offline-Vorrat
      const s = await zufaelligerAbschnittMitVersuchen(GESAMT_BARS, 3)
      setSession(s)
      setStatus('idle')
    } catch {
      setStatus('fehler')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Simulator — freier Replay-Modus</h1>
          <p className="mt-1 text-sm text-gedimmt">
            Ein zufälliger historischer Marktabschnitt, Kerze für Kerze. Symbol und Datum bleiben
            verdeckt, bis die Session endet — handle nur, was der Chart zeigt.
          </p>
        </div>
        {!session && status !== 'laedt' && (
          <button
            onClick={starten}
            className="inline-flex items-center gap-2 rounded-lg bg-akzent px-5 py-2.5 font-semibold text-nacht hover:brightness-110"
          >
            <Dices className="h-5 w-5" /> Session starten
          </button>
        )}
      </div>

      {status === 'laedt' && (
        <div className="flex h-64 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      )}
      {status === 'fehler' && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-gedimmt">
          <WifiOff className="h-6 w-6" />
          <p className="text-sm">Kursdaten konnten nicht geladen werden. Später erneut versuchen.</p>
          <button onClick={starten} className="mt-2 rounded-lg bg-flaeche px-4 py-2 text-sm hover:text-white">
            Erneut versuchen
          </button>
        </div>
      )}
      {session && <ReplaySession key={session.id} session={session} onNeueSession={starten} />}
    </div>
  )
}
