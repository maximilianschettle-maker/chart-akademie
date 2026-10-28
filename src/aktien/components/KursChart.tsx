import { useEffect, useMemo, useState } from 'react'
import { ChartPanel } from '../../components/chart/ChartPanel'
import type { ChartAnnotation } from '../../types'
import { ladeChart } from '../data/service'
import { BEREICHE, chartVeraenderung, type ChartBereich } from '../engine/chart'
import { fmtKurs, fmtProzent, fmtZeitpunkt } from '../engine/format'
import type { KursChart as KursChartDaten } from '../types'
import { useMakro } from '../../makro/useMakro'
import { MARKER_FARBE, intervallAusKerzen, terminMarker } from '../../makro/termine'
import { vzFarbe } from './ui'

const HOEHE = 260
const KEINE_ANNOTATIONEN: ChartAnnotation[] = []
const ZINSEN_SCHLUESSEL = 'chartakademie-kurschart-zinsen'

function zinsenGespeichert(): boolean {
  try {
    return localStorage.getItem(ZINSEN_SCHLUESSEL) === '1'
  } catch {
    return false
  }
}

/** Kursverlauf mit Zeitraum-Wahl; Daten kommen über den Worker (Yahoo chart) und liegen im IndexedDB-Cache. */
export function KursChart({ symbol }: { symbol: string }) {
  const [bereich, setBereich] = useState<ChartBereich>('1J')
  const [daten, setDaten] = useState<KursChartDaten | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [zinsen, setZinsen] = useState(zinsenGespeichert)
  const makro = useMakro(60_000)

  useEffect(() => {
    let aktiv = true
    setLaeuft(true)
    setFehler(null)
    ladeChart(symbol, bereich)
      .then((d) => {
        if (aktiv) setDaten(d)
      })
      .catch((e: unknown) => {
        if (aktiv) setFehler(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (aktiv) setLaeuft(false)
      })
    return () => {
      aktiv = false
    }
  }, [symbol, bereich])

  const passend = daten?.symbol === symbol && daten?.bereich === bereich ? daten : null
  const v = useMemo(() => (passend ? chartVeraenderung(passend.kerzen) : null), [passend])
  const def = BEREICHE.find((b) => b.bereich === bereich)

  // Zinsentscheidungen (Fed/EZB) als Marker über den Kerzen — zuschaltbar
  const annotationen = useMemo((): ChartAnnotation[] => {
    if (!zinsen || !makro.daten || !passend) return KEINE_ANNOTATIONEN
    const zeiten = passend.kerzen.map((k) => k.time)
    const liste = terminMarker(makro.daten, zeiten, intervallAusKerzen(zeiten)).map(
      (m): ChartAnnotation => ({ typ: 'marker', time: m.zeit, position: 'aboveBar', form: 'circle', text: m.text, farbe: MARKER_FARBE[m.bank] }),
    )
    return liste.length ? liste : KEINE_ANNOTATIONEN
  }, [zinsen, makro.daten, passend])

  function zinsenUmschalten() {
    const neu = !zinsen
    setZinsen(neu)
    try {
      localStorage.setItem(ZINSEN_SCHLUESSEL, neu ? '1' : '0')
    } catch {
      // nur Komfort
    }
  }

  return (
    <section className="rounded-xl border border-rand bg-flaeche/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-white">Kursverlauf</h2>
          {v && passend && (
            <span className={`tabular-nums text-xs font-semibold ${vzFarbe(v.prozent)}`} title={`Schluss ${fmtKurs(v.start, passend.waehrung)} → ${fmtKurs(v.ende, passend.waehrung)}`}>
              {fmtProzent(v.prozent, 1, true)}
            </span>
          )}
          {laeuft && <span className="text-[11px] text-gedimmt">lädt …</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex gap-1" role="tablist" aria-label="Zeitraum">
            {BEREICHE.map((b) => (
              <button
                key={b.bereich}
                type="button"
                role="tab"
                aria-selected={b.bereich === bereich}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${b.bereich === bereich ? 'bg-akzent text-nacht' : 'bg-flaeche text-gedimmt hover:text-schrift'}`}
                onClick={() => setBereich(b.bereich)}
              >
                {b.titel}
              </button>
            ))}
          </div>
          <span className="mx-0.5 h-4 w-px bg-rand" />
          <button
            type="button"
            aria-pressed={zinsen}
            title="Fed- und EZB-Zinsentscheidungen im Chart markieren"
            className={`rounded-md px-2 py-1 text-xs font-semibold ${zinsen ? 'bg-akzent text-nacht' : 'bg-flaeche text-gedimmt hover:text-schrift'}`}
            onClick={zinsenUmschalten}
          >
            Zinsen
          </button>
        </div>
      </div>

      {passend && passend.kerzen.length > 0 ? (
        <div className="mt-3">
          <ChartPanel candles={passend.kerzen} annotationen={annotationen} hoehe={HOEHE} zeigeVolumen zeitSichtbar={false} randRechts={1} />
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-center rounded-lg bg-nacht text-xs text-gedimmt" style={{ height: HOEHE }}>
          {fehler ? <span className="text-short">{fehler}</span> : laeuft ? 'Kursdaten werden geladen …' : 'Keine Kursdaten'}
        </div>
      )}

      {passend && v && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gedimmt">
          <span>
            Hoch {fmtKurs(v.hoch, passend.waehrung)} · Tief {fmtKurs(v.tief, passend.waehrung)}
          </span>
          <span>{def?.intervall === '1d' ? 'Tageskerzen' : def?.intervall === '1wk' ? 'Wochenkerzen' : 'Monatskerzen'}</span>
          <span>Yahoo, Stand {fmtZeitpunkt(passend.standAm)}</span>
          {zinsen && (
            <span>
              <span style={{ color: MARKER_FARBE.fed }}>●</span> Fed <span style={{ color: MARKER_FARBE.ezb }}>●</span> EZB
              {!makro.daten && ' (Zinsdaten nicht geladen)'}
            </span>
          )}
          {fehler && <span className="text-short">{fehler}</span>}
        </p>
      )}
    </section>
  )
}
