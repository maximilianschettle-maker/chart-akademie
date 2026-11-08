import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Ban, Check, Eraser, Layers, LoaderCircle, RectangleHorizontal, RotateCcw, Sparkles, Target, X } from 'lucide-react'
import { workerKonfiguriert } from '../aktien/data/client'
import { tradePruefen } from '../journal/pruefung'
import { PruefungKarte } from '../journal/PruefungKarte'
import type { Pruefung } from '../journal/types'
import { uebungsFakten } from './kiCoach'
import { ChartPanel } from '../components/chart/ChartPanel'
import { HandelsChart, type ChartBox, type ChartLinie, type ChartMarker } from '../components/chart/HandelsChart'
import { ReplayControls } from '../components/chart/ReplayControls'
import { useSchmal } from '../hooks/useSchmal'
import { useTracker } from '../tracker/useTracker'
import { KNOPF, KNOPF_AKZENT, Kachel } from '../aktien/components/ui'
import { fmtKurs } from '../aktien/engine/format'
import { fmtR } from '../engine/format'
import type { Richtung, Zeichnung } from '../types'
import { richtungAus, RICHTUNG_TEXT, type Richtung3, type RichtungErgebnis } from '../engine/richtung'
import { findeZonen, vergleicheZonen, type Zone, type ZonenVergleich } from '../engine/zonen'
import { letzterAtr } from '../engine/indikatoren/atr'
import { rundePreis } from '../engine/format'
import { ladeReplay, neueRunde, type ReplayDaten, type Runde } from './daten'
import { topDownStatistik, useTopDownStore } from './store'
import { bewerteKeinTrade, bewerteTrade, simuliereTrade, type Entscheidungsbewertung, type Simulation, type TradeWahl } from './replay'

// Top-Down-Übung: 1. Tageschart → Richtung, 2. Stundenchart → Zonen als Bänder, Vergleich mit der
// Zonen-Erkennung, 3. Replay (15 min bei Krypto, sonst Stunde) an den Zonen: Setup? Einstieg/Stop/Ziel
// oder „Kein Trade“, dann Auflösung mit fünf Kriterien. Markt und Datum bleiben bis zur Zonen-Auflösung verdeckt.

const INDIKATOREN = { ema: [20, 50], rsi: false, volumen: false }
const EMA_TAG = [20, 50]
const SETUPS = [
  { id: 'range-trading', text: 'Range' },
  { id: 'breakout-retest', text: 'Breakout + Retest' },
  { id: 'liquidity-sweep', text: 'Fehlausbruch / Sweep' },
  { id: 'trendfolge-ema', text: 'Trend-Pullback' },
]
type Geschwindigkeit = 1 | 2 | 5 | 10
const TAKT_MS: Record<Geschwindigkeit, number> = { 1: 900, 2: 450, 5: 180, 10: 80 }

type Schritt = 'laedt' | 'richtung' | 'richtungAufgeloest' | 'zonen' | 'zonenAufgeloest' | 'replayLaedt' | 'replay' | 'replayLaeuftAus' | 'replayAufgeloest' | 'fehler'
type Entscheidung = { typ: 'trade'; trade: TradeWahl; index: number; setupId: string } | { typ: 'kein-trade'; index: number }

function datumText(unixSek: number): string {
  return new Date(unixSek * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const BEWERTUNG_FARBE: Record<string, string> = { sauber: 'text-long', richtig: 'text-long', 'mit Abstrichen': 'text-akzent', falsch: 'text-short', verpasst: 'text-short' }

export function TopDownPage() {
  const schmal = useSchmal()
  const tracker = useTracker()
  const runden = useTopDownStore((s) => s.runden)
  const rundeSpeichern = useTopDownStore((s) => s.rundeSpeichern)
  const replayErgaenzen = useTopDownStore((s) => s.replayErgaenzen)
  const stats = useMemo(() => topDownStatistik(runden), [runden])

  const [schritt, setSchritt] = useState<Schritt>('laedt')
  const [fehler, setFehler] = useState<string | null>(null)
  const [runde, setRunde] = useState<Runde | null>(null)
  const [rundeAm, setRundeAm] = useState<number | null>(null)
  const [wahl, setWahl] = useState<Richtung3 | null>(null)
  const [richtung, setRichtung] = useState<RichtungErgebnis | null>(null)
  const [zeichnungen, setZeichnungen] = useState<Zeichnung[]>([])
  const [modus, setModus] = useState<'zone' | 'aus'>('zone')
  const [zonen, setZonen] = useState<Zone[]>([])
  const [vergleich, setVergleich] = useState<ZonenVergleich | null>(null)
  // Replay
  const [replay, setReplay] = useState<ReplayDaten | null>(null)
  const [cursor, setCursor] = useState(0)
  const [laufend, setLaufend] = useState(false)
  const [geschwindigkeit, setGeschwindigkeit] = useState<Geschwindigkeit>(2)
  const [tradeRichtung, setTradeRichtung] = useState<Richtung>('long')
  const [setupId, setSetupId] = useState(SETUPS[0].id)
  const [linien, setLinien] = useState<TradeWahl | null>(null)
  const [entscheidung, setEntscheidung] = useState<Entscheidung | null>(null)
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [bewertung, setBewertung] = useState<Entscheidungsbewertung | null>(null)
  const entscheidungRef = useRef<Entscheidung | null>(null)
  // KI-Coach zur Entscheidung (Sitzungsstand, nicht gespeichert)
  const [coach, setCoach] = useState<Pruefung | null>(null)
  const [coachLaeuft, setCoachLaeuft] = useState(false)
  const [coachFehler, setCoachFehler] = useState<string | null>(null)
  const mitWorker = workerKonfiguriert()

  const starten = useCallback(async () => {
    setSchritt('laedt')
    setFehler(null)
    setRunde(null)
    setRundeAm(null)
    setWahl(null)
    setRichtung(null)
    setZeichnungen([])
    setZonen([])
    setVergleich(null)
    setModus('zone')
    setReplay(null)
    setCursor(0)
    setLaufend(false)
    setLinien(null)
    setEntscheidung(null)
    entscheidungRef.current = null
    setSimulation(null)
    setBewertung(null)
    setCoach(null)
    setCoachFehler(null)
    try {
      const r = await neueRunde(tracker.daten)
      setRunde(r)
      setRichtung(richtungAus(r.tag))
      setSchritt('richtung')
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
      setSchritt('fehler')
    }
  }, [tracker.daten])

  useEffect(() => {
    if (schritt === 'laedt' && !runde && tracker.status !== 'laedt') void starten()
  }, [schritt, runde, tracker.status, starten])

  const richtungWaehlen = (r: Richtung3) => {
    setWahl(r)
    setSchritt('richtungAufgeloest')
  }

  const zonenPruefen = () => {
    if (!runde) return
    const z = findeZonen(runde.stunde)
    const atr = letzterAtr(runde.stunde, runde.stunde.length - 1, 14)
    const baender = zeichnungen.flatMap((x) => (x.typ === 'zone' ? [{ preisVon: x.preisVon, preisBis: x.preisBis }] : []))
    const v = vergleicheZonen(z, baender, 0.3 * atr)
    setZonen(z)
    setVergleich(v)
    setSchritt('zonenAufgeloest')
    setModus('aus')
    const am = Date.now()
    setRundeAm(am)
    rundeSpeichern({
      am,
      instrument: runde.instrumentName,
      richtungRichtig: wahl === richtung?.richtung,
      zonenGetroffen: v.getroffen.length,
      zonenWichtig: z.filter((x) => x.wichtig).length,
      zonenUeberfluessig: v.ueberfluessig.length,
    })
  }

  // ── Replay ──────────────────────────────────────────────────────────────────
  const replayStarten = async () => {
    if (!runde) return
    setSchritt('replayLaedt')
    try {
      const r = await ladeReplay(runde)
      setReplay(r)
      setCursor(r.startIndex)
      setSchritt('replay')
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
      setSchritt('zonenAufgeloest')
    }
  }

  const fertig = replay ? cursor >= replay.kerzen.length - 1 : false
  const atrReplay = useMemo(() => (replay ? letzterAtr(replay.kerzen, replay.startIndex, 14) : 0), [replay])
  const wichtigeZonen = useMemo(() => zonen.filter((z) => z.wichtig), [zonen])

  const aufloesen = useCallback(
    (e: Entscheidung) => {
      if (!replay || !richtung) return
      const ctx = { richtungTag: richtung.richtung, zonen: wichtigeZonen, kerzen: replay.kerzen, startIndex: replay.startIndex, entscheidungIndex: e.index, atr: atrReplay || 1 }
      const b = e.typ === 'trade' ? bewerteTrade(ctx, e.trade) : bewerteKeinTrade(ctx)
      const sim = e.typ === 'trade' ? simuliereTrade(replay.kerzen, e.index, e.trade) : null
      setBewertung(b)
      setSimulation(sim)
      setSchritt('replayAufgeloest')
      if (rundeAm !== null) replayErgaenzen(rundeAm, { entscheidung: e.typ, bewertung: b.bewertung, r: sim?.r ?? null })
    },
    [replay, richtung, wichtigeZonen, atrReplay, rundeAm, replayErgaenzen],
  )

  // Takt des Replays; nach der Entscheidung läuft es bis zum Ende durch und löst dann auf
  useEffect(() => {
    if (!laufend || !replay) return
    if (fertig) {
      setLaufend(false)
      const e = entscheidungRef.current
      if (e) aufloesen(e)
      else if (schritt === 'replay') {
        // ohne Entscheidung zu Ende gelaufen → zählt als „Kein Trade“
        const ke: Entscheidung = { typ: 'kein-trade', index: replay.kerzen.length - 1 }
        entscheidungRef.current = ke
        setEntscheidung(ke)
        aufloesen(ke)
      }
      return
    }
    const t = setInterval(() => setCursor((c) => Math.min(replay.kerzen.length - 1, c + 1)), TAKT_MS[geschwindigkeit])
    return () => clearInterval(t)
  }, [laufend, replay, fertig, geschwindigkeit, aufloesen, schritt])

  async function coachFragen() {
    if (!replay || !runde || !entscheidung || !bewertung || !richtung) return
    setCoachLaeuft(true)
    setCoachFehler(null)
    try {
      const uebung = {
        art: 'top-down' as const,
        tagesRichtung: richtung.richtung,
        kriterien: bewertung.kriterien.map((x) => ({ titel: x.titel, ok: x.ok, text: x.text })),
        zonen: wichtigeZonen.map((z) => ({ von: rundePreis(z.von), bis: rundePreis(z.bis), text: z.text })),
        ...(entscheidung.typ === 'kein-trade' ? { keinTrade: { bewertung: bewertung.bewertung, text: bewertung.text } } : {}),
        setupGewaehlt: entscheidung.typ === 'trade' ? (SETUPS.find((s) => s.id === entscheidung.setupId)?.text ?? null) : null,
      }
      const k = replay.kerzen[Math.min(entscheidung.index, replay.kerzen.length - 1)]
      const tradeWahl = entscheidung.typ === 'trade' ? entscheidung.trade : { richtung: 'long' as const, entry: k.close, stop: 0, ziel: 0 }
      const fakten = uebungsFakten(
        {
          markt: runde.instrumentName,
          symbol: runde.symbol,
          waehrung: runde.waehrung,
          richtung: tradeWahl.richtung,
          entryTime: k.time,
          entryPreis: tradeWahl.entry,
          stopLoss: tradeWahl.stop,
          takeProfit: tradeWahl.ziel,
          strategieId: entscheidung.typ === 'trade' ? entscheidung.setupId : 'kein-setup',
          zeitrahmen: replay.intervall,
          ...(simulation && simulation.exitIndex !== null && simulation.exitPreis !== null && simulation.ausgang !== 'nicht gefüllt'
            ? { exitTime: replay.kerzen[simulation.exitIndex].time, exitPreis: simulation.exitPreis, exitGrund: simulation.ausgang === 'ziel' ? ('ziel' as const) : simulation.ausgang === 'stop' ? ('stop' as const) : ('manuell' as const) }
            : {}),
        },
        replay.kerzen,
        uebung,
        true,
      )
      const antwort = await tradePruefen(fakten)
      setCoach({ ...antwort, erstelltAm: Date.now(), mitErgebnis: true })
    } catch (e) {
      setCoachFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setCoachLaeuft(false)
    }
  }

  const tradeVorbereiten = () => {
    if (!replay) return
    const k = replay.kerzen[cursor]
    const atr = atrReplay || k.close * 0.005
    const long = tradeRichtung === 'long'
    const entry = rundePreis(k.close)
    const stop = rundePreis(long ? entry - 1.5 * atr : entry + 1.5 * atr)
    const ziel = rundePreis(long ? entry + 3 * atr : entry - 3 * atr)
    setLinien({ richtung: tradeRichtung, entry, stop, ziel })
  }
  const richtungSetzen = (r: Richtung) => {
    setTradeRichtung(r)
    if (linien && linien.richtung !== r) {
      const dStop = Math.abs(linien.entry - linien.stop)
      const dZiel = Math.abs(linien.ziel - linien.entry)
      setLinien({ richtung: r, entry: linien.entry, stop: rundePreis(r === 'long' ? linien.entry - dStop : linien.entry + dStop), ziel: rundePreis(r === 'long' ? linien.entry + dZiel : linien.entry - dZiel) })
    }
  }
  const linieSetzen = (id: string, preis: number) => {
    if (!linien) return
    if (id === 'entry' || id === 'stop' || id === 'ziel') setLinien({ ...linien, [id]: rundePreis(preis) })
  }
  const entscheiden = (e: Entscheidung) => {
    entscheidungRef.current = e
    setEntscheidung(e)
    setSchritt('replayLaeuftAus')
    setGeschwindigkeit(10)
    setLaufend(true)
  }

  const tagKerzen = useMemo(() => runde?.tag.slice(-150) ?? [], [runde])
  const stundeKerzen = useMemo(() => runde?.stunde ?? [], [runde])
  const zonenBoxen = (zeitVon: number, zeitBis: number): ChartBox[] =>
    wichtigeZonen.map((z) => ({ id: z.id, zeitVon, zeitBis, preisVon: z.von, preisBis: z.bis, fuellung: 'rgba(34,197,94,0.12)', rand: 'rgba(34,197,94,0.6)' }))
  const boxenStunde = useMemo((): ChartBox[] => {
    if (!runde || zonen.length === 0) return []
    return zonenBoxen(runde.stunde[Math.max(0, runde.stunde.length - 300)].time, runde.endeZeit + 3600 * 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runde, zonen])
  const boxenReplay = useMemo((): ChartBox[] => {
    if (!replay) return []
    const sek = replay.intervall === '15m' ? 900 : 3600
    return zonenBoxen(replay.kerzen[0].time, replay.kerzen[replay.kerzen.length - 1].time + sek * 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, zonen])
  const chartLinien = useMemo((): ChartLinie[] => {
    const t = entscheidung?.typ === 'trade' ? entscheidung.trade : linien
    if (!t) return []
    const ziehbar = !entscheidung
    const l: ChartLinie[] = [
      { id: 'entry', preis: t.entry, farbe: '#F59E0B', titel: 'Einstieg', ziehbar, fest: true, imBlick: true },
      { id: 'stop', preis: t.stop, farbe: '#EF4444', titel: 'Stop', ziehbar, imBlick: true },
      { id: 'ziel', preis: t.ziel, farbe: '#22C55E', titel: 'Ziel', ziehbar, imBlick: true },
    ]
    return l
  }, [linien, entscheidung])
  const marker = useMemo((): ChartMarker[] => {
    if (!replay || !entscheidung) return []
    const m: ChartMarker[] = [{ time: replay.kerzen[Math.min(entscheidung.index, replay.kerzen.length - 1)].time, art: 'hinweis', text: entscheidung.typ === 'trade' ? 'Entscheidung' : 'Kein Trade', oben: true }]
    if (simulation?.fillIndex !== null && simulation?.fillIndex !== undefined && entscheidung.typ === 'trade') m.push({ time: replay.kerzen[simulation.fillIndex].time, art: entscheidung.trade.richtung, text: 'Fill' })
    if (simulation?.exitIndex !== null && simulation?.exitIndex !== undefined && simulation.ausgang !== 'offen' && simulation.ausgang !== 'nicht gefüllt') m.push({ time: replay.kerzen[simulation.exitIndex].time, art: 'exit', gewinn: (simulation.r ?? 0) > 0, text: simulation.ausgang === 'ziel' ? 'Ziel' : 'Stop', oben: entscheidung.typ === 'trade' && entscheidung.trade.richtung === 'long' })
    return m
  }, [replay, entscheidung, simulation])

  const anzahlBaender = zeichnungen.filter((z) => z.typ === 'zone').length
  const richtigeRichtung = wahl !== null && wahl === richtung?.richtung
  const chip = (aktiv: boolean, extra = '') => `tipp inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'} ${extra}`
  const crvAktuell = linien ? Math.abs(linien.ziel - linien.entry) / Math.max(1e-9, Math.abs(linien.entry - linien.stop)) : 0

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      <Link to="/training" className="inline-flex items-center gap-1 text-xs font-semibold text-gedimmt hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Lernpfad
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
          <Layers className="h-6 w-6 text-akzent" /> Top-Down-Analyse
        </h1>
        {stats.runden > 0 && (
          <span className="text-xs text-gedimmt">
            {stats.runden} Runden · Richtung {(stats.richtungQuote * 100).toFixed(0)} % · Zonen {(stats.zonenQuote * 100).toFixed(0)} %
            {stats.replayRunden > 0 && ` · Entscheidung ${(stats.replayQuote * 100).toFixed(0)} %`}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gedimmt">Richtung auf dem Tageschart, Zonen auf dem Stundenchart, dann Kerze für Kerze an der Zone entscheiden. Markt und Datum bleiben bis zur Zonen-Auflösung verdeckt.</p>

      {schritt === 'laedt' && (
        <p className="mt-6 inline-flex items-center gap-2 text-sm text-gedimmt">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Runde wird geladen …
        </p>
      )}
      {schritt === 'fehler' && (
        <div className="mt-6 rounded-xl border border-rand bg-flaeche p-4 text-sm">
          <p className="text-short">Keine Daten für eine Runde: {fehler}</p>
          <button type="button" onClick={() => void starten()} className={`${KNOPF} mt-3`}>
            <RotateCcw className="h-3.5 w-3.5" /> Nochmal versuchen
          </button>
        </div>
      )}

      {runde && schritt !== 'laedt' && schritt !== 'fehler' && (
        <>
          {/* Schritt 1 */}
          <section className="mt-5 rounded-xl border border-rand bg-flaeche p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-white">1. Tageschart: Welche Richtung?</h2>
            <p className="mt-0.5 text-xs text-gedimmt">Letzte 150 Tageskerzen mit EMA 20 und 50. {schritt === 'richtung' ? 'Entscheide nach Hochs und Tiefs.' : ''}</p>
            {(schritt === 'richtung' || schritt === 'richtungAufgeloest') && (
              <div className="-mx-3 mt-3 sm:-mx-2">
                <ChartPanel candles={tagKerzen} hoehe={schmal ? 300 : 360} zeigeVolumen={false} emaPerioden={EMA_TAG} zeitSichtbar={false} kompakteBeschriftung />
              </div>
            )}
            {schritt === 'richtung' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(['auf', 'ab', 'seitwaerts'] as Richtung3[]).map((r) => (
                  <button key={r} type="button" onClick={() => richtungWaehlen(r)} className={KNOPF_AKZENT}>
                    {RICHTUNG_TEXT[r]}
                  </button>
                ))}
              </div>
            ) : (
              richtung && (
                <div className={`mt-3 rounded-lg border p-3 text-sm ${richtigeRichtung ? 'border-long/40 bg-long/10' : 'border-short/40 bg-short/10'}`}>
                  <p className="font-semibold text-white">
                    {richtigeRichtung ? <Check className="mr-1 inline h-4 w-4 text-long" /> : <X className="mr-1 inline h-4 w-4 text-short" />}
                    Du: {wahl ? RICHTUNG_TEXT[wahl] : '–'} · Auflösung: {RICHTUNG_TEXT[richtung.richtung]}
                  </p>
                  <p className="mt-1 text-schrift">{richtung.begruendung}</p>
                  {schritt === 'richtungAufgeloest' && (
                    <button type="button" onClick={() => setSchritt('zonen')} className={`${KNOPF_AKZENT} mt-3`}>
                      Weiter zu den Zonen
                    </button>
                  )}
                </div>
              )
            )}
          </section>

          {/* Schritt 2 */}
          {schritt !== 'richtung' && schritt !== 'richtungAufgeloest' && (
            <section className="mt-4 rounded-xl border border-rand bg-flaeche p-3 sm:p-4">
              <h2 className="text-sm font-semibold text-white">2. Stundenchart: Zonen einzeichnen</h2>
              {(schritt === 'zonen' || schritt === 'zonenAufgeloest') && (
                <>
                  <p className="mt-0.5 text-xs text-gedimmt">
                    Bänder an markanten Hochs und Tiefs, Range-Kanten und Ausgangspunkten starker Bewegungen. Zone = zwei Tipps in den Chart (obere und untere Kante).
                  </p>
                  {schritt === 'zonen' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button type="button" className={chip(modus === 'zone')} onClick={() => setModus(modus === 'zone' ? 'aus' : 'zone')} aria-pressed={modus === 'zone'}>
                        <RectangleHorizontal className="h-3.5 w-3.5" /> Zone
                      </button>
                      <button type="button" className={chip(false)} onClick={() => setZeichnungen((z) => z.slice(0, -1))} disabled={zeichnungen.length === 0}>
                        <Eraser className="h-3.5 w-3.5" /> Letzte weg
                      </button>
                      <button type="button" className={chip(false)} onClick={() => setZeichnungen([])} disabled={zeichnungen.length === 0}>
                        Alle weg
                      </button>
                      <span className="text-[11px] text-gedimmt">
                        {anzahlBaender} {anzahlBaender === 1 ? 'Band' : 'Bänder'}
                      </span>
                    </div>
                  )}
                  <div className="-mx-3 mt-3 sm:-mx-2">
                    <HandelsChart
                      candles={stundeKerzen}
                      cursor={stundeKerzen.length - 1}
                      hoehe={schmal ? 360 : 440}
                      indikatoren={INDIKATOREN}
                      zeichnungen={zeichnungen}
                      zeichenModus={modus}
                      onZeichnung={(z) => setZeichnungen((alt) => [...alt, z])}
                      boxen={boxenStunde}
                      kompakteBeschriftung
                    />
                  </div>
                </>
              )}
              {schritt === 'zonen' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={zonenPruefen} className={KNOPF_AKZENT} disabled={anzahlBaender === 0}>
                    Zonen prüfen
                  </button>
                  {anzahlBaender === 0 && <span className="text-xs text-gedimmt">Mindestens ein Band einzeichnen.</span>}
                </div>
              )}
              {vergleich && (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <Kachel titel="Getroffen" wert={`${vergleich.getroffen.length} / ${wichtigeZonen.length}`} farbe={vergleich.quote >= 0.6 ? 'text-long' : vergleich.quote >= 0.3 ? 'text-akzent' : 'text-short'} hinweis="wichtige Zonen" />
                    <Kachel titel="Verfehlt" wert={String(vergleich.verfehlt.length)} farbe={vergleich.verfehlt.length ? 'text-short' : 'text-long'} />
                    <Kachel titel="Ohne Zone" wert={String(vergleich.ueberfluessig.length)} farbe={vergleich.ueberfluessig.length ? 'text-akzent' : 'text-long'} hinweis="deine Bänder" />
                  </div>
                  {schritt === 'zonenAufgeloest' && (
                    <>
                      <p className="text-xs text-gedimmt">Grüne Boxen im Chart: die wichtigen Zonen der Erkennung. Deine Bänder bleiben sichtbar.</p>
                      {vergleich.getroffen.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-long">Getroffen</div>
                          <ul className="mt-1 space-y-0.5 text-xs text-schrift">
                            {vergleich.getroffen.map(({ zone }) => (
                              <li key={zone.id}>
                                <Check className="mr-1 inline h-3.5 w-3.5 text-long" />
                                {fmtKurs(zone.von, runde.waehrung)} – {fmtKurs(zone.bis, runde.waehrung)}: {zone.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {vergleich.verfehlt.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-short">Fehlt bei dir</div>
                          <ul className="mt-1 space-y-0.5 text-xs text-schrift">
                            {vergleich.verfehlt.map((zone) => (
                              <li key={zone.id}>
                                <X className="mr-1 inline h-3.5 w-3.5 text-short" />
                                {fmtKurs(zone.von, runde.waehrung)} – {fmtKurs(zone.bis, runde.waehrung)}: {zone.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(vergleich.nebensaechlich.length > 0 || vergleich.ueberfluessig.length > 0) && (
                        <div>
                          <div className="text-xs font-semibold text-akzent">Unwichtig oder ohne Zone</div>
                          <ul className="mt-1 space-y-0.5 text-xs text-schrift">
                            {vergleich.nebensaechlich.map(({ zone, band }, i) => (
                              <li key={`n${i}`}>
                                {fmtKurs(Math.min(band.preisVon, band.preisBis), runde.waehrung)} – {fmtKurs(Math.max(band.preisVon, band.preisBis), runde.waehrung)}: trifft nur eine schwache Zone ({zone.text})
                              </li>
                            ))}
                            {vergleich.ueberfluessig.map((band, i) => (
                              <li key={`u${i}`}>
                                {fmtKurs(Math.min(band.preisVon, band.preisBis), runde.waehrung)} – {fmtKurs(Math.max(band.preisVon, band.preisBis), runde.waehrung)}: dort hat die Erkennung nichts – welche Hochs oder Tiefs stützen das Band?
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-xs text-gedimmt">
                    Auflösung: {runde.instrumentName} ({runde.symbol}), Stand {datumText(runde.endeZeit)} · Quelle {runde.quelle === 'binance' ? 'Binance' : 'Tracker (Yahoo)'}
                  </p>
                  {schritt === 'zonenAufgeloest' && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void replayStarten()} className={KNOPF_AKZENT}>
                        <Target className="h-3.5 w-3.5" /> Weiter zum Replay
                      </button>
                      <button type="button" onClick={() => void starten()} className={KNOPF}>
                        <RotateCcw className="h-3.5 w-3.5" /> Nächste Runde
                      </button>
                      {fehler && <span className="text-xs text-short">{fehler}</span>}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Schritt 3: Replay */}
          {schritt === 'replayLaedt' && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-gedimmt">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Replay-Kerzen werden geladen …
            </p>
          )}
          {replay && (schritt === 'replay' || schritt === 'replayLaeuftAus' || schritt === 'replayAufgeloest') && (
            <section className="mt-4 rounded-xl border border-rand bg-flaeche p-3 sm:p-4">
              <h2 className="text-sm font-semibold text-white">3. {replay.intervall === '15m' ? '15-Minuten' : 'Stunden'}-Chart: Setup an einer Zone?</h2>
              <p className="mt-0.5 text-xs text-gedimmt">
                Der Chart läuft ab dem Zeitpunkt der Analyse weiter. An einer grünen Zone: Setup erkannt → Trade vorbereiten, Linien ziehen, setzen. Kein sauberes Setup oder gegen den Tagestrend → „Kein Trade“ ist richtig.
              </p>
              <div className="-mx-3 mt-3 sm:-mx-2">
                <HandelsChart
                  candles={replay.kerzen}
                  cursor={cursor}
                  hoehe={schmal ? 360 : 440}
                  indikatoren={INDIKATOREN}
                  boxen={boxenReplay}
                  linien={chartLinien}
                  onLinieZiehen={linieSetzen}
                  onLinieLos={linieSetzen}
                  marker={marker}
                  kompakteBeschriftung
                />
              </div>
              <div className="mt-3">
                <ReplayControls
                  laufend={laufend}
                  geschwindigkeit={geschwindigkeit}
                  fertig={fertig}
                  verbleibendeBars={replay.kerzen.length - 1 - cursor}
                  onLaufend={setLaufend}
                  onGeschwindigkeit={setGeschwindigkeit}
                  onStep={() => setCursor((c) => Math.min(replay.kerzen.length - 1, c + 1))}
                  onSprung={() => setCursor((c) => Math.min(replay.kerzen.length - 1, c + 10))}
                >
                  <span className="text-[11px] text-gedimmt">Kerze {cursor - replay.startIndex + 1} von {replay.kerzen.length - replay.startIndex}</span>
                </ReplayControls>
              </div>

              {schritt === 'replay' && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gedimmt">Setup:</span>
                    {SETUPS.map((s) => (
                      <button key={s.id} type="button" className={chip(setupId === s.id)} onClick={() => setSetupId(s.id)}>
                        {s.text}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div role="radiogroup" aria-label="Richtung" className="inline-flex rounded-lg bg-nacht p-0.5">
                      {(['long', 'short'] as Richtung[]).map((r) => (
                        <button key={r} type="button" role="radio" aria-checked={tradeRichtung === r} onClick={() => richtungSetzen(r)} className={`tipp rounded-md px-3 py-1 text-xs font-semibold ${tradeRichtung === r ? (r === 'long' ? 'bg-long text-nacht' : 'bg-short text-white') : 'text-gedimmt hover:text-schrift'}`}>
                          {r === 'long' ? 'Long' : 'Short'}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={tradeVorbereiten} className={KNOPF}>
                      <Target className="h-3.5 w-3.5" /> {linien ? 'Linien neu setzen' : 'Trade vorbereiten'}
                    </button>
                    <button type="button" onClick={() => linien && entscheiden({ typ: 'trade', trade: linien, index: cursor, setupId })} className={KNOPF_AKZENT} disabled={!linien}>
                      Trade setzen
                    </button>
                    <button type="button" onClick={() => entscheiden({ typ: 'kein-trade', index: cursor })} className={KNOPF}>
                      <Ban className="h-3.5 w-3.5" /> Kein Trade
                    </button>
                  </div>
                  {linien && (
                    <p className="text-[11px] text-gedimmt">
                      Einstieg {fmtKurs(linien.entry, runde.waehrung)} · Stop <span className="text-short">{fmtKurs(linien.stop, runde.waehrung)}</span> · Ziel <span className="text-long">{fmtKurs(linien.ziel, runde.waehrung)}</span> · CRV{' '}
                      <span className={crvAktuell >= 1.5 ? 'text-long' : 'text-short'}>{crvAktuell.toFixed(2).replace('.', ',')} : 1</span> – Linien im Chart ziehbar.
                    </p>
                  )}
                </div>
              )}
              {schritt === 'replayLaeuftAus' && <p className="mt-3 text-xs text-gedimmt">Entscheidung gesetzt – der Chart läuft bis zum Ende durch …</p>}

              {schritt === 'replayAufgeloest' && bewertung && (
                <div className="mt-3 space-y-3 text-sm">
                  <div className={`rounded-lg border p-3 ${BEWERTUNG_FARBE[bewertung.bewertung] === 'text-long' ? 'border-long/40 bg-long/10' : BEWERTUNG_FARBE[bewertung.bewertung] === 'text-akzent' ? 'border-akzent/40 bg-akzent/10' : 'border-short/40 bg-short/10'}`}>
                    <p className={`font-semibold ${BEWERTUNG_FARBE[bewertung.bewertung]}`}>
                      {entscheidung?.typ === 'trade' ? `Trade (${SETUPS.find((s) => s.id === entscheidung.setupId)?.text ?? ''}, ${entscheidung.trade.richtung === 'long' ? 'Long' : 'Short'}): ` : 'Kein Trade: '}
                      {bewertung.bewertung}
                    </p>
                    <p className="mt-1 text-schrift">{bewertung.text}</p>
                  </div>
                  {bewertung.kriterien.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {bewertung.kriterien.map((k) => (
                        <li key={k.id} className="flex items-start gap-2">
                          {k.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-long" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-short" />}
                          <span>
                            <span className="font-semibold text-white">{k.titel}:</span> <span className="text-schrift">{k.text}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {simulation && (
                    <p className="text-xs text-gedimmt">
                      Ausgang:{' '}
                      {simulation.ausgang === 'nicht gefüllt'
                        ? 'Order wurde nie gefüllt.'
                        : `${simulation.ausgang === 'ziel' ? 'Ziel erreicht' : simulation.ausgang === 'stop' ? 'Stop' : 'am Ende noch offen'}, ${simulation.r === null ? '' : fmtR(simulation.r)}`}{' '}
                      – das Ergebnis ist Statistik, bewertet wird der Prozess.
                    </p>
                  )}
                  {coach ? (
                    <PruefungKarte p={coach} kontext="KI-Coach zur Übung" />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void coachFragen()} className={KNOPF} disabled={!mitWorker || coachLaeuft}>
                        {coachLaeuft ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} KI-Coach fragen
                      </button>
                      {!mitWorker && <span className="text-[11px] text-gedimmt">Kein Worker eingetragen (Aktien → Einstellungen).</span>}
                      {coachFehler && <span className="text-xs text-short">{coachFehler}</span>}
                    </div>
                  )}
                  <button type="button" onClick={() => void starten()} className={KNOPF_AKZENT}>
                    <RotateCcw className="h-3.5 w-3.5" /> Nächste Runde
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
