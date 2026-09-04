import { useEffect, useState } from 'react'
import { LoaderCircle, WifiOff } from 'lucide-react'
import type { Candle, ChartAnnotation } from '../../types'
import { getCandles } from '../../data/candleService'
import { ChartPanel } from '../chart/ChartPanel'

interface ChartBlockProps {
  titel?: string
  symbol: string
  interval: string
  von: number
  bis: number
  annotationen?: ChartAnnotation[]
  beschreibung?: string
  emaPerioden?: number[]
}

export function ChartBlock({
  titel,
  symbol,
  interval,
  von,
  bis,
  annotationen,
  beschreibung,
  emaPerioden,
}: ChartBlockProps) {
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    let aktiv = true
    setCandles(null)
    setFehler(false)
    getCandles(symbol, interval, von, bis)
      .then((daten) => {
        if (aktiv) setCandles(daten)
      })
      .catch(() => {
        if (aktiv) setFehler(true)
      })
    return () => {
      aktiv = false
    }
  }, [symbol, interval, von, bis])

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      {titel && <h3 className="mb-3 font-semibold text-white">{titel}</h3>}
      {fehler ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-gedimmt">
          <WifiOff className="h-6 w-6" />
          <p className="text-sm">
            Kursdaten konnten nicht geladen werden (Binance nicht erreichbar).
          </p>
          <p className="text-xs">Prüfe deine Internetverbindung und lade die Seite neu.</p>
        </div>
      ) : candles === null ? (
        <div className="flex h-48 items-center justify-center text-gedimmt">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <ChartPanel candles={candles} annotationen={annotationen} emaPerioden={emaPerioden} />
      )}
      {beschreibung && <p className="mt-3 text-sm text-gedimmt">{beschreibung}</p>}
    </div>
  )
}
