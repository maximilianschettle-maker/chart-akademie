import { useState } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import type { Candle, Trade } from '../../types'
import type { ErkanntesSetup } from '../../engine/setupErkennung'
import { strategieName } from '../../content/strategien'
import { workerKonfiguriert } from '../../aktien/data/client'
import { tradePruefen } from '../../journal/pruefung'
import { PruefungKarte } from '../../journal/PruefungKarte'
import type { Pruefung } from '../../journal/types'
import { uebungsFakten } from '../../topdown/kiCoach'

// KI-Coach für einen Simulator-Trade: Fakten aus den Sitzungskerzen bis zum Einstieg plus das
// Ergebnis und der Abgleich mit der Setup-Erkennung; das Urteil bleibt in der Sitzung (nicht gespeichert).

interface Props {
  trade: Trade
  candles: Candle[]
  symbol: string
  interval: string
  /** Setup, zu dem der Einstieg laut Rückblick passt */
  setup: ErkanntesSetup | null
}

export function TradeCoach({ trade, candles, symbol, interval, setup }: Props) {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [urteil, setUrteil] = useState<Pruefung | null>(null)
  const mitWorker = workerKonfiguriert()

  async function fragen() {
    setLaeuft(true)
    setFehler(null)
    try {
      const fakten = uebungsFakten(
        {
          markt: symbol,
          symbol,
          waehrung: 'USDT',
          richtung: trade.richtung,
          entryTime: trade.entryTime,
          entryPreis: trade.entryPreis,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          strategieId: trade.strategieId ?? 'kein-setup',
          zeitrahmen: interval,
          exitTime: trade.exitTime,
          exitPreis: trade.exitPreis,
          exitGrund: trade.exitGrund === 'tp' ? 'ziel' : trade.exitGrund === 'sl' ? 'stop' : 'manuell',
        },
        candles,
        {
          art: 'simulator',
          setupGewaehlt: trade.strategieId ? strategieName(trade.strategieId) : null,
          abgleich: setup ? `Der Rückblick ordnet den Einstieg dem Setup „${strategieName(setup.strategieId)}“ (${setup.richtung}) zu.` : 'Der Rückblick findet zu diesem Einstieg kein erkanntes Setup.',
        },
        true,
      )
      const antwort = await tradePruefen(fakten)
      setUrteil({ ...antwort, erstelltAm: Date.now(), mitErgebnis: true })
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setLaeuft(false)
    }
  }

  if (urteil) return <PruefungKarte p={urteil} kontext="KI-Coach zum Simulator-Trade" />
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void fragen()} disabled={!mitWorker || laeuft} className="tipp inline-flex items-center gap-1 rounded-md bg-nacht px-2 py-1 text-[11px] font-semibold text-akzent disabled:opacity-40" title={mitWorker ? 'Urteil des KI-Coachs zu diesem Trade' : 'Kein Worker eingetragen (Aktien → Einstellungen)'}>
        {laeuft ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} KI-Coach
      </button>
      {fehler && <span className="text-[11px] text-short">{fehler}</span>}
    </div>
  )
}
