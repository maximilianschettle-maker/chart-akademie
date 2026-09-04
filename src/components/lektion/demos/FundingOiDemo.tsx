import { useEffect, useState } from 'react'
import { LoaderCircle, WifiOff } from 'lucide-react'

// Echte Binance-Futures-Daten: Funding Rate (volle Historie verfügbar) und
// Open Interest (Binance liefert nur ~30 Tage rückwirkend).

interface FundingPunkt {
  zeit: number
  rate: number // z.B. 0.0001 = 0,01 %
}

interface OiPunkt {
  zeit: number
  oi: number // in BTC
}

export function FundingOiDemo() {
  const [funding, setFunding] = useState<FundingPunkt[] | null>(null)
  const [oi, setOi] = useState<OiPunkt[] | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    async function laden() {
      try {
        const [fRes, oiRes] = await Promise.all([
          fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=90'),
          fetch(
            'https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=30',
          ),
        ])
        if (!fRes.ok || !oiRes.ok) throw new Error('HTTP-Fehler')
        const fDaten = (await fRes.json()) as { fundingTime: number; fundingRate: string }[]
        const oiDaten = (await oiRes.json()) as { timestamp: number; sumOpenInterest: string }[]
        setFunding(fDaten.map((d) => ({ zeit: d.fundingTime, rate: parseFloat(d.fundingRate) })))
        setOi(oiDaten.map((d) => ({ zeit: d.timestamp, oi: parseFloat(d.sumOpenInterest) })))
      } catch {
        setFehler(true)
      }
    }
    laden()
  }, [])

  if (fehler) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-rand bg-flaeche text-gedimmt">
        <WifiOff className="h-6 w-6" />
        <p className="text-sm">Futures-Daten nicht erreichbar — Demo braucht Internet.</p>
      </div>
    )
  }
  if (!funding || !oi) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-rand bg-flaeche text-gedimmt">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const breite = 560
  const hoehe = 130
  const maxRate = Math.max(...funding.map((f) => Math.abs(f.rate)), 0.0001)
  const balkenBreite = breite / funding.length
  const letzteRate = funding[funding.length - 1]

  const minOi = Math.min(...oi.map((p) => p.oi))
  const maxOi = Math.max(...oi.map((p) => p.oi))
  const oiPfad = oi
    .map((p, i) => {
      const x = (i / (oi.length - 1)) * breite
      const y = hoehe - ((p.oi - minOi) / (maxOi - minOi || 1)) * (hoehe - 20) - 10
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rand bg-flaeche p-4">
        <h3 className="mb-1 font-semibold text-white">Funding Rate — BTC Perpetual, letzte 30 Tage (live)</h3>
        <p className="mb-3 text-xs text-gedimmt">
          Alle 8 Stunden. Grün = positiv (Longs zahlen Shorts), Rot = negativ (Shorts zahlen Longs).
          Aktuell: {(letzteRate.rate * 100).toFixed(4)} %.
        </p>
        <svg viewBox={`0 0 ${breite} ${hoehe}`} className="w-full">
          <line x1={0} x2={breite} y1={hoehe / 2} y2={hoehe / 2} stroke="#1F2733" />
          {funding.map((f, i) => {
            const h = (Math.abs(f.rate) / maxRate) * (hoehe / 2 - 8)
            const y = f.rate >= 0 ? hoehe / 2 - h : hoehe / 2
            return (
              <rect
                key={i}
                x={i * balkenBreite}
                y={y}
                width={Math.max(1, balkenBreite - 1)}
                height={Math.max(1, h)}
                fill={f.rate >= 0 ? '#22C55E' : '#EF4444'}
              />
            )
          })}
        </svg>
        <p className="mt-2 text-xs text-gedimmt">
          Extrem hohes positives Funding = der Markt ist einseitig long positioniert — oft kurz vor
          Korrekturen. Stark negatives Funding nach einem Abverkauf spricht für überfüllte Shorts
          (Treibstoff für Short Squeezes).
        </p>
      </div>

      <div className="rounded-xl border border-rand bg-flaeche p-4">
        <h3 className="mb-1 font-semibold text-white">Open Interest — BTC Futures, letzte 30 Tage (live)</h3>
        <p className="mb-3 text-xs text-gedimmt">
          Summe aller offenen Kontrakte in BTC. (Binance liefert nur ~30 Tage Historie.)
        </p>
        <svg viewBox={`0 0 ${breite} ${hoehe}`} className="w-full">
          <path d={oiPfad} fill="none" stroke="#3B82F6" strokeWidth={2} />
          <text x={4} y={14} fill="#8B95A5" fontSize={10}>
            Max {Math.round(maxOi).toLocaleString('de-DE')} BTC
          </text>
          <text x={4} y={hoehe - 4} fill="#8B95A5" fontSize={10}>
            Min {Math.round(minOi).toLocaleString('de-DE')} BTC
          </text>
        </svg>
        <p className="mt-2 text-xs text-gedimmt">
          Lesart: Steigender Preis + steigendes OI = neues Geld trägt den Trend (gesund). Steigender
          Preis + fallendes OI = nur Short-Eindeckungen (fragil). Ein plötzlicher OI-Einbruch =
          Massen-Liquidation.
        </p>
      </div>
    </div>
  )
}
