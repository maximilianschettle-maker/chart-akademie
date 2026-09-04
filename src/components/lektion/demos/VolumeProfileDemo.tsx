import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { Candle } from '../../../types'
import { getSzenarioDaten } from '../../../data/szenarien'
import { volumeProfile } from '../../../engine/indikatoren/volumeProfile'

// Volume Profile, live berechnet aus einem echten historischen Datensatz
// (BTC-Range September 2023 — ideal, weil sich dort viel Volumen staut).

export function VolumeProfileDemo() {
  const [candles, setCandles] = useState<Candle[] | null>(null)

  useEffect(() => {
    getSzenarioDaten('btc-range-sep23')
      .then((d) => setCandles(d.candles.slice(288, 576))) // September-Range
      .catch(() => setCandles([]))
  }, [])

  if (candles === null) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-rand bg-flaeche text-gedimmt">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    )
  }
  if (candles.length === 0) {
    return (
      <div className="rounded-xl border border-rand bg-flaeche p-6 text-sm text-gedimmt">
        Datensatz konnte nicht geladen werden.
      </div>
    )
  }

  const profil = volumeProfile(candles, 36)
  const maxVol = Math.max(...profil.bins.map((b) => b.volumen))
  const minPreis = profil.bins[0].preisVon
  const maxPreis = profil.bins[profil.bins.length - 1].preisBis
  const hoehe = 320
  const breite = 560
  const yFuerPreis = (p: number) => hoehe - ((p - minPreis) / (maxPreis - minPreis)) * hoehe

  return (
    <div className="rounded-xl border border-rand bg-flaeche p-4">
      <h3 className="mb-1 font-semibold text-white">Volume Profile — BTC, 12 Range-Tage (echte Daten)</h3>
      <p className="mb-3 text-xs text-gedimmt">
        Horizontal: gehandeltes Volumen je Preisniveau. Gelb = POC, schraffierter Bereich = Value
        Area (~70 % des Volumens).
      </p>
      <svg viewBox={`0 0 ${breite} ${hoehe}`} className="w-full">
        {/* Value Area */}
        <rect
          x={0}
          y={yFuerPreis(profil.valueAreaHigh)}
          width={breite}
          height={yFuerPreis(profil.valueAreaLow) - yFuerPreis(profil.valueAreaHigh)}
          fill="#F59E0B14"
        />
        {/* Bins */}
        {profil.bins.map((b, i) => {
          const y = yFuerPreis(b.preisBis)
          const h = Math.max(1, yFuerPreis(b.preisVon) - y - 1)
          const w = (b.volumen / maxVol) * (breite - 90)
          const istPoc = Math.abs((b.preisVon + b.preisBis) / 2 - profil.poc) < 1
          return (
            <g key={i}>
              <rect x={0} y={y} width={w} height={h} fill={istPoc ? '#F59E0B' : '#3B82F6AA'} />
            </g>
          )
        })}
        {/* POC-Linie + Beschriftungen */}
        <line
          x1={0}
          x2={breite}
          y1={yFuerPreis(profil.poc)}
          y2={yFuerPreis(profil.poc)}
          stroke="#F59E0B"
          strokeDasharray="4 3"
        />
        <text x={breite - 4} y={yFuerPreis(profil.poc) - 4} textAnchor="end" fill="#F59E0B" fontSize={11}>
          POC {profil.poc.toFixed(0)} $
        </text>
        <text x={breite - 4} y={yFuerPreis(profil.valueAreaHigh) + 12} textAnchor="end" fill="#8B95A5" fontSize={10}>
          VA High {profil.valueAreaHigh.toFixed(0)} $
        </text>
        <text x={breite - 4} y={yFuerPreis(profil.valueAreaLow) - 4} textAnchor="end" fill="#8B95A5" fontSize={10}>
          VA Low {profil.valueAreaLow.toFixed(0)} $
        </text>
      </svg>
      <p className="mt-2 text-xs text-gedimmt">
        Lesart: Am POC ({profil.poc.toFixed(0)} $) wurde am meisten gehandelt — solche Zonen wirken
        wie Magnete und später als Unterstützung/Widerstand. Dünne Profile (wenig Volumen) werden
        dagegen schnell durchlaufen.
      </p>
    </div>
  )
}
