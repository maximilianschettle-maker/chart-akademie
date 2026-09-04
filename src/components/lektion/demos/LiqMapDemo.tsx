import { useEffect, useState } from 'react'
import { LoaderCircle, WifiOff } from 'lucide-react'
import type { Candle } from '../../../types'
import { getCandles } from '../../../data/candleService'
import { liqCluster, liqBins } from '../../../engine/indikatoren/liqMap'

// Geschätzte Liquidations-Cluster aus den LIVE-Kursdaten der letzten ~3 Wochen.
// Ehrlich gekennzeichnete Schätzung — echte Liquidationsdaten sind nicht frei verfügbar.

export function LiqMapDemo() {
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    const jetzt = Math.floor(Date.now() / 1000 / 3600) * 3600
    getCandles('BTCUSDT', '1h', jetzt - 500 * 3600, jetzt)
      .then(setCandles)
      .catch(() => setFehler(true))
  }, [])

  if (fehler) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-rand bg-flaeche text-gedimmt">
        <WifiOff className="h-6 w-6" />
        <p className="text-sm">Live-Daten nicht erreichbar — Demo braucht Internet.</p>
      </div>
    )
  }
  if (candles === null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-rand bg-flaeche text-gedimmt">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const aktuellerPreis = candles[candles.length - 1].close
  const minPreis = aktuellerPreis * 0.85
  const maxPreis = aktuellerPreis * 1.15
  const cluster = liqCluster(candles, 8)
  const bins = liqBins(cluster, minPreis, maxPreis, 56)
  const maxGewicht = Math.max(...bins.map((b) => b.gewichtLong + b.gewichtShort), 1)

  const hoehe = 340
  const breite = 560
  const yFuerPreis = (p: number) => hoehe - ((p - minPreis) / (maxPreis - minPreis)) * hoehe

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h3 className="mb-1 font-semibold text-white">
        Liquidity Map — BTC live, aus Kursdaten geschätzt
      </h3>
      <p className="mb-3 text-xs text-gedimmt">
        Berechnet aus den Swing-Punkten der letzten ~3 Wochen und den gängigen Hebeln
        10x/25x/50x/100x. <span className="text-akzent">Rot</span> = geschätzte
        Long-Liquidationen (unter dem Preis), <span className="text-long">grün</span> =
        Short-Liquidationen (über dem Preis).
      </p>
      <svg viewBox={`0 0 ${breite} ${hoehe}`} className="w-full">
        {bins.map((b, i) => {
          const gewicht = b.gewichtLong + b.gewichtShort
          if (gewicht <= 0) return null
          const y = yFuerPreis(b.preisBis)
          const h = Math.max(1, yFuerPreis(b.preisVon) - y - 1)
          const w = (gewicht / maxGewicht) * (breite - 100)
          const istUnter = (b.preisVon + b.preisBis) / 2 < aktuellerPreis
          return (
            <rect key={i} x={0} y={y} width={w} height={h} fill={istUnter ? '#EF4444AA' : '#22C55EAA'} />
          )
        })}
        <line
          x1={0}
          x2={breite}
          y1={yFuerPreis(aktuellerPreis)}
          y2={yFuerPreis(aktuellerPreis)}
          stroke="#F59E0B"
          strokeWidth={1.5}
        />
        <text x={breite - 4} y={yFuerPreis(aktuellerPreis) - 5} textAnchor="end" fill="#F59E0B" fontSize={11}>
          Aktuell {aktuellerPreis.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $
        </text>
        <text x={breite - 4} y={14} textAnchor="end" fill="#8B95A5" fontSize={10}>
          {maxPreis.toFixed(0)} $
        </text>
        <text x={breite - 4} y={hoehe - 4} textAnchor="end" fill="#8B95A5" fontSize={10}>
          {minPreis.toFixed(0)} $
        </text>
      </svg>
      <p className="mt-2 text-xs text-gedimmt">
        Lesart: Dichte Cluster wirken wie Magnete — dort löst eine Berührung Zwangsorders aus, die
        die Bewegung kurz verstärken und oft die berüchtigten Dochte („Stop Hunts") erzeugen.
        Wichtig: Das ist eine <strong className="text-schrift">Schätzung</strong> aus öffentlichen
        Kursdaten — genau so arbeiten aber auch die meisten kommerziellen Liquidity-Map-Tools.
      </p>
    </div>
  )
}
