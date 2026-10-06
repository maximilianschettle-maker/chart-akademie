import { useMemo, useState } from 'react'
import type { EquityPunkt } from '../../engine/auswertung'

// Equity-Kurve als schlichtes SVG: eine Serie (Kontostand nach jedem Trade),
// Startkapital als Referenzlinie, Hover-Tooltip mit Trade-Details.

interface EquityKurveProps {
  punkte: EquityPunkt[]
  startKapital: number
  hoehe?: number
  /** Breite des Koordinatensystems — kleiner wählen, wenn die Kurve schmal angezeigt wird (Schrift bleibt lesbar) */
  breite?: number
}

const AKZENT = '#F59E0B'

function geld(n: number) {
  return `${n >= 0 ? '' : '−'}${Math.abs(n).toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`
}

export function EquityKurve({ punkte, startKapital, hoehe = 200, breite = 640 }: EquityKurveProps) {
  const [aktiv, setAktiv] = useState<number | null>(null)
  const rand = { oben: 12, unten: 22, links: 8, rechts: 8 }

  const geo = useMemo(() => {
    const werte = punkte.map((p) => p.kontostand)
    const min = Math.min(...werte, startKapital)
    const max = Math.max(...werte, startKapital)
    const spanne = max - min || 1
    const innenB = breite - rand.links - rand.rechts
    const innenH = hoehe - rand.oben - rand.unten
    const x = (i: number) => rand.links + (punkte.length > 1 ? (i / (punkte.length - 1)) * innenB : innenB / 2)
    const y = (v: number) => rand.oben + innenH - ((v - min) / spanne) * innenH
    const pfad = punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.kontostand).toFixed(1)}`).join(' ')
    const flaeche = `${pfad} L${x(punkte.length - 1).toFixed(1)},${y(startKapital).toFixed(1)} L${x(0).toFixed(1)},${y(startKapital).toFixed(1)} Z`
    return { x, y, pfad, flaeche, min, max }
  }, [punkte, startKapital, hoehe, breite, rand.links, rand.rechts, rand.oben, rand.unten])

  if (punkte.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-gedimmt">
        Die Equity-Kurve erscheint nach deinem ersten abgeschlossenen Trade.
      </p>
    )
  }

  const letzte = punkte[punkte.length - 1]
  const ende = letzte.kontostand >= startKapital
  const p = aktiv !== null ? punkte[aktiv] : null

  function hover(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const rx = ((e.clientX - rect.left) / rect.width) * breite
    const i = Math.round(((rx - rand.links) / (breite - rand.links - rand.rechts)) * (punkte.length - 1))
    setAktiv(Math.max(0, Math.min(punkte.length - 1, i)))
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${breite} ${hoehe}`}
        className="h-auto w-full"
        onMouseMove={hover}
        onMouseLeave={() => setAktiv(null)}
        role="img"
        aria-label="Equity-Kurve: Kontostand nach jedem Trade"
      >
        <path d={geo.flaeche} fill={ende ? '#22C55E' : '#EF4444'} opacity={0.08} />
        <line
          x1={rand.links}
          x2={breite - rand.rechts}
          y1={geo.y(startKapital)}
          y2={geo.y(startKapital)}
          stroke="#8B95A5"
          strokeDasharray="3 4"
          strokeWidth={1}
        />
        <path d={geo.pfad} fill="none" stroke={AKZENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {p && (
          <>
            <line x1={geo.x(p.index)} x2={geo.x(p.index)} y1={rand.oben} y2={hoehe - rand.unten} stroke="#8B95A5" strokeWidth={1} opacity={0.5} />
            <circle cx={geo.x(p.index)} cy={geo.y(p.kontostand)} r={4} fill={AKZENT} stroke="#131722" strokeWidth={2} />
          </>
        )}
        <text x={rand.links} y={hoehe - 6} fill="#8B95A5" fontSize={10}>
          Start {geld(startKapital)}
        </text>
        <text x={breite - rand.rechts} y={hoehe - 6} fill="#8B95A5" fontSize={10} textAnchor="end">
          nach {punkte.length - 1} Trades: {geld(letzte.kontostand)}
        </text>
      </svg>
      {p && (
        <div className="tabular-nums pointer-events-none absolute left-2 top-2 rounded-lg border border-rand bg-nacht/95 px-3 py-2 text-xs text-gedimmt">
          {p.trade ? (
            <>
              Trade {p.index}: <span className={p.trade.pnl >= 0 ? 'text-long' : 'text-short'}>{p.trade.pnl >= 0 ? '+' : ''}{geld(p.trade.pnl)}</span>{' '}
              ({p.trade.rMultiple >= 0 ? '+' : ''}{p.trade.rMultiple.toFixed(2)}R) · Konto <span className="text-white">{geld(p.kontostand)}</span>
            </>
          ) : (
            <>Start · Konto <span className="text-white">{geld(p.kontostand)}</span></>
          )}
        </div>
      )}
    </div>
  )
}
