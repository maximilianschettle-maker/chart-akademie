import { useState } from 'react'
import { MousePointerClick, X } from 'lucide-react'
import type { Order } from '../../types'
import { STRATEGIEN } from '../../content/strategien'
import { fmtGeld, fmtPreis, preisText } from '../../engine/format'
import {
  type OrderEntwurf,
  entwurfAuswerten,
  entwurfZuOrder,
  richtungWechseln,
  slAusAtr,
  tpAusR,
} from '../../engine/orderEntwurf'

export type PickZiel = 'entry' | 'sl' | 'tp'

interface OrderTicketProps {
  entwurf: OrderEntwurf
  onEntwurf: (teil: Partial<OrderEntwurf>) => void
  aktuellerPreis: number
  kontostand: number
  barIndex: number
  deaktiviert: boolean
  onPlatzieren: (order: Order) => void
  /** ATR(14) der aktuellen Kerze — für SL-Vorschläge */
  atr?: number
  maxHebel?: number
  /** Geführte Übung: TP ist Pflicht (die Bewertung braucht das CRV) */
  tpPflicht?: boolean
  /** Setup-Tag und Notiz abfragen (Simulator ja, geführte Übung nein — dort ist es vorgegeben) */
  mitSetupTag?: boolean
  /** Welches Feld wartet gerade auf einen Tipp in den Chart? */
  pickZiel?: PickZiel | null
  onPickZiel?: (ziel: PickZiel | null) => void
}

const eingabeStil =
  'w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent'
const chip =
  'rounded-md bg-nacht px-1.5 py-1 text-[11px] font-semibold text-gedimmt hover:text-white disabled:opacity-40'

function PreisFeld({
  label,
  wert,
  onWert,
  platzhalter,
  pickAktiv,
  onPick,
}: {
  label: string
  wert: string
  onWert: (w: string) => void
  platzhalter: string
  pickAktiv: boolean
  onPick?: () => void
}) {
  return (
    <label className="block text-xs text-gedimmt">
      {label}
      <div className="mt-0.5 flex gap-1">
        <input
          value={wert}
          onChange={(e) => onWert(e.target.value)}
          placeholder={platzhalter}
          className={eingabeStil}
          inputMode="decimal"
        />
        {onPick && (
          <button
            type="button"
            onClick={onPick}
            className={`shrink-0 rounded-lg border px-2 ${
              pickAktiv ? 'border-akzent bg-akzent text-nacht' : 'border-rand bg-nacht text-gedimmt hover:text-white'
            }`}
            title={`${label} im Chart antippen`}
            aria-label={`${label} im Chart wählen`}
          >
            <MousePointerClick className="h-4 w-4" />
          </button>
        )}
      </div>
    </label>
  )
}

export function OrderTicket({
  entwurf,
  onEntwurf,
  aktuellerPreis,
  kontostand,
  barIndex,
  deaktiviert,
  onPlatzieren,
  atr = 0,
  maxHebel = 20,
  tpPflicht = false,
  mitSetupTag = false,
  pickZiel = null,
  onPickZiel,
}: OrderTicketProps) {
  const [erweitert, setErweitert] = useState(false)
  const a = entwurfAuswerten(entwurf, aktuellerPreis, kontostand, { maxHebel, tpPflicht })
  const long = entwurf.richtung === 'long'
  const hatEntwurf = entwurf.sl !== '' || entwurf.tp !== '' || entwurf.entry !== ''
  const pick = (ziel: PickZiel) => (onPickZiel ? () => onPickZiel(pickZiel === ziel ? null : ziel) : undefined)

  function platzieren() {
    if (a.fehler || deaktiviert || a.menge <= 0) return
    onPlatzieren(entwurfZuOrder(entwurf, a, barIndex, mitSetupTag))
    onEntwurf({ entry: '', sl: '', tp: '', trailing: '', notiz: '' })
    onPickZiel?.(null)
  }

  const typText = a.orderTyp === 'market' ? 'Market' : a.orderTyp === 'limit' ? 'Limit' : 'Stop'
  const zielGewinn = a.takeProfit > 0 ? Math.abs(a.takeProfit - a.entryRef) * a.menge : 0

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <div className="mb-3 flex gap-2">
        {(['long', 'short'] as const).map((r) => (
          <button
            key={r}
            onClick={() => onEntwurf(richtungWechseln(entwurf, r, a.entryRef))}
            className={`flex-1 rounded-lg py-2 text-sm font-bold uppercase ${
              entwurf.richtung === r
                ? r === 'long'
                  ? 'bg-long text-nacht'
                  : 'bg-short text-white'
                : 'bg-nacht text-gedimmt'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          onClick={() => onEntwurf({ typ: 'market' })}
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            entwurf.typ === 'market' ? 'bg-rand text-white' : 'bg-nacht text-gedimmt'
          }`}
        >
          Market
        </button>
        <button
          onClick={() =>
            onEntwurf({ typ: 'preis', entry: entwurf.entry || preisText(aktuellerPreis) })
          }
          className={`rounded-lg px-3 py-1.5 font-semibold ${
            entwurf.typ === 'preis' ? 'bg-rand text-white' : 'bg-nacht text-gedimmt'
          }`}
        >
          Limit / Stop
        </button>
        <span className="tabular-nums ml-auto text-gedimmt">Kurs {fmtPreis(aktuellerPreis)}</span>
      </div>

      <div className="space-y-2">
        {entwurf.typ === 'preis' && (
          <>
            <PreisFeld
              label={`Einstieg (${typText})`}
              wert={entwurf.entry}
              onWert={(entry) => onEntwurf({ entry })}
              platzhalter="Preis"
              pickAktiv={pickZiel === 'entry'}
              onPick={pick('entry')}
            />
            {a.entryRef > 0 && (
              <p className="text-[11px] leading-snug text-gedimmt">
                {a.orderTyp === 'limit'
                  ? `Limit: füllt, sobald der Kurs auf ${fmtPreis(a.entryRef)} ${long ? 'fällt' : 'steigt'}.`
                  : `Stop: steigt ein, sobald der Kurs ${fmtPreis(a.entryRef)} ${long ? 'nach oben' : 'nach unten'} durchbricht.`}
              </p>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <PreisFeld
            label="Stop-Loss"
            wert={entwurf.sl}
            onWert={(sl) => onEntwurf({ sl })}
            platzhalter="Pflicht"
            pickAktiv={pickZiel === 'sl'}
            onPick={pick('sl')}
          />
          <PreisFeld
            label="Take-Profit"
            wert={entwurf.tp}
            onWert={(tp) => onEntwurf({ tp })}
            platzhalter={tpPflicht ? 'Ziel' : 'optional'}
            pickAktiv={pickZiel === 'tp'}
            onPick={pick('tp')}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {[1, 1.5, 2, 3].map((f) => (
              <button
                key={f}
                onClick={() => onEntwurf(slAusAtr(entwurf, a.entryRef, atr, f))}
                disabled={atr <= 0 || a.entryRef <= 0}
                className={chip}
                title={`Stop ${f.toLocaleString('de-DE')} × ATR vom Einstieg entfernt`}
              >
                {f.toLocaleString('de-DE')}×
              </button>
            ))}
            <span className="text-[10px] text-gedimmt">ATR</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {[1, 2, 3].map((r) => (
              <button
                key={r}
                onClick={() => onEntwurf(tpAusR(entwurf, a.entryRef, r))}
                disabled={a.stopLoss <= 0}
                className={chip}
                title={`Ziel beim ${r}-fachen Risiko`}
              >
                {r}R
              </button>
            ))}
            {!tpPflicht && (
              <button onClick={() => onEntwurf({ tp: '' })} disabled={entwurf.tp === ''} className={chip}>
                kein
              </button>
            )}
          </div>
        </div>

        {pickZiel && (
          <p className="rounded-lg bg-akzent/10 px-3 py-2 text-xs text-akzent">
            Tippe in den Chart, um{' '}
            {pickZiel === 'sl' ? 'den Stop-Loss' : pickZiel === 'tp' ? 'den Take-Profit' : 'den Einstieg'} zu
            setzen.
          </p>
        )}

        <label className="block pt-1 text-xs text-gedimmt">
          Risiko <span className="font-semibold text-white">{entwurf.risikoProzent.toLocaleString('de-DE')} %</span>{' '}
          vom Konto ({fmtGeld((kontostand * entwurf.risikoProzent) / 100)})
          <input
            type="range"
            min={0.25}
            max={5}
            step={0.25}
            value={entwurf.risikoProzent}
            onChange={(e) => onEntwurf({ risikoProzent: Number(e.target.value) })}
            className="mt-1 w-full accent-akzent"
          />
        </label>

        <button
          onClick={() => setErweitert((e) => !e)}
          className="text-xs text-gedimmt underline-offset-2 hover:text-schrift hover:underline"
        >
          {erweitert ? 'Weniger Optionen' : mitSetupTag ? 'Mehr Optionen (Trailing, Setup-Tag, Notiz)' : 'Mehr Optionen (Trailing)'}
        </button>

        {erweitert && (
          <div className="space-y-2 rounded-lg bg-nacht/60 p-3">
            <label className="block text-xs text-gedimmt">
              Trailing-Stop-Abstand ($, optional)
              <input
                value={entwurf.trailing}
                onChange={(e) => onEntwurf({ trailing: e.target.value })}
                placeholder={atr > 0 ? `z.B. ${preisText(2 * atr, aktuellerPreis)} (2 × ATR)` : 'SL folgt dem Kurs'}
                className={eingabeStil}
                inputMode="decimal"
              />
            </label>
            {mitSetupTag && (
              <>
                <label className="block text-xs text-gedimmt">
                  Welches Setup handelst du?
                  <select
                    value={entwurf.strategieId}
                    onChange={(e) => onEntwurf({ strategieId: e.target.value })}
                    className={eingabeStil}
                  >
                    <option value="">— nicht getaggt —</option>
                    {STRATEGIEN.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-gedimmt">
                  Notiz (warum dieser Trade?)
                  <input
                    value={entwurf.notiz}
                    onChange={(e) => onEntwurf({ notiz: e.target.value })}
                    placeholder="z.B. Retest der Range-Decke mit Volumen"
                    className={eingabeStil}
                    maxLength={160}
                  />
                </label>
              </>
            )}
          </div>
        )}
      </div>

      {a.menge > 0 && !a.fehler && (
        <dl className="tabular-nums mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-nacht p-3 text-xs text-gedimmt">
          <dt>Größe</dt>
          <dd className="text-right text-white">{a.menge.toLocaleString('de-DE', { maximumSignificantDigits: 5 })}</dd>
          <dt>Positionswert</dt>
          <dd className="text-right text-white">
            {fmtGeld(a.positionswert)} · {a.hebel.toLocaleString('de-DE', { maximumFractionDigits: 1 })}x
          </dd>
          <dt>Risiko</dt>
          <dd className="text-right text-short">{fmtGeld(-a.risikoBetrag)}</dd>
          {a.takeProfit > 0 && (
            <>
              <dt>Ziel</dt>
              <dd className="text-right text-long">+{fmtGeld(zielGewinn)}</dd>
              <dt>CRV</dt>
              <dd className={`text-right font-semibold ${a.crv >= 1.5 ? 'text-long' : 'text-akzent'}`}>
                {a.crv.toFixed(2)}
              </dd>
            </>
          )}
        </dl>
      )}
      {a.menge > 0 && !a.fehler && a.takeProfit > 0 && a.crv < 1.5 && (
        <p className="mt-2 text-xs text-akzent">CRV unter 1,5 — lohnt sich das Setup?</p>
      )}
      {a.gekappt && !a.fehler && (
        <p className="mt-2 text-xs text-akzent">
          Stop sehr eng: Größe auf {maxHebel}x Hebel begrenzt — das Risiko liegt damit unter den gewählten{' '}
          {entwurf.risikoProzent.toLocaleString('de-DE')} %.
        </p>
      )}
      {a.fehler && hatEntwurf && <div className="mt-3 text-xs text-short">{a.fehler}</div>}
      {!hatEntwurf && !deaktiviert && (
        <p className="mt-3 text-xs text-gedimmt">
          Stop-Loss eintragen, im Chart antippen oder einen ATR-Abstand wählen — die Linien lassen sich danach
          im Chart ziehen.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={platzieren}
          disabled={!!a.fehler || deaktiviert || a.menge <= 0}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
            long ? 'bg-long text-nacht' : 'bg-short text-white'
          }`}
        >
          {long ? 'Long' : 'Short'} {typText}
          {a.orderTyp === 'market' ? ' — sofort' : ' platzieren'}
        </button>
        {hatEntwurf && (
          <button
            onClick={() => {
              onEntwurf({ entry: '', sl: '', tp: '', trailing: '' })
              onPickZiel?.(null)
            }}
            className="rounded-lg bg-nacht px-3 text-gedimmt hover:text-white"
            title="Entwurf verwerfen"
            aria-label="Entwurf verwerfen"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {deaktiviert && (
        <p className="mt-2 text-xs text-gedimmt">
          Erst Position/Order schließen — der Simulator erlaubt bewusst nur eine gleichzeitig.
        </p>
      )}
    </div>
  )
}
