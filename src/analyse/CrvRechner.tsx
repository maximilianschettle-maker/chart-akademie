import { Crosshair } from 'lucide-react'
import { EINGABE } from '../aktien/components/ui'
import { fmtKurs } from '../aktien/engine/format'
import { useAnsichtStore } from './ansichtStore'
import { crvBerechnen, rundePreis, stopAusProzent, zielAusR, type Richtung } from './crv'

// Chance-Risiko-Rechner unter dem Trader-Chart. Einstieg/Stop/Ziel liegen als ziehbare Linien im Chart;
// hier stehen Zahlenfelder, Schnellwahlen (Stop in %, Ziel in R) und das Ergebnis (Stück, CRV, Beträge).

export type CrvFeld = 'entry' | 'stop' | 'ziel'

export interface CrvWerte {
  richtung: Richtung
  entry: number
  stop: number
  ziel: number
}

interface Props {
  werte: CrvWerte
  waehrung: string
  onWerte: (neu: CrvWerte) => void
  /** Feld, das gerade per Tipp in den Chart gefüllt wird */
  pick: CrvFeld | null
  onPick: (feld: CrvFeld | null) => void
}

const FELDER: { id: CrvFeld; text: string }[] = [
  { id: 'entry', text: 'Einstieg' },
  { id: 'stop', text: 'Stop' },
  { id: 'ziel', text: 'Ziel' },
]

function zahl(text: string): number | null {
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function CrvRechner({ werte, waehrung, onWerte, pick, onPick }: Props) {
  const konto = useAnsichtStore((s) => s.konto)
  const risikoProzent = useAnsichtStore((s) => s.risikoProzent)
  const setzen = useAnsichtStore((s) => s.setzen)
  const e = crvBerechnen({ ...werte, konto, risikoProzent })
  const geld = (n: number) => fmtKurs(n, waehrung)

  const richtungSetzen = (richtung: Richtung) => {
    if (richtung === werte.richtung) return
    // Stop und Ziel spiegeln: gleiche Abstände, andere Seite
    const dStop = Math.abs(werte.entry - werte.stop)
    const dZiel = Math.abs(werte.ziel - werte.entry)
    onWerte({
      richtung,
      entry: werte.entry,
      stop: rundePreis(richtung === 'long' ? werte.entry - dStop : werte.entry + dStop),
      ziel: rundePreis(richtung === 'long' ? werte.entry + dZiel : werte.entry - dZiel),
    })
  }

  return (
    <div className="rounded-xl border border-rand bg-flaeche/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Chance-Risiko-Rechner</h3>
        <div role="radiogroup" aria-label="Richtung" className="inline-flex rounded-lg bg-nacht p-0.5">
          {(['long', 'short'] as Richtung[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={werte.richtung === r}
              onClick={() => richtungSetzen(r)}
              className={`tipp rounded-md px-3 py-1 text-xs font-semibold ${werte.richtung === r ? (r === 'long' ? 'bg-long text-nacht' : 'bg-short text-white') : 'text-gedimmt hover:text-schrift'}`}
            >
              {r === 'long' ? 'Long' : 'Short'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="text-[11px] text-gedimmt">
          Konto ({waehrung || '–'})
          <input className={`mt-1 ${EINGABE} tipp`} inputMode="decimal" value={konto} onChange={(ev) => setzen({ konto: zahl(ev.target.value) ?? 0 })} />
        </label>
        <label className="text-[11px] text-gedimmt">
          Risiko je Trade (%)
          <input className={`mt-1 ${EINGABE} tipp`} inputMode="decimal" value={risikoProzent} onChange={(ev) => setzen({ risikoProzent: zahl(ev.target.value) ?? 0 })} />
        </label>
        {FELDER.map((f) => (
          <label key={f.id} className="text-[11px] text-gedimmt">
            <span className="flex items-center justify-between">
              {f.text}
              <button
                type="button"
                onClick={() => onPick(pick === f.id ? null : f.id)}
                aria-pressed={pick === f.id}
                title="Nächsten Tipp in den Chart als Wert übernehmen"
                className={`inline-flex h-6 w-6 items-center justify-center rounded ${pick === f.id ? 'bg-akzent text-nacht' : 'text-gedimmt hover:text-white'}`}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            </span>
            <input
              className={`mt-1 ${EINGABE} tipp ${f.id === 'stop' ? 'border-short/50' : f.id === 'ziel' ? 'border-long/50' : 'border-akzent/50'}`}
              inputMode="decimal"
              value={werte[f.id]}
              onChange={(ev) => {
                const n = zahl(ev.target.value)
                if (n !== null) onWerte({ ...werte, [f.id]: n })
              }}
            />
          </label>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        {[1, 2, 5].map((p) => (
          <button key={p} type="button" className="tipp rounded-md bg-nacht px-2 py-1 font-semibold text-gedimmt hover:text-schrift" onClick={() => onWerte({ ...werte, stop: rundePreis(stopAusProzent(werte.entry, p, werte.richtung)) })}>
            Stop {p} %
          </button>
        ))}
        {[1, 2, 3].map((r) => (
          <button key={r} type="button" className="tipp rounded-md bg-nacht px-2 py-1 font-semibold text-gedimmt hover:text-schrift" onClick={() => onWerte({ ...werte, ziel: rundePreis(zielAusR(werte.entry, werte.stop, r, werte.richtung)) })}>
            Ziel {r} R
          </button>
        ))}
        {pick && <span className="w-full text-akzent">Tippe in den Chart, um „{FELDER.find((f) => f.id === pick)?.text}“ zu setzen. Linien lassen sich auch direkt ziehen.</span>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-gedimmt">Stückzahl</dt>
          <dd className="tabular-nums text-base font-bold text-white">{e.stueck.toLocaleString('de-DE')}</dd>
        </div>
        <div>
          <dt className="text-gedimmt">CRV</dt>
          <dd className={`tabular-nums text-base font-bold ${e.crv >= 2 ? 'text-long' : e.crv >= 1 ? 'text-white' : 'text-short'}`}>{e.crv > 0 ? `${e.crv.toFixed(2).replace('.', ',')} : 1` : '–'}</dd>
        </div>
        <div>
          <dt className="text-gedimmt">Positionswert</dt>
          <dd className="tabular-nums text-white">
            {geld(e.positionswert)} <span className="text-gedimmt">({(e.positionAnteil * 100).toFixed(0)} % des Kontos)</span>
          </dd>
        </div>
        <div>
          <dt className="text-gedimmt">Risiko / Chance</dt>
          <dd className="tabular-nums">
            <span className="text-short">−{geld(e.verlustBeiStop)}</span> <span className="text-gedimmt">({e.stopProzent.toFixed(1).replace('.', ',')} %)</span> ·{' '}
            <span className="text-long">+{geld(e.gewinnBeiZiel)}</span> <span className="text-gedimmt">({e.zielProzent.toFixed(1).replace('.', ',')} %)</span>
          </dd>
        </div>
      </dl>
      {e.probleme.length > 0 && <p className="mt-2 text-[11px] text-short">{e.probleme.join(' · ')}</p>}
      {e.positionAnteil > 1 && e.probleme.length === 0 && <p className="mt-2 text-[11px] text-akzent">Position größer als das Konto – ohne Hebel geht das nicht; Stop enger oder Risiko kleiner wählen.</p>}
    </div>
  )
}
