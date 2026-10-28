import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Bell, BellOff, ChevronDown, ChevronUp, Cloud, CloudOff, LoaderCircle, RefreshCw, Settings2, TriangleAlert } from 'lucide-react'
import { ChartPanel } from '../../components/chart/ChartPanel'
import type { ChartAnnotation } from '../../types'
import { useTracker, TRACKER_VERALTET_AB_MS } from '../useTracker'
import { useTrackerStore } from '../store'
import { EBENEN, INSTRUMENTE, INSTRUMENT_NACH_ID, MUSTER, MUSTER_NACH_ID } from '../engine/katalog'
import { kerzenAusKompakt } from '../engine/analyse'
import type { Ebene, EbeneDaten, InstrumentDaten, MusterId, Signal } from '../types'
import { fmtDatumKurz, fmtKurs, fmtProzentVz, fmtStand, richtungFarbe, richtungText } from '../format'
import { aktuellerKurs, useLiveKurse, vortagesSchluss, type LiveKurs } from '../liveKurse'
import { workerKonfiguriert } from '../../aktien/data/client'

// Markt-Tracker: Instrumente laut Konfiguration, je Instrument Kurs, Lage, Chart mit Marken
// und die Signale der letzten Wochen. Einstellungen (Instrumente, Muster, Push) gehen
// in den Worker-KV; die Action liest sie beim nächsten Lauf.

/** Zeitraum-Chips je Ebene: Tagesebene in Kalenderzeit, Stundenebene in Kerzen (Börsen haben ~7 Kerzen je Handelstag, Krypto 24) */
const BEREICHE: Record<Ebene, { id: string; kerzen: number; titel?: string }[]> = {
  tag: [
    { id: '3M', kerzen: 66 },
    { id: '6M', kerzen: 130 },
    { id: '1J', kerzen: 252 },
    { id: '2J', kerzen: 520 },
  ],
  stunde: [
    { id: '50 K', kerzen: 50, titel: '50 Stundenkerzen' },
    { id: '120 K', kerzen: 120, titel: '120 Stundenkerzen' },
    { id: '250 K', kerzen: 250, titel: '250 Stundenkerzen' },
    { id: 'Alle', kerzen: 400, titel: 'alle gespeicherten Stundenkerzen' },
  ],
}
const STANDARD_BEREICH: Record<Ebene, string> = { tag: '1J', stunde: '120 K' }
const CHART_HOEHE = 220

function ebeneDaten(inst: InstrumentDaten, ebene: Ebene): EbeneDaten | null {
  if (ebene === 'stunde') return inst.stunde ?? null
  return { quelle: inst.quelle, kerzen: inst.kerzen, analyse: inst.analyse, signale: inst.signale, fehler: inst.fehler }
}
const FARBE_LEVEL = '#8B95A5'
const FARBE_TUNNEL = '#A855F7'

const chip = (aktiv: boolean) =>
  `rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'}`

function signalZeitText(s: Signal): string {
  if (s.ebene === 'stunde' && s.kerzeZeit) return `${fmtDatumKurz(s.datum)} ${fmtStand(s.kerzeZeit).slice(-5)}`
  return fmtDatumKurz(s.datum)
}

function SignalZeile({ s, dezimalen, waehrung }: { s: Signal; dezimalen: number; waehrung: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-xs">
      <span className="tabular-nums text-gedimmt">{signalZeitText(s)}</span>
      <span className={`font-semibold ${richtungFarbe(s.richtung)}`}>{s.titel}</span>
      {s.vorlaeufig && (
        <span className="rounded bg-nacht px-1 py-0.5 text-[10px] uppercase tracking-wide text-gedimmt" title="Kerze war beim Lauf noch offen">
          vorläufig
        </span>
      )}
      <span className="basis-full text-gedimmt sm:basis-auto">
        {s.text} <span className="tabular-nums">({fmtKurs(s.preis, dezimalen, waehrung)})</span>
      </span>
    </li>
  )
}

function InstrumentKarte({ inst, jetzt, live, ebene, onEbene }: { inst: InstrumentDaten; jetzt: number; live?: LiveKurs; ebene: Ebene; onEbene: (e: Ebene) => void }) {
  const [offen, setOffen] = useState(true)
  const [bereiche, setBereiche] = useState<Record<Ebene, string>>({ ...STANDARD_BEREICH })
  const bereich = bereiche[ebene]
  const daten = ebeneDaten(inst, ebene)
  const tagesKerzen = useMemo(() => kerzenAusKompakt(inst.kerzen), [inst.kerzen])
  const alleKerzen = useMemo(() => (ebene === 'tag' ? tagesKerzen : kerzenAusKompakt(daten?.kerzen ?? [])), [ebene, tagesKerzen, daten?.kerzen])
  const kerzen = useMemo(
    () => alleKerzen.slice(-(BEREICHE[ebene].find((b) => b.id === bereich)?.kerzen ?? 252)),
    [alleKerzen, bereich, ebene],
  )
  const a = daten?.analyse ?? null
  const einheit = ebene === 'tag' ? '20T' : '20h'
  // Kurs: Live vom Worker, wenn neuer als der Stand der Action (Tagesveränderung immer gegen den Vortagesschluss)
  const kurs = aktuellerKurs(a ?? inst.analyse, live)
  const vortag = kurs ? vortagesSchluss(tagesKerzen, kurs.zeitMs) : null
  const aenderung = kurs && vortag ? kurs.preis / vortag - 1 : (inst.analyse?.aenderungTag ?? 0)
  const preis = kurs?.preis ?? a?.kurs ?? 0
  const annotationen = useMemo((): ChartAnnotation[] => {
    if (!a || !daten) return []
    const liste: ChartAnnotation[] = [
      { typ: 'preislinie', preis: a.hoch20, text: `${einheit}-Hoch`, farbe: FARBE_LEVEL },
      { typ: 'preislinie', preis: a.tief20, text: `${einheit}-Tief`, farbe: FARBE_LEVEL },
    ]
    if (a.tunnel) {
      liste.push({ typ: 'preislinie', preis: a.tunnel.hoch, text: 'Tunnel', farbe: FARBE_TUNNEL })
      liste.push({ typ: 'preislinie', preis: a.tunnel.tief, text: 'Tunnel', farbe: FARBE_TUNNEL })
    }
    const zeiten = new Set(kerzen.map((k) => k.time))
    for (const s of daten.signale) {
      const time = Math.floor(Date.parse(s.kerzeZeit ?? s.datum) / 1000)
      if (!zeiten.has(time)) continue
      liste.push({
        typ: 'marker',
        time,
        position: s.richtung === 'long' ? 'belowBar' : 'aboveBar',
        form: s.richtung === 'long' ? 'arrowUp' : s.richtung === 'short' ? 'arrowDown' : 'circle',
        text: MUSTER_NACH_ID[s.muster]?.name.split(' ')[0] ?? s.muster,
        farbe: s.richtung === 'long' ? '#22C55E' : s.richtung === 'short' ? '#EF4444' : '#F59E0B',
      })
    }
    return liste
  }, [a, daten, kerzen, einheit])

  const veraltet = kurs ? jetzt - kurs.zeitMs > TRACKER_VERALTET_AB_MS * 2 : false
  const trendText = a ? (a.trend === 'auf' ? 'Aufwärtstrend' : a.trend === 'ab' ? 'Abwärtstrend' : 'seitwärts') : ''
  const trendFarbe = a ? (a.trend === 'auf' ? 'text-long' : a.trend === 'ab' ? 'text-short' : 'text-gedimmt') : ''

  return (
    <section className="rounded-xl border border-rand bg-flaeche p-4">
      <button type="button" onClick={() => setOffen((o) => !o)} className="flex w-full items-start justify-between gap-3 text-left">
        <div>
          <h2 className="text-base font-bold text-white">{inst.name}</h2>
          <p className="text-[11px] text-gedimmt">
            {inst.symbol} · {(daten?.quelle ?? inst.quelle) === 'alt' ? 'alter Stand' : (daten?.quelle ?? inst.quelle)}
            {kurs && ` · Kurs ${fmtStand(new Date(kurs.zeitMs).toISOString())} Uhr${kurs.live ? ' (live)' : ''}`}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {kurs ? (
            <div className="text-right">
              <div className="tabular-nums text-lg font-bold text-white">{fmtKurs(preis, inst.dezimalen, inst.waehrung)}</div>
              <div className={`tabular-nums text-xs font-semibold ${aenderung > 0 ? 'text-long' : aenderung < 0 ? 'text-short' : 'text-gedimmt'}`}>
                {fmtProzentVz(aenderung)} heute
              </div>
            </div>
          ) : (
            <span className="text-xs text-short">{daten?.fehler ?? inst.fehler ?? 'keine Analyse'}</span>
          )}
          {offen ? <ChevronUp className="mt-1 h-4 w-4 text-gedimmt" /> : <ChevronDown className="mt-1 h-4 w-4 text-gedimmt" />}
        </div>
      </button>

      {/* Ebene: Tageskerzen (Swing) oder Stundenkerzen (Intraday) */}
      <div className="mt-2 flex items-center gap-1" role="tablist" aria-label="Zeitebene">
        {EBENEN.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={e.id === ebene}
            onClick={() => onEbene(e.id)}
            disabled={e.id === 'stunde' && !inst.stunde}
            title={e.id === 'stunde' && !inst.stunde ? 'Stundenkerzen kommen mit dem nächsten Lauf der Action' : e.name}
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold disabled:opacity-40 ${e.id === ebene ? 'bg-flaeche text-white ring-1 ring-rand' : 'bg-nacht text-gedimmt hover:text-schrift'}`}
          >
            {e.name}
          </button>
        ))}
        {ebene === 'stunde' && daten?.signale.length ? <span className="ml-1 text-[11px] text-gedimmt">{daten.signale.length} Signale</span> : null}
      </div>

      {a && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className={`font-semibold ${trendFarbe}`}>{trendText}</span>
          {a.tunnel && (
            <span className="text-purple-400">
              Tunnel {fmtKurs(a.tunnel.tief, inst.dezimalen, inst.waehrung)} – {fmtKurs(a.tunnel.hoch, inst.dezimalen, inst.waehrung)} seit {a.tunnel.seitTagen} {ebene === 'tag' ? 'Tagen' : 'Stunden'}
              {a.tunnel.lage !== 'mitte' && ` · am ${a.tunnel.lage === 'oben' ? 'oberen' : 'unteren'} Rand`}
            </span>
          )}
          <span className="text-gedimmt">
            {einheit}-Hoch {fmtKurs(a.hoch20, inst.dezimalen, inst.waehrung)} ({fmtProzentVz(a.hoch20 / preis - 1)})
          </span>
          <span className="text-gedimmt">
            {einheit}-Tief {fmtKurs(a.tief20, inst.dezimalen, inst.waehrung)} ({fmtProzentVz(a.tief20 / preis - 1)})
          </span>
          {a.rsi14 !== null && (
            <span className={a.rsi14 > 70 ? 'text-short' : a.rsi14 < 30 ? 'text-long' : 'text-gedimmt'}>RSI {a.rsi14.toFixed(0)}</span>
          )}
          {a.vorlaeufig && <span className="text-gedimmt">{ebene === 'tag' ? 'Tageskerze' : 'Stundenkerze'} offen</span>}
          {veraltet && (
            <span className="inline-flex items-center gap-1 text-akzent">
              <TriangleAlert className="h-3 w-3" /> Kurs alt
            </span>
          )}
        </div>
      )}

      {offen && kerzen.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex justify-end gap-1" role="tablist" aria-label="Zeitraum">
            {BEREICHE[ebene].map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={b.id === bereich}
                title={b.titel}
                onClick={() => setBereiche((alt) => ({ ...alt, [ebene]: b.id }))}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${b.id === bereich ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'}`}
              >
                {b.id}
              </button>
            ))}
          </div>
          <ChartPanel candles={kerzen} annotationen={annotationen} hoehe={CHART_HOEHE} zeigeVolumen={false} emaPerioden={[20, 50]} zeitSichtbar={ebene === 'stunde'} randRechts={2} />
        </div>
      )}

      {offen && daten && (
        <div className="mt-2">
          {daten.signale.length === 0 ? (
            <p className="text-xs text-gedimmt">Keine Signale in den letzten 30 Tagen.</p>
          ) : (
            <ul className="divide-y divide-rand">
              {daten.signale.slice(0, 8).map((s) => (
                <SignalZeile key={s.id} s={s} dezimalen={inst.dezimalen} waehrung={inst.waehrung} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

export function TrackerPage() {
  const { daten, status, fehler, ausCache, jetzt, neuLaden } = useTracker()
  const config = useTrackerStore((s) => s.config)
  const sync = useTrackerStore((s) => s.sync)
  const syncFehler = useTrackerStore((s) => s.syncFehler)
  const instrumentUmschalten = useTrackerStore((s) => s.instrumentUmschalten)
  const musterUmschalten = useTrackerStore((s) => s.musterUmschalten)
  const pushSetzen = useTrackerStore((s) => s.pushSetzen)
  const abgleichen = useTrackerStore((s) => s.abgleichen)
  const [einstellungenOffen, setEinstellungenOffen] = useState(false)
  const [frischSignal, setFrischSignal] = useState(0)
  // Eine Ebene für alle Karten – wer die Intraday-Sicht will, will sie überall
  const [ebene, setEbene] = useState<Ebene>('tag')
  const musterUmschaltenStunde = useTrackerStore((s) => s.musterUmschaltenStunde)
  const pushStundeSetzen = useTrackerStore((s) => s.pushStundeSetzen)
  const symbole = useMemo(() => (daten ? daten.instrumente.map((i) => i.symbol) : []), [daten])
  const liveKurse = useLiveKurse(symbole, frischSignal)
  const mitWorker = workerKonfiguriert()

  useEffect(() => {
    abgleichen()
  }, [abgleichen])

  const alles = () => {
    neuLaden()
    setFrischSignal((n) => n + 1)
  }

  const veraltet = daten ? jetzt - Date.parse(daten.lastUpdated) > TRACKER_VERALTET_AB_MS : false
  // Vom Lauf abweichende Konfiguration: Änderungen greifen erst beim nächsten Lauf der Action
  const wartend = daten
    ? config.instrumente.filter((id) => !daten.instrumente.some((i) => i.id === id)).map((id) => INSTRUMENT_NACH_ID[id]?.name ?? id)
    : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            <Activity className="h-6 w-6 text-akzent" /> Markt-Tracker
          </h1>
          <p className="mt-1 text-gedimmt">
            Tageskerzen der großen Märkte, charttechnisch ausgewertet: Breakouts, Tunnel, EMA-Kreuzungen, RSI, Lehrbuch-Setups. Mit Push bei neuen Signalen.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEinstellungenOffen((o) => !o)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${einstellungenOffen ? 'bg-akzent text-nacht' : 'bg-flaeche text-schrift hover:text-white'}`}>
            <Settings2 className="h-3.5 w-3.5" /> Einstellungen
          </button>
          <button onClick={alles} className="inline-flex items-center gap-1.5 rounded-lg bg-flaeche px-3 py-1.5 text-xs font-semibold text-schrift hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </button>
        </div>
      </div>

      {einstellungenOffen && (
        <section className="mt-5 rounded-xl border border-rand bg-flaeche p-4">
          <h2 className="text-sm font-bold text-white">Instrumente</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INSTRUMENTE.map((i) => (
              <button key={i.id} type="button" onClick={() => instrumentUmschalten(i.id)} className={chip(config.instrumente.includes(i.id))}>
                {i.name}
              </button>
            ))}
          </div>

          <h2 className="mt-4 text-sm font-bold text-white">Muster</h2>
          <p className="mt-0.5 text-[11px] text-gedimmt">Je Ebene getrennt: Tageskerzen (Swing) und Stundenkerzen (Intraday). Gleiche Regeln, Fenster in Tagen bzw. Stunden.</p>
          <ul className="mt-2 space-y-1.5">
            {MUSTER.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-2">
                <div className="flex shrink-0 gap-1">
                  {(['tag', 'stunde'] as Ebene[]).map((e) => {
                    const an = e === 'tag' ? config.muster[m.id] : config.musterStunde[m.id]
                    return (
                      <button
                        key={e}
                        type="button"
                        onClick={() => (e === 'tag' ? musterUmschalten(m.id) : musterUmschaltenStunde(m.id as MusterId))}
                        className={`${chip(an)} w-12 text-center`}
                        title={`${m.name} auf ${e === 'tag' ? 'Tageskerzen' : 'Stundenkerzen'} ${an ? 'aus' : 'an'}schalten`}
                      >
                        {e === 'tag' ? 'Tag' : '1h'}
                      </button>
                    )
                  })}
                </div>
                <span className="pt-1.5 text-xs text-schrift">
                  <span className="font-semibold text-white">{m.name}</span> <span className="text-gedimmt">{m.beschreibung}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rand pt-3">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => pushSetzen(!config.push)} className={`inline-flex items-center gap-1.5 ${chip(config.push)}`}>
                {config.push ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />} Push Tag {config.push ? 'an' : 'aus'}
              </button>
              <button type="button" onClick={() => pushStundeSetzen(!config.pushStunde)} className={`inline-flex items-center gap-1.5 ${chip(config.pushStunde)}`}>
                {config.pushStunde ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />} Push 1h {config.pushStunde ? 'an' : 'aus'}
              </button>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gedimmt">
              {sync === 'synchron' && (
                <>
                  <Cloud className="h-3.5 w-3.5 text-long" /> Mit dem Worker abgeglichen
                </>
              )}
              {sync === 'laedt' && (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Abgleich …
                </>
              )}
              {sync === 'kein-worker' && (
                <>
                  <CloudOff className="h-3.5 w-3.5" /> Kein Worker eingetragen (<Link to="/aktien" className="text-akzent underline">Aktien → Einstellungen</Link>) – Action nutzt die Datei im Repo
                </>
              )}
              {sync === 'fehler' && (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-short" /> Abgleich fehlgeschlagen: {syncFehler}
                </>
              )}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-gedimmt">
            Push-Zustellung braucht die Einrichtung unter <Link to="/makro" className="text-akzent underline">Zinsentscheidungen → Benachrichtigungen</Link>. Änderungen hier gelten ab dem nächsten Lauf der Action (werktags stündlich).
          </p>
        </section>
      )}

      {status === 'laedt' && <p className="mt-6 text-sm text-gedimmt">Lade Tracker-Daten …</p>}
      {status === 'fehler' && (
        <div className="mt-6 rounded-xl border border-rand bg-flaeche p-4 text-sm text-gedimmt">
          <p className="inline-flex items-center gap-1.5">
            <TriangleAlert className="h-4 w-4 text-akzent" /> Tracker-Daten nicht verfügbar{fehler ? ` (${fehler})` : ''}.
          </p>
          <p className="mt-1">Die Datei entsteht beim ersten Lauf der GitHub Action „Markt-Tracker“.</p>
        </div>
      )}

      {daten && (
        <>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 text-[11px] text-gedimmt">
            <span>Stand: {fmtStand(daten.lastUpdated)} Uhr</span>
            <span>· Konfiguration des Laufs: {daten.configQuelle === 'worker' ? 'Worker' : daten.configQuelle === 'datei' ? 'Datei im Repo' : 'Standard'}</span>
            <span>· Kurse: {mitWorker ? 'live über den Worker (alle 5 Min)' : 'vom letzten Lauf – Worker unter Aktien eintragen für Live-Kurse'}</span>
            {veraltet && (
              <span className="inline-flex items-center gap-1 text-akzent">
                <TriangleAlert className="h-3 w-3" /> älter als 26 Stunden
              </span>
            )}
            {ausCache && <span>(aus dem Gerätespeicher)</span>}
          </p>
          {wartend.length > 0 && (
            <p className="mt-2 text-xs text-gedimmt">Erscheint nach dem nächsten Lauf: {wartend.join(', ')}.</p>
          )}
          <div className="mt-4 space-y-4">
            {config.instrumente
              .map((id) => daten.instrumente.find((i) => i.id === id))
              .filter((i): i is InstrumentDaten => Boolean(i))
              .map((inst) => (
                <InstrumentKarte key={inst.id} inst={inst} jetzt={jetzt} live={liveKurse[inst.symbol]} ebene={ebene} onEbene={setEbene} />
              ))}
            {daten.instrumente.filter((i) => !config.instrumente.includes(i.id)).length > 0 && (
              <p className="text-xs text-gedimmt">
                Im letzten Lauf noch dabei, hier abgewählt: {daten.instrumente.filter((i) => !config.instrumente.includes(i.id)).map((i) => i.name).join(', ')}.
              </p>
            )}
          </div>
          <p className="mt-6 text-[11px] text-gedimmt">
            Signale werden auf Tages- und Stundenkerzen berechnet (Action alle 15 Minuten, Stunden-Signale können daher bis zu ~30 Minuten alt sein); Signale der laufenden Kerze sind „vorläufig“ (Richtung {richtungText('long')}/{richtungText('short')} aus Sicht des Musters). Quelle Yahoo Finance (inoffiziell), Krypto notfalls Coinbase. Keine Anlageberatung.
          </p>
        </>
      )}
    </div>
  )
}
