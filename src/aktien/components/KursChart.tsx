import { useEffect, useMemo, useState } from 'react'
import { ChartPanel, type OverlayLinie } from '../../components/chart/ChartPanel'
import type { ChartMarker } from '../../components/chart/HandelsChart'
import type { ChartAnnotation } from '../../types'
import { ladeChart } from '../data/service'
import { BEREICHE, chartVeraenderung, type ChartBereich } from '../engine/chart'
import { fmtKurs, fmtProzent, fmtZeitpunkt } from '../engine/format'
import type { Kennzahlen } from '../engine/kennzahlen'
import type { KursChart as KursChartDaten } from '../types'
import { useMakro } from '../../makro/useMakro'
import { MARKER_FARBE, intervallAusKerzen, terminMarker } from '../../makro/termine'
import { useAnsichtStore, type Ansicht } from '../../analyse/ansichtStore'
import { TraderChart } from '../../analyse/TraderChart'
import { InvestorKennzahlen } from '../../analyse/InvestorKennzahlen'
import { bankFuerWaehrung, leitzinsPunkte, leitzinsTitel } from '../../analyse/leitzins'
import { useSchmal } from '../../hooks/useSchmal'
import { vzFarbe } from './ui'

// Kursverlauf der Firmenseite in zwei Ansichten (Phase 3):
//   Trader   – Kerzen (HandelsChart) mit Intraday- und Tageszeiträumen, EMA/RSI/Volumen, Zeichnen, CRV-Rechner
//   Investor – Schlusskurs-Linie über Jahre, Log-Skala, Leitzins-Overlay, Kennzahlen direkt darunter
// Daten kommen in beiden Fällen über den Worker (Yahoo chart) und liegen im IndexedDB-Cache.

const KEINE_ANNOTATIONEN: ChartAnnotation[] = []
const KEINE_MARKER: ChartMarker[] = []
const ZINSEN_SCHLUESSEL = 'chartakademie-kurschart-zinsen'

const BEREICHE_JE: Record<Ansicht, ChartBereich[]> = {
  trader: ['1T', '5T', '1M', '6M', '1J'],
  investor: ['1J', '5J', 'MAX'],
}
const STANDARD_JE: Record<Ansicht, ChartBereich> = { trader: '6M', investor: '5J' }

const INTERVALL_TEXT: Record<string, string> = { '5m': '5-Minuten-Kerzen', '15m': '15-Minuten-Kerzen', '1d': 'Tageskerzen', '1wk': 'Wochenkerzen', '1mo': 'Monatskerzen' }

function zinsenGespeichert(): boolean {
  try {
    return localStorage.getItem(ZINSEN_SCHLUESSEL) === '1'
  } catch {
    return false
  }
}

interface Props {
  symbol: string
  /** für die Investor-Kennzahlen unter dem Chart */
  kennzahlen?: Kennzahlen | null
}

export function KursChart({ symbol, kennzahlen = null }: Props) {
  const ansicht = useAnsichtStore((s) => s.ansicht)
  const leitzins = useAnsichtStore((s) => s.leitzins)
  const setzen = useAnsichtStore((s) => s.setzen)
  const schmal = useSchmal()
  const [bereichJe, setBereichJe] = useState<Record<Ansicht, ChartBereich>>({ ...STANDARD_JE })
  const bereich = bereichJe[ansicht]
  const [daten, setDaten] = useState<KursChartDaten | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [zinsen, setZinsen] = useState(zinsenGespeichert)
  const makro = useMakro(60_000)
  const hoehe = ansicht === 'trader' ? (schmal ? 320 : 400) : schmal ? 240 : 280

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

  // Zinsentscheidungen (Fed/EZB) als Marker über den Kerzen — zuschaltbar, in beiden Ansichten
  const termine = useMemo(() => {
    if (!zinsen || !makro.daten || !passend) return []
    const zeiten = passend.kerzen.map((k) => k.time)
    return terminMarker(makro.daten, zeiten, intervallAusKerzen(zeiten))
  }, [zinsen, makro.daten, passend])
  const annotationen = useMemo((): ChartAnnotation[] => {
    const liste = termine.map((m): ChartAnnotation => ({ typ: 'marker', time: m.zeit, position: 'aboveBar', form: 'circle', text: m.text, farbe: MARKER_FARBE[m.bank] }))
    return liste.length ? liste : KEINE_ANNOTATIONEN
  }, [termine])
  const zinsMarker = useMemo((): ChartMarker[] => {
    const liste = termine.map((m): ChartMarker => ({ time: m.zeit, art: 'hinweis', text: m.text, farbe: MARKER_FARBE[m.bank], oben: true }))
    return liste.length ? liste : KEINE_MARKER
  }, [termine])

  // Investor: Leitzins als Treppenlinie auf der linken Achse
  const overlay = useMemo((): OverlayLinie | null => {
    if (ansicht !== 'investor' || !leitzins || !passend || passend.kerzen.length === 0 || !makro.daten) return null
    const bank = bankFuerWaehrung(passend.waehrung)
    const punkte = leitzinsPunkte(makro.daten, bank, passend.kerzen[0].time, passend.kerzen[passend.kerzen.length - 1].time)
    return punkte.length ? { punkte, farbe: MARKER_FARBE[bank], titel: leitzinsTitel(bank) } : null
  }, [ansicht, leitzins, passend, makro.daten])

  function zinsenUmschalten() {
    const neu = !zinsen
    setZinsen(neu)
    try {
      localStorage.setItem(ZINSEN_SCHLUESSEL, neu ? '1' : '0')
    } catch {
      // nur Komfort
    }
  }

  const knopf = (aktiv: boolean) => `tipp rounded-md px-2.5 py-1 text-xs font-semibold ${aktiv ? 'bg-akzent text-nacht' : 'bg-flaeche text-gedimmt hover:text-schrift'}`

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
            {BEREICHE.filter((b) => BEREICHE_JE[ansicht].includes(b.bereich)).map((b) => (
              <button key={b.bereich} type="button" role="tab" aria-selected={b.bereich === bereich} className={knopf(b.bereich === bereich)} onClick={() => setBereichJe((alt) => ({ ...alt, [ansicht]: b.bereich }))}>
                {b.titel}
              </button>
            ))}
          </div>
          <span className="mx-0.5 h-4 w-px bg-rand" />
          <button type="button" aria-pressed={zinsen} title="Fed- und EZB-Zinsentscheidungen im Chart markieren" className={knopf(zinsen)} onClick={zinsenUmschalten}>
            Zinsentscheide
          </button>
          {ansicht === 'investor' && (
            <button type="button" aria-pressed={leitzins} title="Leitzins (Fed Funds bzw. EZB-Einlagesatz) als Linie auf der linken Achse" className={knopf(leitzins)} onClick={() => setzen({ leitzins: !leitzins })}>
              Leitzins
            </button>
          )}
        </div>
      </div>

      {passend && passend.kerzen.length > 0 ? (
        <div className="mt-3">
          {ansicht === 'trader' ? (
            <TraderChart kerzen={passend.kerzen} symbol={symbol} waehrung={passend.waehrung} intervall={def?.intervall ?? '1d'} zinsMarker={zinsMarker} hoehe={hoehe} />
          ) : (
            <ChartPanel candles={passend.kerzen} annotationen={annotationen} hoehe={hoehe} zeigeVolumen={false} zeitSichtbar={false} randRechts={1} typ="linie" logSkala overlay={overlay} />
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-center rounded-lg bg-nacht text-xs text-gedimmt" style={{ height: hoehe }}>
          {fehler ? <span className="text-short">{fehler}</span> : laeuft ? 'Kursdaten werden geladen …' : 'Keine Kursdaten'}
        </div>
      )}

      {passend && v && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gedimmt">
          <span>
            Hoch {fmtKurs(v.hoch, passend.waehrung)} · Tief {fmtKurs(v.tief, passend.waehrung)}
          </span>
          <span>{INTERVALL_TEXT[def?.intervall ?? ''] ?? def?.intervall}</span>
          {ansicht === 'investor' && <span>Log-Skala</span>}
          <span>
            Yahoo, Stand {fmtZeitpunkt(passend.standAm)}
            {passend.veraltet && <span className="text-akzent"> (veraltet)</span>}
          </span>
          {zinsen && (
            <span>
              <span style={{ color: MARKER_FARBE.fed }}>●</span> Fed <span style={{ color: MARKER_FARBE.ezb }}>●</span> EZB
              {!makro.daten && ' (Zinsdaten nicht geladen)'}
            </span>
          )}
          {def?.intraday && <span>Zeitachse in UTC</span>}
          {fehler && <span className="text-short">{fehler}</span>}
        </p>
      )}

      {ansicht === 'investor' && kennzahlen && (
        <div className="mt-3">
          <InvestorKennzahlen k={kennzahlen} />
        </div>
      )}
    </section>
  )
}
