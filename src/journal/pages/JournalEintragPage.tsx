import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle, Pencil, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { useJournalStore } from '../store'
import { useAnsichtStore } from '../../analyse/ansichtStore'
import { ergebnis, geplantesCrv, ortszeitAusUnix, rMultiple, setupName, trefferZeit, unixAusOrtszeit, zahlAlsText, zahlAusText, zeitKurz, type EintragEntwurf } from '../engine'
import { GEFUEHLE, type AusstiegGrund, type JournalEintrag, type Pruefung, type Snapshot } from '../types'
import { snapshotEntfernen, snapshotLaden, snapshotLesen, type SnapshotErgebnis } from '../snapshots'
import { faktenSammeln } from '../fakten'
import { tradePruefen } from '../pruefung'
import { workerKonfiguriert } from '../../aktien/data/client'
import { EintragForm } from '../EintragForm'
import { chip } from '../ui'
import { HandelsChart, type ChartLinie, type ChartMarker } from '../../components/chart/HandelsChart'
import type { Candle } from '../../types'
import { EINGABE, KNOPF, KNOPF_AKZENT } from '../../aktien/components/ui'
import { fmtKurs } from '../../aktien/engine/format'
import { fmtR } from '../../engine/format'
import { useSchmal } from '../../hooks/useSchmal'

// Detailseite eines echten Trades: Chart aus dem Snapshot mit Einstieg/Stop/Ziel, alle Felder,
// Abschließen (Ausstieg, Ergebnis vom Broker, Lehre), Bearbeiten, Löschen.

const INDIKATOREN = { ema: [20, 50], rsi: false, volumen: false }
const GRUENDE: { id: AusstiegGrund; text: string }[] = [
  { id: 'ziel', text: 'Ziel erreicht' },
  { id: 'stop', text: 'Stop' },
  { id: 'manuell', text: 'Manuell' },
]

function zahl(text: string): number | undefined {
  return zahlAusText(text) ?? undefined
}

const URTEIL_FARBE: Record<Pruefung['urteil'], string> = { sauber: 'bg-long/15 text-long', 'mit Abstrichen': 'bg-akzent/15 text-akzent', herbeigesehnt: 'bg-short/15 text-short' }

function PruefungKarte({ p }: { p: Pruefung }) {
  return (
    <div className="rounded-xl border border-rand bg-nacht/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${URTEIL_FARBE[p.urteil]}`}>{p.urteil}</span>
        <span className="text-[11px] text-gedimmt">
          {p.mitErgebnis ? 'mit Ergebnis' : 'Vorher-Blick, ohne Ergebnis'} · {zeitKurz(Math.floor(p.erstelltAm / 1000))}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-gedimmt">Setup</dt>
          <dd className="text-white">{p.setupVorhanden}</dd>
        </div>
        <div>
          <dt className="text-gedimmt">Einstieg</dt>
          <dd className="text-white">{p.einstieg}</dd>
        </div>
        <div>
          <dt className="text-gedimmt">Stop</dt>
          <dd className="text-white">{p.stop}</dd>
        </div>
      </dl>
      <p className="mt-2 whitespace-pre-wrap text-sm text-schrift">{p.text}</p>
      {p.naechstesMal.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-schrift">
          {p.naechstesMal.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Fakt({ titel, wert, farbe }: { titel: string; wert: string; farbe?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-gedimmt">{titel}</dt>
      <dd className={`tabular-nums text-sm ${farbe ?? 'text-white'}`}>{wert}</dd>
    </div>
  )
}

function Abschluss({ e, kerzen, onFertig }: { e: JournalEintrag; kerzen?: Candle[]; onFertig: (teil: Partial<JournalEintrag>) => void }) {
  const [exitPreis, setExitPreis] = useState('')
  const [exitZeit, setExitZeit] = useState(() => ortszeitAusUnix(Math.floor(Date.now() / 1000)))
  const [zeitQuelle, setZeitQuelle] = useState<'jetzt' | 'kerzen' | 'offen' | 'keine'>('jetzt')
  const [grund, setGrund] = useState<AusstiegGrund>('manuell')
  const [betrag, setBetrag] = useState('')
  const [gebuehren, setGebuehren] = useState('')
  const [gefuehl, setGefuehl] = useState('')
  const [lehre, setLehre] = useState('')
  const [imPlan, setImPlan] = useState<boolean | null>(e.imPlan)
  const [fehler, setFehler] = useState('')
  const preis = zahl(exitPreis)
  const r = preis ? rMultiple({ ...e, exitPreis: preis }) : null

  // Schnellwahl: Stop oder Ziel getroffen → Preis übernehmen und die Zeit aus den Kerzen holen
  // (die Kerze, die den Preis zuerst berührt hat – nicht „jetzt“, sonst sitzt der Marker am Chartende)
  function grundSetzen(g: AusstiegGrund) {
    setGrund(g)
    if (g === 'manuell') return
    const preis = g === 'stop' ? e.stopLoss : e.takeProfit
    if (!(preis > 0)) return
    setExitPreis(zahlAlsText(preis))
    const zeit = kerzen ? trefferZeit(kerzen, e.entryTime, e.richtung, preis, g) : null
    if (zeit !== null) {
      setExitZeit(ortszeitAusUnix(zeit))
      setZeitQuelle('kerzen')
    } else {
      setZeitQuelle(kerzen ? 'offen' : 'keine')
    }
  }

  function fertig() {
    const zeit = unixAusOrtszeit(exitZeit)
    if (!preis || preis <= 0) return setFehler('Ausstiegspreis fehlt.')
    if (!zeit) return setFehler('Ausstiegszeit fehlt.')
    if (zeit < e.entryTime) return setFehler('Der Ausstieg liegt vor dem Einstieg.')
    setFehler('')
    onFertig({
      status: 'geschlossen',
      exitPreis: preis,
      exitTime: zeit,
      exitGrund: grund,
      ergebnisBetrag: zahl(betrag),
      gebuehren: zahl(gebuehren),
      gefuehlNachher: gefuehl || undefined,
      lehre: lehre.trim() || undefined,
      imPlan,
    })
  }

  const feld = 'text-[11px] text-gedimmt'
  const eingabe = `mt-1 ${EINGABE} tipp`
  return (
    <section className="rounded-xl border border-akzent/40 bg-flaeche p-4">
      <h2 className="text-sm font-semibold text-white">Trade abschließen</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {GRUENDE.map((g) => (
          <button key={g.id} type="button" className={chip(grund === g.id)} onClick={() => grundSetzen(g.id)}>
            {g.text}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className={feld}>
          Ausstieg
          <input className={eingabe} inputMode="decimal" value={exitPreis} onChange={(ev) => setExitPreis(ev.target.value)} aria-label="Ausstieg" />
        </label>
        <label className={feld}>
          Ausstieg am
          <input
            className={eingabe}
            type="datetime-local"
            value={exitZeit}
            onChange={(ev) => {
              setExitZeit(ev.target.value)
              setZeitQuelle('jetzt')
            }}
            aria-label="Ausstieg am"
          />
          {zeitQuelle === 'kerzen' && <span className="mt-0.5 block text-[10px] text-long">aus den Kerzen: erste Berührung von {grund === 'stop' ? 'Stop' : 'Ziel'}</span>}
          {zeitQuelle === 'offen' && <span className="mt-0.5 block text-[10px] text-akzent">Kerzen berühren den Preis noch nicht – Zeit bitte prüfen</span>}
          {zeitQuelle === 'keine' && <span className="mt-0.5 block text-[10px] text-akzent">keine Kerzen gespeichert – Zeit bitte prüfen</span>}
        </label>
        <label className={feld}>
          Ergebnis laut Broker ({e.waehrung})
          <input className={eingabe} inputMode="decimal" value={betrag} onChange={(ev) => setBetrag(ev.target.value)} placeholder="netto, z.B. -42,5" aria-label="Ergebnis" />
        </label>
        <label className={feld}>
          Gebühren / Overnight
          <input className={eingabe} inputMode="decimal" value={gebuehren} onChange={(ev) => setGebuehren(ev.target.value)} aria-label="Gebühren" />
        </label>
      </div>
      {r !== null && (
        <p className="mt-2 text-xs text-gedimmt">
          Ergibt <span className={`font-semibold ${r > 0 ? 'text-long' : r < 0 ? 'text-short' : 'text-white'}`}>{fmtR(r)}</span> aus den Preisen.
        </p>
      )}
      {e.imPlan === null && (
        <div className="mt-3">
          <div className={feld}>War der Trade im Plan?</div>
          <div className="mt-1 flex gap-1.5">
            <button type="button" className={chip(imPlan === true)} onClick={() => setImPlan(true)}>
              Ja
            </button>
            <button type="button" className={chip(imPlan === false)} onClick={() => setImPlan(false)}>
              Nein
            </button>
          </div>
        </div>
      )}
      <div className="mt-3">
        <div className={feld}>Gefühl danach</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {GEFUEHLE.map((g) => (
            <button key={g} type="button" className={chip(gefuehl === g)} onClick={() => setGefuehl(gefuehl === g ? '' : g)}>
              {g}
            </button>
          ))}
        </div>
      </div>
      <label className={`${feld} mt-3 block`}>
        Was lerne ich daraus?
        <textarea className={`${eingabe} min-h-20`} value={lehre} onChange={(ev) => setLehre(ev.target.value)} />
      </label>
      {fehler && <p className="mt-2 text-xs text-short">{fehler}</p>}
      <button type="button" onClick={fertig} className={`${KNOPF_AKZENT} mt-3`}>
        Abschließen
      </button>
    </section>
  )
}

export function JournalEintragPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const schmal = useSchmal()
  const e = useJournalStore((s) => s.eintraege.find((x) => x.id === id))
  const aendern = useJournalStore((s) => s.aendern)
  const loeschen = useJournalStore((s) => s.loeschen)
  const konto = useAnsichtStore((s) => s.konto)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [snapshotStatus, setSnapshotStatus] = useState<'laedt' | 'ok' | 'keiner' | 'kein-worker' | 'zu-alt' | 'fehler'>('laedt')
  const [bearbeiten, setBearbeiten] = useState(false)
  const [loeschenFragen, setLoeschenFragen] = useState(false)
  const alleEintraege = useJournalStore((s) => s.eintraege)
  const [pruefLaeuft, setPruefLaeuft] = useState<false | 'vorher' | 'nachher'>(false)
  const [pruefFehler, setPruefFehler] = useState<string | null>(null)
  const mitWorker = workerKonfiguriert()

  async function kerzenHolen(eintrag: JournalEintrag) {
    setSnapshotStatus('laedt')
    const r: SnapshotErgebnis = await snapshotLaden(eintrag)
    if (r.art === 'ok') {
      setSnapshot(r.snapshot)
      setSnapshotStatus('ok')
    } else {
      setSnapshotStatus(r.art)
    }
  }

  useEffect(() => {
    let aktiv = true
    if (!e) return
    void snapshotLesen(e.id).then((s) => {
      if (!aktiv) return
      if (s) {
        setSnapshot(s)
        setSnapshotStatus('ok')
      } else {
        // frisch angelegt: der Neu-Dialog hat das Laden angestoßen, kurz warten und nochmal lesen
        setTimeout(() => {
          void snapshotLesen(e.id).then((s2) => {
            if (!aktiv) return
            if (s2) {
              setSnapshot(s2)
              setSnapshotStatus('ok')
            } else setSnapshotStatus('keiner')
          })
        }, 2500)
      }
    })
    return () => {
      aktiv = false
    }
  }, [e?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const linien = useMemo((): ChartLinie[] => {
    if (!e) return []
    const l: ChartLinie[] = [
      { id: 'entry', preis: e.entryPreis, farbe: '#F59E0B', titel: 'Einstieg', fest: true, imBlick: true },
    ]
    if (e.stopLoss > 0) l.push({ id: 'stop', preis: e.stopLoss, farbe: '#EF4444', titel: 'Stop', imBlick: true })
    if (e.takeProfit > 0) l.push({ id: 'ziel', preis: e.takeProfit, farbe: '#22C55E', titel: 'Ziel', imBlick: true })
    if (e.status === 'geschlossen' && e.exitPreis) l.push({ id: 'exit', preis: e.exitPreis, farbe: '#8B95A5', titel: 'Ausstieg', stil: 'gepunktet', imBlick: true })
    return l
  }, [e])
  const marker = useMemo((): ChartMarker[] => {
    if (!e) return []
    const m: ChartMarker[] = [{ time: e.entryTime, art: e.richtung, text: 'Einstieg' }]
    // Ausstieg auf die Gegenseite des Einstiegs, sonst verdecken sich die Marker bei kurzen Trades
    if (e.status === 'geschlossen' && e.exitTime) m.push({ time: e.exitTime, art: 'exit', gewinn: (rMultiple(e) ?? 0) > 0, text: 'Ausstieg', oben: e.richtung === 'long' })
    return m
  }, [e])

  if (!e) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-gedimmt">
        Eintrag nicht gefunden.{' '}
        <Link to="/training/journal" className="text-akzent underline">
          Zum Journal
        </Link>
      </div>
    )
  }

  const r = rMultiple(e)
  const betrag = ergebnis(e)
  const crv = geplantesCrv(e)
  const kerzen = snapshot?.kerzen as Candle[] | undefined

  function speichern(entwurf: EintragEntwurf) {
    aendern(e!.id, entwurf)
    setBearbeiten(false)
    // Markt, Zeit oder Zeitrahmen geändert → Kerzen passen nicht mehr
    if (entwurf.symbol !== e!.symbol || entwurf.entryTime !== e!.entryTime || entwurf.zeitrahmen !== e!.zeitrahmen) void kerzenHolen({ ...e!, ...entwurf })
  }

  function abschliessen(teil: Partial<JournalEintrag>) {
    aendern(e!.id, teil)
    void kerzenHolen({ ...e!, ...teil })
  }

  async function pruefen(mitErgebnis: boolean) {
    setPruefLaeuft(mitErgebnis ? 'nachher' : 'vorher')
    setPruefFehler(null)
    try {
      const fakten = faktenSammeln(e!, kerzen ?? null, alleEintraege, snapshot?.intervall ?? null, mitErgebnis)
      const antwort = await tradePruefen(fakten)
      const neu: Pruefung = { ...antwort, erstelltAm: Date.now(), mitErgebnis }
      aendern(e!.id, { pruefungen: [...(e!.pruefungen ?? []), neu] })
    } catch (err) {
      setPruefFehler(err instanceof Error ? err.message : String(err))
    } finally {
      setPruefLaeuft(false)
    }
  }

  function entfernen() {
    void snapshotEntfernen(e!.id)
    loeschen(e!.id)
    navigate('/training/journal', { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      <Link to="/training/journal" className="inline-flex items-center gap-1 text-xs font-semibold text-gedimmt hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Journal
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">
          {e.markt} <span className={e.richtung === 'long' ? 'text-long' : 'text-short'}>{e.richtung === 'long' ? 'Long' : 'Short'}</span>
        </h1>
        <span className="text-sm text-gedimmt">
          {zeitKurz(e.entryTime)} · {e.zeitrahmen} · {setupName(e)}
          {e.status === 'offen' && <span className="ml-2 rounded bg-akzent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-akzent">offen</span>}
        </span>
      </div>

      <section className="mt-4 rounded-xl border border-rand bg-flaeche p-3 sm:p-4">
        {kerzen && kerzen.length > 0 ? (
          <div className="-mx-3 sm:-mx-2">
            <HandelsChart candles={kerzen} cursor={kerzen.length - 1} hoehe={schmal ? 340 : 420} linien={linien} marker={marker} indikatoren={INDIKATOREN} />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg bg-nacht text-xs text-gedimmt" style={{ height: schmal ? 200 : 260 }}>
            {snapshotStatus === 'laedt' && 'Kerzen werden geladen …'}
            {snapshotStatus === 'keiner' && 'Noch keine Kerzen gespeichert.'}
            {snapshotStatus === 'kein-worker' && 'Kein Worker eingetragen (Aktien → Einstellungen) – ohne ihn gibt es keine Kerzen.'}
            {snapshotStatus === 'zu-alt' && 'Der Einstieg liegt zu lange zurück: Yahoo liefert Intraday-Kerzen nur für wenige Tage, Tageskerzen für sechs Monate.'}
            {snapshotStatus === 'fehler' && 'Kerzen konnten nicht geladen werden.'}
          </div>
        )}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gedimmt">
          {snapshot && (
            <span>
              {snapshot.kerzen.length} Kerzen ({snapshot.intervall}), {e.symbol}, geholt {zeitKurz(Math.floor(snapshot.standAm / 1000))}
            </span>
          )}
          <button type="button" onClick={() => void kerzenHolen(e)} className="inline-flex items-center gap-1 text-akzent hover:underline" disabled={snapshotStatus === 'laedt'}>
            <RefreshCw className="h-3 w-3" /> Kerzen neu laden
          </button>
        </p>
      </section>

      {bearbeiten ? (
        <section className="mt-4 rounded-xl border border-rand bg-flaeche p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Bearbeiten</h2>
          <EintragForm vorhanden={e} kerzen={kerzen} onSpeichern={speichern} onAbbrechen={() => setBearbeiten(false)} />
        </section>
      ) : (
        <section className="mt-4 rounded-xl border border-rand bg-flaeche p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Fakt titel="Einstieg" wert={fmtKurs(e.entryPreis, e.waehrung)} />
            <Fakt titel="Stop" wert={e.stopLoss > 0 ? fmtKurs(e.stopLoss, e.waehrung) : 'kein Stop'} farbe="text-short" />
            <Fakt titel="Ziel" wert={e.takeProfit > 0 ? fmtKurs(e.takeProfit, e.waehrung) : '–'} farbe="text-long" />
            <Fakt titel="CRV geplant" wert={Number.isFinite(crv) ? `${crv.toFixed(2).replace('.', ',')} : 1` : '–'} />
            <Fakt titel="Risiko" wert={e.risikoProzent > 0 ? `${e.risikoProzent.toLocaleString('de-DE')} %${e.risikoBetrag ? ` (${fmtKurs(e.risikoBetrag, e.waehrung)})` : ''}` : 'unbekannt'} />
            {e.hebel && <Fakt titel="Hebel" wert={`${e.hebel}×`} />}
            {e.einsatz !== undefined && <Fakt titel="Einsatz (Marge)" wert={fmtKurs(e.einsatz, e.waehrung)} />}
            {e.kontrakte !== undefined && <Fakt titel="Kontrakte" wert={e.kontrakte.toLocaleString('de-DE', { maximumFractionDigits: 6 })} />}
            {e.brokerId && <Fakt titel="Broker-ID" wert={`#${e.brokerId}`} />}
            {e.status === 'geschlossen' && (
              <>
                <Fakt titel="Ausstieg" wert={`${e.exitPreis !== undefined ? fmtKurs(e.exitPreis, e.waehrung) : '–'} (${GRUENDE.find((g) => g.id === e.exitGrund)?.text ?? '–'})`} />
                <Fakt titel="Ausstieg am" wert={e.exitTime ? zeitKurz(e.exitTime) : '–'} />
                <Fakt titel="R-Multiple" wert={r === null ? (e.stopLoss > 0 ? '–' : 'ohne Stop kein R') : fmtR(r)} farbe={r === null ? undefined : r > 0 ? 'text-long' : r < 0 ? 'text-short' : undefined} />
                <Fakt titel="Ergebnis" wert={betrag === null ? '–' : `${betrag >= 0 ? '+' : ''}${fmtKurs(betrag, e.waehrung)}`} farbe={betrag === null ? undefined : betrag >= 0 ? 'text-long' : 'text-short'} />
                {e.gebuehren !== undefined && <Fakt titel="Gebühren" wert={fmtKurs(e.gebuehren, e.waehrung)} />}
              </>
            )}
            <Fakt titel="Im Plan" wert={e.imPlan === null ? 'offen' : e.imPlan ? 'ja' : 'nein'} farbe={e.imPlan === false ? 'text-short' : undefined} />
            {(e.gefuehlVorher || e.gefuehlNachher) && <Fakt titel="Gefühl vorher → nachher" wert={`${e.gefuehlVorher ?? '–'} → ${e.gefuehlNachher ?? '–'}`} />}
          </dl>
          {e.begruendung && (
            <div className="mt-3">
              <div className="text-[11px] text-gedimmt">Begründung</div>
              <p className="whitespace-pre-wrap text-sm text-schrift">{e.begruendung}</p>
            </div>
          )}
          {e.lehre && (
            <div className="mt-3">
              <div className="text-[11px] text-gedimmt">Was lerne ich daraus?</div>
              <p className="whitespace-pre-wrap text-sm text-schrift">{e.lehre}</p>
            </div>
          )}
          {!(e.stopLoss > 0) && <p className="mt-3 text-[11px] text-akzent">Ohne Stop keine R-Rechnung: Der Trade zählt in Liste und Ergebnis, aber nicht in Trefferquote und Ø R. Über „Bearbeiten“ lässt sich der Stop nachtragen, den du damals im Kopf hattest.</p>}
          {konto > 0 && e.risikoBetrag === undefined && e.stopLoss > 0 && <p className="mt-3 text-[11px] text-gedimmt">Kein Risikobetrag hinterlegt – Konto steht im CRV-Rechner des Trader-Charts.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setBearbeiten(true)} className={KNOPF}>
              <Pencil className="h-3.5 w-3.5" /> Bearbeiten
            </button>
            {loeschenFragen ? (
              <>
                <button type="button" onClick={entfernen} className="tipp rounded-lg bg-short px-3 py-1.5 text-xs font-semibold text-white">
                  Wirklich löschen
                </button>
                <button type="button" onClick={() => setLoeschenFragen(false)} className={KNOPF}>
                  Abbrechen
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setLoeschenFragen(true)} className="tipp inline-flex items-center gap-1.5 text-xs text-gedimmt hover:text-short">
                <Trash2 className="h-3.5 w-3.5" /> Löschen
              </button>
            )}
          </div>
        </section>
      )}

      {e.status === 'offen' && !bearbeiten && (
        <div className="mt-4">
          <Abschluss e={e} kerzen={kerzen} onFertig={abschliessen} />
        </div>
      )}

      {!bearbeiten && (
        <section className="mt-4 rounded-xl border border-rand bg-flaeche p-4">
          <h2 className="text-sm font-semibold text-white">KI-Prüfung</h2>
          <p className="mt-1 text-xs text-gedimmt">
            Fakten aus der Setup-Erkennung auf den gespeicherten Kerzen bis zum Einstieg (kein Blick in die Zukunft) plus deine Angaben; Claude formuliert das Urteil. Ohne Kerzen bleibt das Urteil dünn.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void pruefen(false)} className={KNOPF_AKZENT} disabled={!mitWorker || pruefLaeuft !== false}>
              {pruefLaeuft === 'vorher' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Vorher-Blick (ohne Ergebnis)
            </button>
            {e.status === 'geschlossen' && (
              <button type="button" onClick={() => void pruefen(true)} className={KNOPF} disabled={!mitWorker || pruefLaeuft !== false}>
                {pruefLaeuft === 'nachher' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Mit Ergebnis prüfen
              </button>
            )}
            {!mitWorker && <span className="text-[11px] text-gedimmt">Kein Worker eingetragen (Aktien → Einstellungen).</span>}
            {!kerzen && mitWorker && <span className="text-[11px] text-akzent">Keine Kerzen gespeichert – erst „Kerzen neu laden“.</span>}
          </div>
          {pruefFehler && <p className="mt-2 text-xs text-short">{pruefFehler}</p>}
          {(e.pruefungen ?? []).length > 0 && (
            <div className="mt-3 space-y-3">
              {[...(e.pruefungen ?? [])].reverse().map((p) => (
                <PruefungKarte key={p.erstelltAm} p={p} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
