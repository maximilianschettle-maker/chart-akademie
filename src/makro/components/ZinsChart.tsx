import { useMemo, useState } from 'react'
import type { EzbZinsPunkt, FedZinsPunkt } from '../types'
import { MARKER_FARBE } from '../termine'
import { fmtDatumKurz, fmtKorridor, fmtProzent } from '../format'

// Zinshistorie als schlichtes SVG (Treppenlinien): Fed-Korridor als Band, EZB-Einlagesatz
// als Linie. Kein lightweight-charts hier – das Widget soll den Erststart nicht belasten.

interface ZinsChartProps {
  fed: FedZinsPunkt[]
  ezb: EzbZinsPunkt[]
  /** rechter Rand der Zeitachse (ms) – kommt von außen, damit der Render rein bleibt */
  jetzt: number
  hoehe?: number
}

const ZEITRAEUME = [
  { id: '3J', jahre: 3 },
  { id: '5J', jahre: 5 },
  { id: '10J', jahre: 10 },
  { id: 'Alles', jahre: 0 },
] as const

type ZeitraumId = (typeof ZEITRAEUME)[number]['id']

function tag(iso: string): number {
  return Date.parse(iso)
}

/** Treppe: Werte gelten ab ihrem Datum bis zum nächsten Punkt; vor `von` greift der letzte ältere Wert */
function treppe<T extends { datum: string }>(punkte: T[], von: number, bis: number): T[] {
  const davor = punkte.filter((p) => tag(p.datum) <= von).at(-1)
  const drin = punkte.filter((p) => tag(p.datum) > von && tag(p.datum) <= bis)
  return davor ? [{ ...davor, datum: new Date(von).toISOString().slice(0, 10) }, ...drin] : drin
}

export function ZinsChart({ fed, ezb, jetzt, hoehe = 200 }: ZinsChartProps) {
  const [zeitraum, setZeitraum] = useState<ZeitraumId>('5J')
  const breite = 640
  const rand = { oben: 10, unten: 22, links: 36, rechts: 8 }

  const geo = useMemo(() => {
    const bis = jetzt
    const def = ZEITRAEUME.find((z) => z.id === zeitraum)!
    const fruehestes = Math.min(...[...fed, ...ezb].map((p) => tag(p.datum)).filter(Number.isFinite))
    const von = def.jahre > 0 ? bis - def.jahre * 365.25 * 86_400_000 : fruehestes
    const f = treppe(fed, von, bis)
    const e = treppe(ezb, von, bis)
    const werte = [...f.flatMap((p) => [p.oben, p.unten]), ...e.map((p) => p.einlage)]
    if (werte.length === 0) return null
    const min = Math.min(0, ...werte)
    const max = Math.max(...werte) + 0.5
    const innenB = breite - rand.links - rand.rechts
    const innenH = hoehe - rand.oben - rand.unten
    const x = (t: number) => rand.links + ((t - von) / (bis - von || 1)) * innenB
    const y = (v: number) => rand.oben + innenH - ((v - min) / (max - min || 1)) * innenH

    const treppenPfad = <T extends { datum: string }>(punkte: T[], wert: (p: T) => number) => {
      let d = ''
      for (let i = 0; i < punkte.length; i++) {
        const x0 = x(tag(punkte[i].datum))
        const x1 = i + 1 < punkte.length ? x(tag(punkte[i + 1].datum)) : x(bis)
        const yy = y(wert(punkte[i]))
        d += `${i === 0 ? 'M' : 'L'}${x0.toFixed(1)},${yy.toFixed(1)} L${x1.toFixed(1)},${yy.toFixed(1)} `
      }
      return d.trim()
    }
    // Band: Obergrenze vorwärts, Untergrenze rückwärts
    const oben = treppenPfad(f, (p) => p.oben)
    const untenPunkte: string[] = []
    for (let i = f.length - 1; i >= 0; i--) {
      const x0 = x(tag(f[i].datum))
      const x1 = i + 1 < f.length ? x(tag(f[i + 1].datum)) : x(bis)
      const yy = y(f[i].unten)
      untenPunkte.push(`L${x1.toFixed(1)},${yy.toFixed(1)} L${x0.toFixed(1)},${yy.toFixed(1)}`)
    }
    const band = oben && f.length ? `${oben} ${untenPunkte.join(' ')} Z` : ''

    // Jahres-Ticks
    const ticks: { x: number; text: string }[] = []
    const startJahr = new Date(von).getUTCFullYear() + 1
    const endJahr = new Date(bis).getUTCFullYear()
    const schritt = endJahr - startJahr > 12 ? 4 : endJahr - startJahr > 6 ? 2 : 1
    for (let j = startJahr; j <= endJahr; j += schritt) {
      const t = Date.UTC(j, 0, 1)
      if (t >= von && t <= bis) ticks.push({ x: x(t), text: String(j) })
    }
    const yTicks: number[] = []
    const ySchritt = max - min > 4 ? 1 : 0.5
    for (let v = Math.ceil(min / ySchritt) * ySchritt; v <= max; v += ySchritt) yTicks.push(Number(v.toFixed(2)))

    return { x, y, band, ezbPfad: treppenPfad(e, (p) => p.einlage), fedPfad: oben, ticks, yTicks, min, max, letzteFed: f.at(-1), letzteEzb: e.at(-1) }
  }, [fed, ezb, jetzt, zeitraum, hoehe, rand.links, rand.rechts, rand.oben, rand.unten])

  if (!geo) return <p className="py-6 text-center text-sm text-gedimmt">Keine Zinshistorie vorhanden.</p>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: MARKER_FARBE.fed, opacity: 0.7 }} />
            Fed Zielkorridor{geo.letzteFed && <span className="tabular-nums text-gedimmt"> {fmtKorridor(geo.letzteFed.unten, geo.letzteFed.oben)}</span>}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: MARKER_FARBE.ezb }} />
            EZB Einlagesatz{geo.letzteEzb && <span className="tabular-nums text-gedimmt"> {fmtProzent(geo.letzteEzb.einlage)} %</span>}
          </span>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Zeitraum">
          {ZEITRAEUME.map((z) => (
            <button
              key={z.id}
              type="button"
              role="tab"
              aria-selected={z.id === zeitraum}
              onClick={() => setZeitraum(z.id)}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${z.id === zeitraum ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'}`}
            >
              {z.id}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${breite} ${hoehe}`} className="mt-2 w-full" role="img" aria-label="Zinshistorie Fed und EZB">
        {geo.yTicks.map((v) => (
          <g key={v}>
            <line x1={rand.links} x2={breite - rand.rechts} y1={geo.y(v)} y2={geo.y(v)} stroke="#1F2733" strokeWidth={1} />
            <text x={rand.links - 4} y={geo.y(v) + 3} textAnchor="end" fontSize={10} fill="#8B95A5">
              {v.toLocaleString('de-DE', { minimumFractionDigits: ySchrittStellen(geo.yTicks) })}
            </text>
          </g>
        ))}
        {geo.ticks.map((t) => (
          <g key={t.text}>
            <line x1={t.x} x2={t.x} y1={rand.oben} y2={hoehe - rand.unten} stroke="#1F2733" strokeWidth={1} />
            <text x={t.x} y={hoehe - 8} textAnchor="middle" fontSize={10} fill="#8B95A5">
              {t.text}
            </text>
          </g>
        ))}
        {geo.band && <path d={geo.band} fill={MARKER_FARBE.fed} fillOpacity={0.28} stroke="none" />}
        {geo.fedPfad && <path d={geo.fedPfad} fill="none" stroke={MARKER_FARBE.fed} strokeWidth={1.5} />}
        {geo.ezbPfad && <path d={geo.ezbPfad} fill="none" stroke={MARKER_FARBE.ezb} strokeWidth={2} />}
      </svg>
      {(geo.letzteFed || geo.letzteEzb) && (
        <p className="mt-1 text-[11px] text-gedimmt">
          Gültigkeitsdaten laut FRED bzw. EZB-Datenportal
          {geo.letzteFed && ` · Fed zuletzt ${fmtDatumKurz(fed.at(-1)!.datum)}`}
          {geo.letzteEzb && ` · EZB zuletzt ${fmtDatumKurz(ezb.at(-1)!.datum)}`}
        </p>
      )}
    </div>
  )
}

function ySchrittStellen(ticks: number[]): number {
  return ticks.some((t) => !Number.isInteger(t)) ? 1 : 0
}
