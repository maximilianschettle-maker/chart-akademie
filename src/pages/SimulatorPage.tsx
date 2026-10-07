import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Dices,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  LoaderCircle,
  Minus,
  PlayCircle,
  Ruler,
  TrendingUp,
  RectangleHorizontal,
  Settings2,
  Trash2,
  Undo2,
  WifiOff,
} from 'lucide-react'
import {
  INTERVALLE,
  SYMBOLE,
  anzeigeTimeframes,
  fruehesterStart,
  intervallSek,
  ladeSitzung,
  neueSitzung,
  offlineSitzung,
  symbolName,
  type SitzungConfig,
  type SitzungDaten,
} from '../data/sitzung'
import { GESCHWINDIGKEITEN, useSitzung } from '../hooks/useSitzung'
import { useHandel } from '../hooks/useHandel'
import { useSchmal } from '../hooks/useSchmal'
import { useSimulatorStore, type GespeicherteSitzung, type SimEinstellungen } from '../stores/simulatorStore'
import { fmtGeld, fmtGeldVz, fmtR } from '../engine/format'
import { HandelsChart, type ChartMarker, type ZeichenModus } from '../components/chart/HandelsChart'
import { ReplayControls } from '../components/chart/ReplayControls'
import { OrderTicket } from '../components/simulator/OrderTicket'
import { PositionPanel } from '../components/simulator/PositionPanel'
import { TradeHistorie } from '../components/simulator/TradeHistorie'
import { SitzungsStatistik } from '../components/simulator/SitzungsStatistik'
import { SetupRueckblick } from '../components/simulator/SetupRueckblick'

// Simulator: Backtesting von Hand. Symbol, Timeframe und Startpunkt frei wählbar
// (oder blind/zufällig), Replay ohne festes Ende, Orders direkt im Chart.

const chip = (aktiv: boolean) =>
  `inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
    aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'
  }`

const datumZeit = (t: number, mitUhrzeit: boolean) =>
  new Date(t * 1000).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(mitUhrzeit ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'UTC',
  })

// ── Laufende Sitzung ─────────────────────────────────────────────────────────

function SitzungAnsicht({
  config,
  daten,
  fortsetzen,
  onNeu,
  onNochmal,
  onZurueck,
}: {
  config: SitzungConfig
  daten: SitzungDaten
  fortsetzen: GespeicherteSitzung | null
  onNeu: () => void
  /** Stelle aus dem Setup-Rückblick als Wiederholung spielen */
  onNochmal?: (signalZeit: number) => void
  /** gesetzt → diese Ansicht IST eine Wiederholung; führt zurück zur Auswertung */
  onZurueck?: () => void
}) {
  const wiederholung = !!onZurueck
  const sitzung = useSitzung(config, daten, fortsetzen, wiederholung)
  const { broker, candles, cursor, aktuellerPreis, fertig } = sitzung
  const einstellungen = useSimulatorStore((s) => s.einstellungen)
  const einstellungenSetzen = useSimulatorStore((s) => s.einstellungenSetzen)
  const schmal = useSchmal()

  const handel = useHandel(broker, aktuellerPreis, {
    stopsSetzen: sitzung.stopsSetzen,
    orderSetzen: sitzung.orderSetzen,
  })

  const [zeichenModus, setZeichenModus] = useState<ZeichenModus>('aus')
  const [anzeigeSek, setAnzeigeSek] = useState<number | null>(null)
  const [beendenFragen, setBeendenFragen] = useState(false)
  const basisSek = intervallSek(config.interval)
  // Intrabar: wachsende Hauptkerze (Standard) oder die Unterkerzen selbst (Einstellung)
  const zeigeUnter = einstellungen.unterkerzenAnzeigen && sitzung.unterVerfuegbar
  const chartBasis = zeigeUnter ? sitzung.basisUnter : candles
  const timeframes = useMemo(
    () => anzeigeTimeframes(zeigeUnter && sitzung.unterInterval ? sitzung.unterInterval : config.interval),
    [config.interval, zeigeUnter, sitzung.unterInterval],
  )
  const verdeckt = config.blind && !fertig

  // Tastatur: Leertaste = Play/Pause, → = eine Unterkerze, Umschalt+→ = zehn Hauptkerzen
  const { schritte, setLaufend, laufend, jeKerze } = sitzung
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null
      if (ziel && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(ziel.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        setLaufend(!laufend)
      } else if (e.code === 'ArrowRight' && !laufend) {
        e.preventDefault()
        schritte(e.shiftKey ? 10 * jeKerze : 1)
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [schritte, setLaufend, laufend, jeKerze])

  const unrealisiert = broker.position
    ? (broker.position.richtung === 'long' ? 1 : -1) *
      (aktuellerPreis - broker.position.entryPreis) *
      broker.position.menge
    : 0
  const sitzungPnl = broker.kontostand - sitzung.startKapital

  // Marker: ein Pfeil je Einstieg, ein Punkt je (Teil-)Exit
  const marker = useMemo((): ChartMarker[] => {
    const liste: ChartMarker[] = []
    const einstiege = new Set<string>()
    const einstieg = (time: number, richtung: 'long' | 'short') => {
      const key = `${time}|${richtung}`
      if (einstiege.has(key)) return
      einstiege.add(key)
      liste.push({ time, art: richtung })
    }
    for (const t of broker.trades) {
      einstieg(t.entryTime, t.richtung)
      liste.push({ time: t.exitTime, art: 'exit', text: fmtR(t.rMultiple), gewinn: t.pnl > 0 })
    }
    if (broker.position) einstieg(broker.position.entryTime, broker.position.richtung)
    return liste
  }, [broker.trades, broker.position])

  const indikatoren = useMemo(
    () => ({ ema: einstellungen.ema, rsi: einstellungen.rsi, volumen: einstellungen.volumen }),
    [einstellungen.ema, einstellungen.rsi, einstellungen.volumen],
  )
  const emaUmschalten = (periode: number) =>
    einstellungenSetzen({
      ema: einstellungen.ema.includes(periode)
        ? einstellungen.ema.filter((p) => p !== periode)
        : [...einstellungen.ema, periode].sort((a, b) => a - b),
    })

  const gespielt = cursor - sitzung.startIndex + 1
  const ereignis = sitzung.ereignis
  // Vor der ersten Replay-Kerze ist die Startkerze noch nicht sichtbar (candles = sichtbare Kerzen)
  const zeitraum = `${datumZeit((candles[sitzung.startIndex] ?? candles[cursor]).time, false)} – ${datumZeit(candles[cursor].time, false)}`

  return (
    <div className="space-y-3">
      {/* Kopfzeile: was läuft, Konto, Beenden */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-rand bg-flaeche px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-white">
          {verdeckt ? <EyeOff className="h-4 w-4 text-akzent" /> : <Eye className="h-4 w-4 text-akzent" />}
          {verdeckt ? config.anzeigeName : `${symbolName(config.symbol)} · ${config.symbol}`}
        </span>
        <span className="text-gedimmt">{config.interval}</span>
        <span className="tabular-nums text-gedimmt">
          {verdeckt ? 'Zeitraum verdeckt' : datumZeit(candles[cursor].time, basisSek < 86400)}
          {!verdeckt && <span className="opacity-60"> UTC</span>}
        </span>
        {config.offlineDatei && (
          <span
            className="rounded bg-nacht px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gedimmt"
            title="Kursdaten-API nicht erreichbar — eingebauter Abschnitt"
          >
            offline-Vorrat
          </span>
        )}
        <span className="tabular-nums ml-auto text-gedimmt">
          Konto{' '}
          <span className="font-semibold text-white">{fmtGeld(broker.kontostand + unrealisiert)}</span>
          <span className={`ml-2 ${sitzungPnl + unrealisiert >= 0 ? 'text-long' : 'text-short'}`}>
            {fmtGeldVz(sitzungPnl + unrealisiert)} Sitzung
          </span>
        </span>
        {wiederholung && (
          <button
            onClick={onZurueck}
            className="inline-flex items-center gap-1.5 rounded-lg bg-akzent px-3 py-1.5 text-xs font-bold text-nacht hover:brightness-110"
          >
            <Undo2 className="h-3.5 w-3.5" /> Zurück zur Auswertung
          </button>
        )}
        {!wiederholung &&
          !fertig &&
          (beendenFragen ? (
            <span className="inline-flex items-center gap-2 text-xs">
              {broker.position ? 'Position wird glattgestellt.' : 'Sitzung auswerten?'}
              <button onClick={sitzung.beenden} className="rounded-lg bg-short px-3 py-1.5 font-semibold text-white">
                Beenden
              </button>
              <button onClick={() => setBeendenFragen(false)} className="text-gedimmt hover:text-white">
                Abbrechen
              </button>
            </span>
          ) : (
            <button
              onClick={() => setBeendenFragen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-nacht px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white"
            >
              <Flag className="h-3.5 w-3.5" /> Beenden &amp; auswerten
            </button>
          ))}
      </div>

      {wiederholung && (
        <div className="rounded-xl border border-akzent/40 bg-akzent/5 px-4 py-2.5 text-sm text-akzent">
          Wiederholung: Du startest kurz vor dem Signal. Suche die Merkmale aus dem Rückblick im Chart und
          handle das Setup — diese Trades zählen nicht fürs Journal.
        </div>
      )}

      {fertig && !wiederholung && (
        <div className="rounded-xl border border-akzent/40 bg-flaeche p-4 text-sm">
          <h2 className="font-bold text-white">Sitzung beendet — Auflösung</h2>
          <p className="mt-1 text-gedimmt">
            {symbolName(config.symbol)} ({config.symbol}, {config.interval}) · {zeitraum} · {gespielt} Kerzen
            gespielt ·{' '}
            <span className={sitzungPnl >= 0 ? 'text-long' : 'text-short'}>{fmtGeldVz(sitzungPnl, 2)}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onNeu}
              className="rounded-lg bg-akzent px-4 py-2 text-sm font-bold text-nacht hover:brightness-110"
            >
              Neue Sitzung
            </button>
            <Link to="/journal" className="rounded-lg bg-nacht px-4 py-2 text-sm font-semibold text-schrift hover:text-white">
              Zum Journal
            </Link>
          </div>
        </div>
      )}

      {fertig && !wiederholung && (
        <SetupRueckblick
          sitzung={config}
          candles={candles}
          startIndex={sitzung.startIndex}
          endIndex={cursor}
          trades={broker.trades}
          onNochmal={config.offlineDatei ? undefined : onNochmal}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-rand bg-flaeche p-2 sm:p-3">
            {/* Werkzeugleiste: Timeframe, Indikatoren, Zeichnen */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {timeframes.map((tf) => {
                const aktiv = (anzeigeSek ?? basisSek) === tf.sek
                return (
                  <button
                    key={tf.sek}
                    onClick={() => setAnzeigeSek(tf.sek === basisSek ? null : tf.sek)}
                    className={chip(aktiv)}
                    title={tf.sek === basisSek ? 'Basis-Timeframe der Sitzung' : 'Dieselben Kerzen, gröber zusammengefasst'}
                  >
                    {tf.label}
                  </button>
                )
              })}
              <span className="mx-1 h-5 w-px bg-rand" />
              {[20, 50, 200].map((p) => (
                <button key={p} onClick={() => emaUmschalten(p)} className={chip(einstellungen.ema.includes(p))}>
                  EMA {p}
                </button>
              ))}
              <button onClick={() => einstellungenSetzen({ rsi: !einstellungen.rsi })} className={chip(einstellungen.rsi)}>
                RSI
              </button>
              <button
                onClick={() => einstellungenSetzen({ volumen: !einstellungen.volumen })}
                className={chip(einstellungen.volumen)}
              >
                Vol
              </button>
              <span className="mx-1 h-5 w-px bg-rand" />
              <button
                onClick={() => setZeichenModus(zeichenModus === 'linie' ? 'aus' : 'linie')}
                className={chip(zeichenModus === 'linie')}
                title="Horizontale Linie: ein Tipp in den Chart"
              >
                <Minus className="h-3.5 w-3.5" /> Linie
              </button>
              <button
                onClick={() => setZeichenModus(zeichenModus === 'zone' ? 'aus' : 'zone')}
                className={chip(zeichenModus === 'zone')}
                title="S/R-Zone: zwei Tipps (obere und untere Kante)"
              >
                <RectangleHorizontal className="h-3.5 w-3.5" /> Zone
              </button>
              <button
                onClick={() => setZeichenModus(zeichenModus === 'trend' ? 'aus' : 'trend')}
                className={chip(zeichenModus === 'trend')}
                title="Trendlinie: zwei Tipps (z.B. zwei Tiefs) — wird nach rechts verlängert"
              >
                <TrendingUp className="h-3.5 w-3.5" /> Trend
              </button>
              <button
                onClick={() => setZeichenModus(zeichenModus === 'messen' ? 'aus' : 'messen')}
                className={chip(zeichenModus === 'messen')}
                title="Messen: zwei Tipps — zeigt Abstand in %, Preis und Kerzen"
              >
                <Ruler className="h-3.5 w-3.5" /> Messen
              </button>
              {sitzung.zeichnungen.length > 0 && (
                <button
                  onClick={() => sitzung.setZeichnungen([])}
                  className={chip(false)}
                  title="Alle Zeichnungen löschen"
                >
                  <Eraser className="h-3.5 w-3.5" /> {sitzung.zeichnungen.length}
                </button>
              )}
            </div>
            <HandelsChart
              candles={chartBasis}
              cursor={chartBasis.length - 1}
              hoehe={schmal ? 380 : 540}
              zeitVerdeckt={verdeckt}
              bucketSek={anzeigeSek ?? undefined}
              zeichnungen={sitzung.zeichnungen}
              zeichenModus={zeichenModus}
              onZeichnung={(z) => sitzung.setZeichnungen((alt) => [...alt, z])}
              linien={handel.linien}
              onLinieZiehen={handel.onLinieZiehen}
              onLinieLos={handel.onLinieLos}
              onPick={handel.onPick}
              marker={marker}
              indikatoren={indikatoren}
            />
          </div>

          <ReplayControls
            laufend={sitzung.laufend}
            geschwindigkeit={sitzung.tempo}
            fertig={fertig}
            onLaufend={sitzung.setLaufend}
            onGeschwindigkeit={sitzung.setTempo}
            onStep={() => sitzung.schritte(1)}
            stufen={GESCHWINDIGKEITEN}
            onSprung={() => sitzung.schritte(10 * sitzung.jeKerze)}
          >
            <label
              className={`inline-flex items-center gap-1.5 ${sitzung.unterVerfuegbar ? 'cursor-pointer' : 'opacity-50'}`}
              title={
                sitzung.unterVerfuegbar
                  ? 'Chart zeigt die Unterkerzen statt der wachsenden Hauptkerze'
                  : 'Keine Unterkerzen ladbar — Kerzen werden über den OHLC-Pfad angenähert'
              }
            >
              <input
                type="checkbox"
                checked={einstellungen.unterkerzenAnzeigen}
                disabled={!sitzung.unterVerfuegbar}
                onChange={(e) => einstellungenSetzen({ unterkerzenAnzeigen: e.target.checked })}
                className="accent-akzent"
              />
              {sitzung.unterInterval ?? 'Unter'}-Kerzen
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5" title="Replay hält an, sobald eine Order füllt oder eine Position schließt">
              <input
                type="checkbox"
                checked={einstellungen.pauseBeiEreignis}
                onChange={(e) => einstellungenSetzen({ pauseBeiEreignis: e.target.checked })}
                className="accent-akzent"
              />
              Pause bei Fill/Exit
            </label>
            {sitzung.wartetAufDaten ? (
              sitzung.ladeFehler ? (
                <button onClick={() => void sitzung.nachladen()} className="text-short underline">
                  Nachladen fehlgeschlagen — erneut
                </button>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> lade Kerzen…
                </span>
              )
            ) : (
              <span>{fertig ? 'beendet' : `Kerze ${Math.max(0, gespielt)}`}</span>
            )}
          </ReplayControls>

          {ereignis && !fertig && cursor - ereignis.cursor <= 20 && (
            <div
              key={ereignis.nr}
              className={`rounded-xl border px-4 py-2.5 text-sm ${
                ereignis.art === 'fill'
                  ? 'border-akzent/40 text-akzent'
                  : (ereignis.trade?.pnl ?? 0) > 0
                    ? 'border-long/40 text-long'
                    : 'border-short/40 text-short'
              }`}
            >
              {ereignis.art === 'fill'
                ? 'Order ausgeführt — Position ist offen.'
                : ereignis.trade
                  ? `Position geschlossen (${
                      { sl: 'Stop-Loss', tp: 'Take-Profit', trailing: 'Trailing-Stop', manuell: 'manuell', teil: 'Teilverkauf', szenarioEnde: 'Ende' }[
                        ereignis.trade.exitGrund
                      ]
                    }): ${fmtR(ereignis.trade.rMultiple)} · ${fmtGeldVz(ereignis.trade.pnl, 2)}`
                  : 'Position geschlossen.'}
            </div>
          )}

          <PositionPanel
            position={broker.position}
            offeneOrder={broker.offeneOrder}
            aktuellerPreis={aktuellerPreis}
            onSchliessen={sitzung.schliessen}
            onStornieren={sitzung.stornieren}
            onTeilSchliessen={sitzung.teilweiseSchliessen}
            onBreakEven={sitzung.aufBreakEven}
            onStopsSetzen={sitzung.stopsSetzen}
          />
        </div>

        <div className="space-y-3">
          {!fertig && (
            <OrderTicket
              entwurf={handel.entwurf}
              onEntwurf={handel.entwurfTeil}
              aktuellerPreis={aktuellerPreis}
              kontostand={broker.kontostand}
              barIndex={cursor}
              deaktiviert={!!broker.position || !!broker.offeneOrder}
              onPlatzieren={sitzung.platzieren}
              atr={sitzung.atr}
              maxHebel={einstellungen.maxHebel}
              mitSetupTag
              pickZiel={handel.pickZiel}
              onPickZiel={handel.setPickZiel}
            />
          )}
          <SitzungsStatistik trades={broker.trades} startKapital={sitzung.startKapital} />
        </div>
      </div>

      <div className="rounded-xl border border-rand bg-flaeche p-4">
        <h3 className="mb-2 text-sm font-semibold text-white">Trades dieser Sitzung</h3>
        <TradeHistorie trades={broker.trades} mitSetup mitExkursion mitZeit={!verdeckt} />
      </div>
    </div>
  )
}

// ── Startdialog ──────────────────────────────────────────────────────────────

type Wahl = { symbol: string; interval: string; start: number | 'zufall'; blind: boolean }

function ProzentFeld({
  label,
  wert,
  onWert,
}: {
  label: string
  wert: number
  onWert: (anteil: number) => void
}) {
  return (
    <label className="block text-xs text-gedimmt">
      {label}
      <input
        type="number"
        min={0}
        step={0.01}
        value={Number((wert * 100).toFixed(4))}
        onChange={(e) => onWert(Math.max(0, Number(e.target.value) || 0) / 100)}
        className="mt-0.5 w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent"
      />
    </label>
  )
}

function Kosten({ e, setzen }: { e: SimEinstellungen; setzen: (neu: Partial<SimEinstellungen>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <ProzentFeld label="Taker-Gebühr (%)" wert={e.taker} onWert={(taker) => setzen({ taker })} />
      <ProzentFeld label="Maker-Gebühr (%)" wert={e.maker} onWert={(maker) => setzen({ maker })} />
      <ProzentFeld label="Slippage (%)" wert={e.slippage} onWert={(slippage) => setzen({ slippage })} />
      <label className="block text-xs text-gedimmt">
        Max. Hebel
        <input
          type="number"
          min={1}
          max={125}
          value={e.maxHebel}
          onChange={(ev) => setzen({ maxHebel: Math.min(125, Math.max(1, Number(ev.target.value) || 1)) })}
          className="mt-0.5 w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent"
        />
      </label>
      <label className="col-span-2 inline-flex items-center gap-2 text-xs text-gedimmt sm:col-span-4">
        <input
          type="checkbox"
          checked={e.funding}
          onChange={(ev) => setzen({ funding: ev.target.checked })}
          className="accent-akzent"
        />
        Funding berechnen (0,01 % je 8 h, Long zahlt) — gilt wie die Gebühren ab der nächsten Sitzung
      </label>
    </div>
  )
}

function StartDialog({
  gespeichert,
  onStart,
  onFortsetzen,
  onVerwerfen,
}: {
  gespeichert: GespeicherteSitzung | null
  onStart: (wahl: Wahl) => void
  onFortsetzen: () => void
  onVerwerfen: () => void
}) {
  const einstellungen = useSimulatorStore((s) => s.einstellungen)
  const einstellungenSetzen = useSimulatorStore((s) => s.einstellungenSetzen)
  const kontostand = useSimulatorStore((s) => s.kontostand)
  const [modus, setModus] = useState<'gezielt' | 'blind'>('gezielt')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setIntervall] = useState('1h')
  const [blindIntervall, setBlindIntervall] = useState('zufall')
  const [datum, setDatum] = useState('2024-01-01')
  const [zufallsDatum, setZufallsDatum] = useState(false)
  const [kostenOffen, setKostenOffen] = useState(false)

  const minDatum = new Date(fruehesterStart(symbol, interval) * 1000).toISOString().slice(0, 10)
  const [jetzt] = useState(() => Date.now())
  const maxDatum = new Date(jetzt - 500 * intervallSek(interval) * 1000).toISOString().slice(0, 10)

  function los() {
    if (modus === 'blind') {
      onStart({ symbol: 'zufall', interval: blindIntervall, start: 'zufall', blind: true })
      return
    }
    const t = Date.parse(`${datum}T00:00:00Z`) / 1000
    onStart({ symbol, interval, start: zufallsDatum || !Number.isFinite(t) ? 'zufall' : t, blind: false })
  }

  const karte = 'rounded-xl border border-rand bg-flaeche p-4 sm:p-5'

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {gespeichert && (
        <div className={`${karte} border-akzent/40`}>
          <h2 className="font-semibold text-white">Laufende Sitzung</h2>
          <p className="mt-1 text-sm text-gedimmt">
            {gespeichert.config.blind
              ? gespeichert.config.anzeigeName
              : `${symbolName(gespeichert.config.symbol)} · ab ${datumZeit(gespeichert.config.startZeit, false)}`}{' '}
            · {gespeichert.config.interval} · {Math.max(0, gespeichert.gespieltKerzen)} Kerzen gespielt ·{' '}
            {gespeichert.broker.trades.length} Trades
            {gespeichert.broker.position && ' · Position offen'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onFortsetzen}
              className="inline-flex items-center gap-2 rounded-lg bg-akzent px-4 py-2 text-sm font-bold text-nacht hover:brightness-110"
            >
              <PlayCircle className="h-4 w-4" /> Fortsetzen
            </button>
            <button
              onClick={onVerwerfen}
              className="inline-flex items-center gap-2 rounded-lg bg-nacht px-4 py-2 text-sm text-gedimmt hover:text-white"
            >
              <Trash2 className="h-4 w-4" /> Verwerfen
            </button>
          </div>
        </div>
      )}

      <div className={karte}>
        <h2 className="font-semibold text-white">Neue Sitzung</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ['gezielt', CalendarDays, 'Gezielt testen', 'Symbol, Timeframe und Startdatum selbst wählen'],
              ['blind', Dices, 'Blind', 'Zufälliger Abschnitt, Symbol und Datum verdeckt'],
            ] as const
          ).map(([id, Icon, titel, text]) => (
            <button
              key={id}
              onClick={() => setModus(id)}
              className={`rounded-lg border p-3 text-left ${
                modus === id ? 'border-akzent bg-akzent/10' : 'border-rand bg-nacht hover:border-gedimmt'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon className="h-4 w-4 text-akzent" /> {titel}
              </span>
              <span className="mt-1 block text-xs text-gedimmt">{text}</span>
            </button>
          ))}
        </div>

        {modus === 'gezielt' ? (
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1.5 text-xs text-gedimmt">Symbol</div>
              <div className="flex flex-wrap gap-1.5">
                {SYMBOLE.map((s) => (
                  <button key={s.id} onClick={() => setSymbol(s.id)} className={chip(symbol === s.id)} title={s.name}>
                    {s.id.replace('USDT', '')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs text-gedimmt">Timeframe</div>
              <div className="flex flex-wrap gap-1.5">
                {INTERVALLE.map((i) => (
                  <button key={i.id} onClick={() => setIntervall(i.id)} className={chip(interval === i.id)}>
                    {i.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs text-gedimmt">Start</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={datum}
                  min={minDatum}
                  max={maxDatum}
                  disabled={zufallsDatum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent disabled:opacity-40 [color-scheme:dark]"
                />
                <label className="inline-flex items-center gap-2 text-xs text-gedimmt">
                  <input
                    type="checkbox"
                    checked={zufallsDatum}
                    onChange={(e) => setZufallsDatum(e.target.checked)}
                    className="accent-akzent"
                  />
                  zufälliges Datum
                </label>
              </div>
              <p className="mt-1.5 text-xs text-gedimmt">
                Davor siehst du 1.000 Kerzen Vorgeschichte. Das Replay läuft, solange du willst — bis zum
                heutigen Tag.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-1.5 text-xs text-gedimmt">Timeframe</div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setBlindIntervall('zufall')} className={chip(blindIntervall === 'zufall')}>
                Zufall
              </button>
              {INTERVALLE.map((i) => (
                <button key={i.id} onClick={() => setBlindIntervall(i.id)} className={chip(blindIntervall === i.id)}>
                  {i.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gedimmt">
              BTC, ETH oder SOL an einem zufälligen Tag seit 2018. Aufgelöst wird erst, wenn du die Sitzung
              beendest — so handelst du nur, was der Chart zeigt.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={los}
            className="inline-flex items-center gap-2 rounded-lg bg-akzent px-5 py-2.5 font-semibold text-nacht hover:brightness-110"
          >
            <PlayCircle className="h-5 w-5" /> Sitzung starten
          </button>
          <span className="tabular-nums text-xs text-gedimmt">Konto: {fmtGeld(kontostand)}</span>
          <button
            onClick={() => setKostenOffen((o) => !o)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-gedimmt hover:text-white"
          >
            <Settings2 className="h-3.5 w-3.5" /> Gebühren &amp; Hebel
          </button>
        </div>
        {kostenOffen && (
          <div className="mt-4 rounded-lg bg-nacht/60 p-3">
            <Kosten e={einstellungen} setzen={einstellungenSetzen} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-rand/60 p-4 text-xs leading-relaxed text-gedimmt">
        <span className="font-semibold text-schrift">So testest du ein Setup:</span> Stop-Loss im Chart antippen
        oder per ATR setzen, Linien zurechtziehen, Order abschicken — Market füllt sofort zum aktuellen Kurs.
        Leertaste spielt ab, Pfeil rechts geht eine Kerze weiter. Gebühren und Slippage sind eingerechnet; nach
        20–30 Trades sagt dir die Statistik, ob das Setup trägt.
      </div>
    </div>
  )
}

// ── Seite ────────────────────────────────────────────────────────────────────

type Phase =
  | { art: 'start' }
  | { art: 'laedt' }
  | { art: 'fehler'; wahl: Wahl | null }
  | { art: 'aktiv'; config: SitzungConfig; daten: SitzungDaten; fortsetzen: GespeicherteSitzung | null }

export function SimulatorPage() {
  const gespeichert = useSimulatorStore((s) => s.aktiveSitzung)
  const sitzungSpeichern = useSimulatorStore((s) => s.sitzungSpeichern)
  const [phase, setPhase] = useState<Phase>({ art: 'start' })
  // Wiederholung einer Stelle aus dem Setup-Rückblick: läuft neben der beendeten
  // Sitzung (die bleibt eingehängt, nur versteckt), damit die Auswertung erhalten bleibt.
  const [wiederholung, setWiederholung] = useState<
    { art: 'laedt' } | { art: 'fehler' } | { art: 'aktiv'; config: SitzungConfig; daten: SitzungDaten } | null
  >(null)

  async function nochmalSpielen(basis: SitzungConfig, signalZeit: number) {
    setWiederholung({ art: 'laedt' })
    try {
      // 40 Kerzen vor dem Signal einsteigen — genug, um die Lage zu lesen
      const start = signalZeit - 40 * intervallSek(basis.interval)
      const config = neueSitzung({ symbol: basis.symbol, interval: basis.interval, start, blind: false })
      const daten = await ladeSitzung(config)
      setWiederholung({ art: 'aktiv', config, daten })
    } catch {
      setWiederholung({ art: 'fehler' })
    }
  }

  async function starten(wahl: Wahl) {
    setPhase({ art: 'laedt' })
    // Zufallsabschnitte können Datenlücken treffen → ein paar Anläufe
    const versuche = wahl.start === 'zufall' ? 3 : 1
    for (let v = 0; v < versuche; v++) {
      try {
        const config = neueSitzung(wahl)
        const daten = await ladeSitzung(config)
        setPhase({ art: 'aktiv', config, daten, fortsetzen: null })
        return
      } catch {
        // nächster Anlauf
      }
    }
    setPhase({ art: 'fehler', wahl })
  }

  async function offlineStarten() {
    setPhase({ art: 'laedt' })
    try {
      const config = offlineSitzung()
      const daten = await ladeSitzung(config)
      setPhase({ art: 'aktiv', config, daten, fortsetzen: null })
    } catch {
      setPhase({ art: 'fehler', wahl: null })
    }
  }

  async function fortsetzen() {
    if (!gespeichert) return
    setPhase({ art: 'laedt' })
    try {
      const daten = await ladeSitzung(gespeichert.config, gespeichert.cursorZeit)
      setPhase({ art: 'aktiv', config: gespeichert.config, daten, fortsetzen: gespeichert })
    } catch {
      setPhase({ art: 'fehler', wahl: null })
    }
  }

  const aktiv = phase.art === 'aktiv'

  return (
    <div className={`mx-auto px-3 py-5 sm:px-4 sm:py-8 ${aktiv ? 'max-w-[1500px]' : 'max-w-6xl'}`}>
      {!aktiv && (
        <div className="mx-auto mb-5 max-w-3xl">
          <h1 className="text-2xl font-bold text-white">Simulator</h1>
          <p className="mt-1 text-sm text-gedimmt">
            Teste deine Setups an echten historischen Kursen — Kerze für Kerze, mit realistischen Gebühren,
            Slippage und Auswertung.
          </p>
        </div>
      )}

      {phase.art === 'start' && (
        <StartDialog
          gespeichert={gespeichert}
          onStart={(w) => void starten(w)}
          onFortsetzen={() => void fortsetzen()}
          onVerwerfen={() => sitzungSpeichern(null)}
        />
      )}
      {phase.art === 'laedt' && (
        <div className="flex h-64 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      )}
      {phase.art === 'fehler' && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-gedimmt">
          <WifiOff className="h-6 w-6" />
          <p className="max-w-md text-center text-sm">
            Kursdaten konnten nicht geladen werden — entweder keine Verbindung oder für diesen Zeitraum gibt es
            keine Kerzen.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {phase.wahl && (
              <button
                onClick={() => void starten(phase.wahl as Wahl)}
                className="rounded-lg bg-flaeche px-4 py-2 text-sm hover:text-white"
              >
                Erneut versuchen
              </button>
            )}
            <button onClick={() => void offlineStarten()} className="rounded-lg bg-flaeche px-4 py-2 text-sm hover:text-white">
              Eingebauten Abschnitt spielen
            </button>
            <button onClick={() => setPhase({ art: 'start' })} className="rounded-lg bg-flaeche px-4 py-2 text-sm hover:text-white">
              Zurück
            </button>
          </div>
        </div>
      )}
      {phase.art === 'aktiv' && (
        <div className={wiederholung ? 'hidden' : ''}>
          <SitzungAnsicht
            key={phase.config.id}
            config={phase.config}
            daten={phase.daten}
            fortsetzen={phase.fortsetzen}
            onNeu={() => setPhase({ art: 'start' })}
            onNochmal={(zeit) => void nochmalSpielen(phase.config, zeit)}
          />
        </div>
      )}
      {wiederholung?.art === 'laedt' && (
        <div className="flex h-64 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      )}
      {wiederholung?.art === 'fehler' && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-gedimmt">
          <WifiOff className="h-6 w-6" />
          <p className="text-sm">Die Stelle konnte nicht geladen werden.</p>
          <button onClick={() => setWiederholung(null)} className="rounded-lg bg-flaeche px-4 py-2 text-sm hover:text-white">
            Zurück zur Auswertung
          </button>
        </div>
      )}
      {wiederholung?.art === 'aktiv' && (
        <SitzungAnsicht
          key={wiederholung.config.id}
          config={wiederholung.config}
          daten={wiederholung.daten}
          fortsetzen={null}
          onNeu={() => setWiederholung(null)}
          onZurueck={() => setWiederholung(null)}
        />
      )}
    </div>
  )
}
