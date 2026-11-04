import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { EINGABE, KNOPF, KNOPF_AKZENT } from '../aktien/components/ui'
import { useAnsichtStore } from '../analyse/ansichtStore'
import { crvBerechnen } from '../analyse/crv'
import { fmtKurs } from '../aktien/engine/format'
import type { Richtung } from '../types'
import { GEFUEHLE, ZEITRAHMEN, type JournalEintrag, type Zeitrahmen } from './types'
import { chip } from './ui'
import { geplantesCrv, marktListe, ortszeitAusUnix, pruefeEintrag, setupListe, SETUP_SONSTIGES, unixAusOrtszeit, type EintragEntwurf } from './engine'

// Erfassung eines echten Trades in zwei Stufen: oben das, was beim Traden in 20 Sekunden geht
// (Markt, Richtung, Preise, Setup, Zeitrahmen, Zeit, Risiko); darunter einklappbar der Rest.
// Dasselbe Formular dient zum Bearbeiten eines vorhandenen Eintrags.

interface Props {
  /** Vorbelegung (z.B. aus dem Trader-Chart) */
  start?: Partial<EintragEntwurf>
  /** Bearbeiten statt Anlegen */
  vorhanden?: JournalEintrag
  onSpeichern: (entwurf: EintragEntwurf) => void
  onAbbrechen?: () => void
}

const ANDERER_MARKT = '__anderer'

function zahl(text: string): number {
  const n = Number(text.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function EintragForm({ start, vorhanden, onSpeichern, onAbbrechen }: Props) {
  const maerkte = useMemo(() => marktListe(), [])
  const setups = useMemo(() => setupListe(), [])
  const konto = useAnsichtStore((s) => s.konto)
  const risikoStandard = useAnsichtStore((s) => s.risikoProzent)
  const basis: Partial<EintragEntwurf> = vorhanden ?? start ?? {}
  const marktStart = maerkte.find((m) => m.symbol === basis.symbol || m.name === basis.markt)

  const [marktId, setMarktId] = useState<string>(marktStart ? marktStart.id : basis.symbol ? ANDERER_MARKT : maerkte[0].id)
  const [marktName, setMarktName] = useState(basis.markt ?? '')
  const [symbol, setSymbol] = useState(basis.symbol ?? '')
  const [waehrung, setWaehrung] = useState(basis.waehrung ?? 'USD')
  const [richtung, setRichtung] = useState<Richtung>(basis.richtung ?? 'long')
  const [entry, setEntry] = useState(basis.entryPreis ? String(basis.entryPreis) : '')
  const [stop, setStop] = useState(basis.stopLoss ? String(basis.stopLoss) : '')
  const [ziel, setZiel] = useState(basis.takeProfit ? String(basis.takeProfit) : '')
  const [strategieId, setStrategieId] = useState(basis.strategieId ?? 'breakout-retest')
  const [setupFrei, setSetupFrei] = useState(basis.setupFrei ?? '')
  const [zeitrahmen, setZeitrahmen] = useState<Zeitrahmen>(basis.zeitrahmen ?? '15m')
  const [zeit, setZeit] = useState(() => ortszeitAusUnix(basis.entryTime ?? Math.floor(Date.now() / 1000)))
  const [risiko, setRisiko] = useState(String(basis.risikoProzent ?? risikoStandard))
  const [hebel, setHebel] = useState(basis.hebel ? String(basis.hebel) : '')
  const [mehr, setMehr] = useState(Boolean(vorhanden))
  const [imPlan, setImPlan] = useState<boolean | null>(basis.imPlan ?? null)
  const [gefuehl, setGefuehl] = useState(basis.gefuehlVorher ?? '')
  const [begruendung, setBegruendung] = useState(basis.begruendung ?? '')
  const [fehler, setFehler] = useState<string[]>([])

  const markt = marktId === ANDERER_MARKT ? null : maerkte.find((m) => m.id === marktId)
  const entwurf = (): EintragEntwurf => ({
    markt: markt ? markt.name : marktName.trim(),
    symbol: markt ? markt.symbol : symbol.trim().toUpperCase(),
    waehrung: markt ? markt.waehrung : waehrung.trim().toUpperCase() || 'USD',
    richtung,
    entryTime: unixAusOrtszeit(zeit) ?? 0,
    entryPreis: zahl(entry),
    stopLoss: zahl(stop),
    takeProfit: zahl(ziel),
    risikoProzent: zahl(risiko),
    risikoBetrag: konto > 0 && zahl(risiko) > 0 ? Math.round((konto * zahl(risiko)) / 100) : undefined,
    hebel: zahl(hebel) > 0 ? zahl(hebel) : undefined,
    strategieId,
    setupFrei: strategieId === SETUP_SONSTIGES ? setupFrei.trim() || undefined : undefined,
    zeitrahmen,
    imPlan,
    gefuehlVorher: gefuehl || undefined,
    begruendung: begruendung.trim() || undefined,
    // beim Bearbeiten bleiben die Abschluss-Felder erhalten
    ...(vorhanden
      ? {
          gefuehlNachher: vorhanden.gefuehlNachher,
          lehre: vorhanden.lehre,
          exitTime: vorhanden.exitTime,
          exitPreis: vorhanden.exitPreis,
          exitGrund: vorhanden.exitGrund,
          ergebnisBetrag: vorhanden.ergebnisBetrag,
          gebuehren: vorhanden.gebuehren,
          pruefung: vorhanden.pruefung,
        }
      : {}),
  })

  const vorschau = entwurf()
  const crv = geplantesCrv(vorschau)
  const rechner = vorschau.entryPreis > 0 && vorschau.stopLoss > 0 ? crvBerechnen({ richtung, entry: vorschau.entryPreis, stop: vorschau.stopLoss, ziel: vorschau.takeProfit || vorschau.entryPreis, konto, risikoProzent: vorschau.risikoProzent }) : null

  function speichern() {
    const e = entwurf()
    const f = pruefeEintrag(e)
    setFehler(f)
    if (f.length === 0) onSpeichern(e)
  }

  const feld = 'text-[11px] text-gedimmt'
  const eingabe = `mt-1 ${EINGABE} tipp`

  return (
    <div className="space-y-4">
      <div>
        <div className={feld}>Markt</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {maerkte.map((m) => (
            <button key={m.id} type="button" className={chip(marktId === m.id)} onClick={() => setMarktId(m.id)}>
              {m.name}
            </button>
          ))}
          <button type="button" className={chip(marktId === ANDERER_MARKT)} onClick={() => setMarktId(ANDERER_MARKT)}>
            Anderer …
          </button>
        </div>
        {marktId === ANDERER_MARKT && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className={feld}>
              Name
              <input className={eingabe} value={marktName} onChange={(ev) => setMarktName(ev.target.value)} placeholder="z.B. Silber" />
            </label>
            <label className={feld}>
              Yahoo-Symbol (für Kerzen)
              <input className={eingabe} value={symbol} onChange={(ev) => setSymbol(ev.target.value)} placeholder="z.B. SI=F" />
            </label>
            <label className={feld}>
              Währung
              <input className={eingabe} value={waehrung} onChange={(ev) => setWaehrung(ev.target.value)} placeholder="USD" />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className={feld}>Richtung</div>
          <div role="radiogroup" aria-label="Richtung" className="mt-1 inline-flex rounded-lg bg-nacht p-0.5">
            {(['long', 'short'] as Richtung[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={richtung === r}
                onClick={() => setRichtung(r)}
                className={`tipp rounded-md px-4 py-1.5 text-xs font-semibold ${richtung === r ? (r === 'long' ? 'bg-long text-nacht' : 'bg-short text-white') : 'text-gedimmt hover:text-schrift'}`}
              >
                {r === 'long' ? 'Long' : 'Short'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className={feld}>Zeitrahmen des Setups</div>
          <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Zeitrahmen">
            {ZEITRAHMEN.map((z) => (
              <button key={z.id} type="button" role="radio" aria-checked={zeitrahmen === z.id} className={chip(zeitrahmen === z.id)} onClick={() => setZeitrahmen(z.id)}>
                {z.text}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className={feld}>
          Einstieg
          <input className={`${eingabe} border-akzent/50`} inputMode="decimal" value={entry} onChange={(ev) => setEntry(ev.target.value)} aria-label="Einstieg" />
        </label>
        <label className={feld}>
          Stop
          <input className={`${eingabe} border-short/50`} inputMode="decimal" value={stop} onChange={(ev) => setStop(ev.target.value)} aria-label="Stop" />
        </label>
        <label className={feld}>
          Ziel <span className="text-gedimmt/70">(optional)</span>
          <input className={`${eingabe} border-long/50`} inputMode="decimal" value={ziel} onChange={(ev) => setZiel(ev.target.value)} aria-label="Ziel" />
        </label>
      </div>
      {rechner && (
        <p className="text-[11px] text-gedimmt">
          Stop-Abstand {rechner.stopProzent.toFixed(2).replace('.', ',')} %
          {Number.isFinite(crv) && (
            <>
              {' '}· CRV <span className={crv >= 2 ? 'text-long' : crv >= 1 ? 'text-white' : 'text-short'}>{crv.toFixed(2).replace('.', ',')} : 1</span>
            </>
          )}
          {konto > 0 && (
            <>
              {' '}· Risiko {fmtKurs(vorschau.risikoBetrag ?? 0, vorschau.waehrung)} bei Konto {fmtKurs(konto, vorschau.waehrung)}
            </>
          )}
        </p>
      )}

      <div>
        <div className={feld}>Setup</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {setups.map((s) => (
            <button key={s.id} type="button" className={chip(strategieId === s.id)} onClick={() => setStrategieId(s.id)} title={s.name}>
              {s.kurz}
            </button>
          ))}
        </div>
        {strategieId === SETUP_SONSTIGES && (
          <input className={eingabe} value={setupFrei} onChange={(ev) => setSetupFrei(ev.target.value)} placeholder="Setup in eigenen Worten" aria-label="Setup Freitext" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className={`${feld} col-span-2`}>
          Einstieg am
          <input className={eingabe} type="datetime-local" value={zeit} onChange={(ev) => setZeit(ev.target.value)} aria-label="Einstieg am" />
        </label>
        <label className={feld}>
          Risiko (% vom Konto)
          <input className={eingabe} inputMode="decimal" value={risiko} onChange={(ev) => setRisiko(ev.target.value)} />
        </label>
        <label className={feld}>
          Hebel <span className="text-gedimmt/70">(optional)</span>
          <input className={eingabe} inputMode="decimal" value={hebel} onChange={(ev) => setHebel(ev.target.value)} placeholder="z.B. 5" />
        </label>
      </div>

      <button type="button" onClick={() => setMehr((m) => !m)} className="inline-flex items-center gap-1 text-xs font-semibold text-akzent" aria-expanded={mehr}>
        {mehr ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Plan, Gefühl, Begründung {mehr ? '' : '(später ergänzbar)'}
      </button>

      {mehr && (
        <div className="space-y-3 rounded-xl border border-rand bg-nacht/40 p-3">
          <div>
            <div className={feld}>Im Plan? (Setup aus dem Kurs, Zone, Bestätigung, Risiko wie geplant)</div>
            <div className="mt-1 flex gap-1.5">
              <button type="button" className={chip(imPlan === true)} onClick={() => setImPlan(imPlan === true ? null : true)}>
                Ja
              </button>
              <button type="button" className={chip(imPlan === false)} onClick={() => setImPlan(imPlan === false ? null : false)}>
                Nein
              </button>
            </div>
          </div>
          <div>
            <div className={feld}>Gefühl vor dem Einstieg</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GEFUEHLE.map((g) => (
                <button key={g} type="button" className={chip(gefuehl === g)} onClick={() => setGefuehl(gefuehl === g ? '' : g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <label className={`${feld} block`}>
            Begründung (warum dieser Trade, warum jetzt)
            <textarea className={`${eingabe} min-h-20`} value={begruendung} onChange={(ev) => setBegruendung(ev.target.value)} />
          </label>
        </div>
      )}

      {fehler.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-short">
          {fehler.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={speichern} className={KNOPF_AKZENT}>
          {vorhanden ? 'Änderungen speichern' : 'Trade speichern'}
        </button>
        {onAbbrechen && (
          <button type="button" onClick={onAbbrechen} className={KNOPF}>
            Abbrechen
          </button>
        )}
      </div>
    </div>
  )
}
