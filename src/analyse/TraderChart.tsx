import { useEffect, useMemo, useState } from 'react'
import { Eraser, Minus, Ruler, Target, TrendingUp, RectangleHorizontal } from 'lucide-react'
import { HandelsChart, type ChartLinie, type ChartMarker, type ZeichenModus } from '../components/chart/HandelsChart'
import type { Candle } from '../types'
import type { Kerze } from '../aktien/types'
import { useAnsichtStore } from './ansichtStore'
import { KEINE_ZEICHNUNGEN, useZeichnungenStore } from './zeichnungenStore'
import { CrvRechner, type CrvFeld, type CrvWerte } from './CrvRechner'
import { rundePreis, stopAusProzent, zielAusR } from './crv'

// Trader-Ansicht des Kurscharts: HandelsChart (Kerzen, EMA/RSI/Volumen, Zeichenwerkzeuge, ziehbare Linien)
// plus Chance-Risiko-Rechner, dessen Einstieg/Stop/Ziel als Linien im Chart liegen.

interface Props {
  kerzen: Kerze[]
  symbol: string
  waehrung: string
  /** Kerzenintervall (Yahoo), Teil des Zeichnungs-Schlüssels */
  intervall: string
  zinsMarker: ChartMarker[]
  hoehe: number
}

const KEINE_MARKER: ChartMarker[] = []
const EMA_WAHL = [20, 50, 200]

function startWerte(kurs: number): CrvWerte {
  const entry = rundePreis(kurs)
  const stop = rundePreis(stopAusProzent(entry, 2, 'long'))
  return { richtung: 'long', entry, stop, ziel: rundePreis(zielAusR(entry, stop, 2, 'long')) }
}

export function TraderChart({ kerzen, symbol, waehrung, intervall, zinsMarker, hoehe }: Props) {
  const ema = useAnsichtStore((s) => s.ema)
  const rsi = useAnsichtStore((s) => s.rsi)
  const volumen = useAnsichtStore((s) => s.volumen)
  const setzen = useAnsichtStore((s) => s.setzen)
  const schluessel = `${symbol}|${intervall}`
  const zeichnungen = useZeichnungenStore((s) => s.je[schluessel] ?? KEINE_ZEICHNUNGEN)
  const zeichnungHinzu = useZeichnungenStore((s) => s.hinzu)
  const zeichnungenLoeschen = useZeichnungenStore((s) => s.loeschen)
  const [modus, setModus] = useState<ZeichenModus>('aus')
  const [crvAn, setCrvAn] = useState(false)
  const [pick, setPick] = useState<CrvFeld | null>(null)
  const letzterKurs = kerzen.length ? kerzen[kerzen.length - 1].close : 0
  const [crv, setCrv] = useState<CrvWerte>(() => startWerte(letzterKurs))
  const [crvSymbol, setCrvSymbol] = useState(symbol)
  // Neues Symbol: Rechner auf den aktuellen Kurs setzen (bewusst im Render, kein Effekt nötig)
  if (crvSymbol !== symbol && letzterKurs > 0) {
    setCrvSymbol(symbol)
    setCrv(startWerte(letzterKurs))
    setPick(null)
  }
  useEffect(() => {
    if (!crvAn) setPick(null)
  }, [crvAn])

  const indikatoren = useMemo(() => ({ ema, rsi, volumen }), [ema, rsi, volumen])
  const linien = useMemo((): ChartLinie[] => {
    if (!crvAn) return []
    return [
      { id: 'entry', preis: crv.entry, farbe: '#F59E0B', titel: 'Einstieg', ziehbar: true, fest: true, imBlick: true },
      { id: 'stop', preis: crv.stop, farbe: '#EF4444', titel: 'Stop', ziehbar: true, imBlick: true },
      { id: 'ziel', preis: crv.ziel, farbe: '#22C55E', titel: 'Ziel', ziehbar: true, imBlick: true },
    ]
  }, [crvAn, crv])

  const linieSetzen = (id: string, preis: number) => {
    if (id === 'entry' || id === 'stop' || id === 'ziel') setCrv((alt) => ({ ...alt, [id]: rundePreis(preis) }))
  }
  const onPick = pick
    ? (preis: number) => {
        setCrv((alt) => ({ ...alt, [pick]: rundePreis(preis) }))
        setPick(null)
      }
    : null

  const emaUmschalten = (p: number) => setzen({ ema: ema.includes(p) ? ema.filter((x) => x !== p) : [...ema, p].sort((a, b) => a - b) })
  const chip = (aktiv: boolean, extra = '') => `tipp inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'} ${extra}`

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {EMA_WAHL.map((p) => (
          <button key={p} type="button" className={chip(ema.includes(p))} onClick={() => emaUmschalten(p)} aria-pressed={ema.includes(p)}>
            EMA {p}
          </button>
        ))}
        <button type="button" className={chip(rsi)} onClick={() => setzen({ rsi: !rsi })} aria-pressed={rsi}>
          RSI
        </button>
        <button type="button" className={chip(volumen)} onClick={() => setzen({ volumen: !volumen })} aria-pressed={volumen}>
          Vol
        </button>
        <span className="mx-0.5 h-4 w-px bg-rand" />
        <button type="button" className={chip(modus === 'linie')} onClick={() => setModus(modus === 'linie' ? 'aus' : 'linie')} title="Horizontale Linie (ein Tipp)">
          <Minus className="h-3.5 w-3.5" /> Linie
        </button>
        <button type="button" className={chip(modus === 'zone')} onClick={() => setModus(modus === 'zone' ? 'aus' : 'zone')} title="Zone (zwei Tipps)">
          <RectangleHorizontal className="h-3.5 w-3.5" /> Zone
        </button>
        <button type="button" className={chip(modus === 'trend')} onClick={() => setModus(modus === 'trend' ? 'aus' : 'trend')} title="Trendlinie (zwei Tipps)">
          <TrendingUp className="h-3.5 w-3.5" /> Trend
        </button>
        <button type="button" className={chip(modus === 'messen')} onClick={() => setModus(modus === 'messen' ? 'aus' : 'messen')} title="Abstand messen (zwei Tipps)">
          <Ruler className="h-3.5 w-3.5" /> Messen
        </button>
        {zeichnungen.length > 0 && (
          <button type="button" className={chip(false)} onClick={() => zeichnungenLoeschen(schluessel)} title="Alle Zeichnungen dieses Symbols löschen">
            <Eraser className="h-3.5 w-3.5" /> {zeichnungen.length}
          </button>
        )}
        <span className="mx-0.5 h-4 w-px bg-rand" />
        <button type="button" className={chip(crvAn)} onClick={() => setCrvAn((a) => !a)} aria-pressed={crvAn} title="Einstieg, Stop und Ziel als Linien im Chart, Stückzahl und CRV darunter">
          <Target className="h-3.5 w-3.5" /> CRV
        </button>
      </div>
      {modus !== 'aus' && (
        <p className="mb-2 text-[11px] text-akzent">
          {modus === 'linie' && 'Tippe in den Chart, um eine horizontale Linie zu setzen.'}
          {modus === 'zone' && 'Zwei Tipps in den Chart: obere und untere Kante der Zone.'}
          {modus === 'trend' && 'Zwei Tipps in den Chart (z.B. zwei Tiefs) – die Linie wird nach rechts verlängert.'}
          {modus === 'messen' && 'Zwei Tipps in den Chart: Start und Ende der Messung.'}
        </p>
      )}
      <HandelsChart
        candles={kerzen as Candle[]}
        cursor={kerzen.length - 1}
        hoehe={hoehe}
        indikatoren={indikatoren}
        zeichnungen={zeichnungen}
        zeichenModus={modus}
        onZeichnung={(z) => zeichnungHinzu(schluessel, z)}
        linien={linien}
        onLinieZiehen={linieSetzen}
        onLinieLos={linieSetzen}
        onPick={onPick}
        marker={zinsMarker.length ? zinsMarker : KEINE_MARKER}
      />
      {crvAn && (
        <div className="mt-3">
          <CrvRechner werte={crv} waehrung={waehrung} onWerte={setCrv} pick={pick} onPick={setPick} />
        </div>
      )}
    </div>
  )
}
