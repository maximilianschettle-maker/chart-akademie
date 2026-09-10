import { useState } from 'react'
import type { Order, Richtung } from '../../types'
import { mengeAusRisiko } from '../../engine/broker'
import { STRATEGIEN } from '../../content/strategien'

interface OrderTicketProps {
  aktuellerPreis: number
  kontostand: number
  barIndex: number
  deaktiviert: boolean
  onPlatzieren: (order: Order) => void
  /** Setup-Tag abfragen (Simulator ja, geführte Übung nein — dort ist es vorgegeben) */
  mitSetupTag?: boolean
}

function zahl(wert: string): number {
  const n = parseFloat(wert.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function OrderTicket({
  aktuellerPreis,
  kontostand,
  barIndex,
  deaktiviert,
  onPlatzieren,
  mitSetupTag = false,
}: OrderTicketProps) {
  const [richtung, setRichtung] = useState<Richtung>('long')
  const [typ, setTyp] = useState<'market' | 'limit'>('market')
  const [limitText, setLimitText] = useState('')
  const [slText, setSlText] = useState('')
  const [tpText, setTpText] = useState('')
  const [trailingText, setTrailingText] = useState('')
  const [risikoProzent, setRisikoProzent] = useState(1)
  const [strategieId, setStrategieId] = useState('')
  const [erweitert, setErweitert] = useState(false)

  const limitPreis = zahl(limitText)
  const stopLoss = zahl(slText)
  const takeProfit = zahl(tpText)
  const trailing = zahl(trailingText)
  const entryRef = typ === 'limit' ? limitPreis : aktuellerPreis
  const risikoBetrag = (kontostand * risikoProzent) / 100
  const menge = entryRef > 0 && stopLoss > 0 ? mengeAusRisiko(risikoBetrag, entryRef, stopLoss) : 0

  let fehler: string | null = null
  if (typ === 'limit' && limitPreis <= 0) fehler = 'Limit-Preis fehlt.'
  else if (stopLoss <= 0) fehler = 'Stop-Loss fehlt — ohne SL kein Trade (Level 2!).'
  else if (takeProfit <= 0) fehler = 'Take-Profit fehlt.'
  else if (richtung === 'long' && stopLoss >= entryRef) fehler = 'Long: SL muss unter dem Entry liegen.'
  else if (richtung === 'long' && takeProfit <= entryRef) fehler = 'Long: TP muss über dem Entry liegen.'
  else if (richtung === 'short' && stopLoss <= entryRef) fehler = 'Short: SL muss über dem Entry liegen.'
  else if (richtung === 'short' && takeProfit >= entryRef) fehler = 'Short: TP muss unter dem Entry liegen.'
  else if (trailingText.trim() !== '' && trailing <= 0) fehler = 'Trailing-Abstand muss größer 0 sein.'

  const chance = Math.abs(takeProfit - entryRef)
  const risiko = Math.abs(entryRef - stopLoss)
  const crv = risiko > 0 ? chance / risiko : 0

  function platzieren() {
    if (fehler || deaktiviert || menge <= 0) return
    onPlatzieren({
      id: `order-${barIndex}-${Date.now()}`,
      richtung,
      typ,
      limitPreis: typ === 'limit' ? limitPreis : undefined,
      stopLoss,
      takeProfit,
      menge,
      erstelltBarIndex: barIndex,
      trailingAbstand: trailing > 0 ? trailing : undefined,
      strategieId: mitSetupTag && strategieId ? strategieId : undefined,
    })
    setLimitText('')
  }

  const eingabeStil =
    'w-full rounded-lg border border-rand bg-nacht px-3 py-2 text-sm text-schrift outline-none focus:border-akzent'

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <div className="mb-3 flex gap-2">
        {(['long', 'short'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRichtung(r)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold uppercase ${
              richtung === r
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

      <div className="mb-3 flex gap-2 text-xs">
        {(['market', 'limit'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTyp(t)}
            className={`rounded-lg px-3 py-1.5 font-semibold capitalize ${
              typ === t ? 'bg-rand text-white' : 'bg-nacht text-gedimmt'
            }`}
          >
            {t}
          </button>
        ))}
        <span className="tabular-nums ml-auto self-center text-gedimmt">
          Kurs: {aktuellerPreis.toLocaleString('de-DE', { maximumFractionDigits: 2 })} $
        </span>
      </div>

      <div className="space-y-2">
        {typ === 'limit' && (
          <label className="block text-xs text-gedimmt">
            Limit-Preis
            <input
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              placeholder="z.B. 58000"
              className={eingabeStil}
              inputMode="decimal"
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-gedimmt">
            Stop-Loss
            <input
              value={slText}
              onChange={(e) => setSlText(e.target.value)}
              placeholder="Pflicht"
              className={eingabeStil}
              inputMode="decimal"
            />
          </label>
          <label className="block text-xs text-gedimmt">
            Take-Profit
            <input
              value={tpText}
              onChange={(e) => setTpText(e.target.value)}
              placeholder="Ziel"
              className={eingabeStil}
              inputMode="decimal"
            />
          </label>
        </div>
        <label className="block text-xs text-gedimmt">
          Risiko: <span className="font-semibold text-white">{risikoProzent} %</span> vom Konto (
          {risikoBetrag.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $)
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.25}
            value={risikoProzent}
            onChange={(e) => setRisikoProzent(Number(e.target.value))}
            className="mt-1 w-full accent-akzent"
          />
        </label>

        <button
          onClick={() => setErweitert((e) => !e)}
          className="text-xs text-gedimmt underline-offset-2 hover:text-schrift hover:underline"
        >
          {erweitert ? 'Weniger Optionen' : 'Mehr Optionen (Trailing, Setup-Tag)'}
        </button>

        {erweitert && (
          <div className="space-y-2 rounded-lg bg-nacht/60 p-3">
            <label className="block text-xs text-gedimmt">
              Trailing-Stop-Abstand ($, optional)
              <input
                value={trailingText}
                onChange={(e) => setTrailingText(e.target.value)}
                placeholder="z.B. 400 — SL folgt dem Kurs"
                className={eingabeStil}
                inputMode="decimal"
              />
            </label>
            {mitSetupTag && (
              <label className="block text-xs text-gedimmt">
                Welches Setup handelst du?
                <select
                  value={strategieId}
                  onChange={(e) => setStrategieId(e.target.value)}
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
            )}
          </div>
        )}
      </div>

      {menge > 0 && !fehler && (
        <div className="tabular-nums mt-3 rounded-lg bg-nacht p-3 text-xs text-gedimmt">
          Größe: <span className="text-white">{menge.toFixed(6)}</span> · CRV:{' '}
          <span className={crv >= 1.5 ? 'text-long' : 'text-akzent'}>{crv.toFixed(2)}</span>
          {crv < 1.5 && ' (unter 1,5 — lohnt sich das Setup?)'}
          {trailing > 0 && (
            <>
              {' '}
              · Trailing <span className="text-white">{trailing.toLocaleString('de-DE')} $</span>
            </>
          )}
        </div>
      )}
      {fehler && <div className="mt-3 text-xs text-short">{fehler}</div>}

      <button
        onClick={platzieren}
        disabled={!!fehler || deaktiviert || menge <= 0}
        className={`mt-3 w-full rounded-lg py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
          richtung === 'long' ? 'bg-long text-nacht' : 'bg-short text-white'
        }`}
      >
        {richtung === 'long' ? 'Long' : 'Short'} platzieren
      </button>
      {deaktiviert && (
        <p className="mt-2 text-xs text-gedimmt">
          Erst Position/Order schließen — der Simulator erlaubt bewusst nur eine gleichzeitig.
        </p>
      )}
    </div>
  )
}
