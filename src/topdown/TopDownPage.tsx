import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Eraser, Layers, LoaderCircle, RectangleHorizontal, RotateCcw, X } from 'lucide-react'
import { ChartPanel } from '../components/chart/ChartPanel'
import { HandelsChart, type ChartBox } from '../components/chart/HandelsChart'
import { useSchmal } from '../hooks/useSchmal'
import { useTracker } from '../tracker/useTracker'
import { KNOPF, KNOPF_AKZENT, Kachel } from '../aktien/components/ui'
import { fmtKurs } from '../aktien/engine/format'
import type { Zeichnung } from '../types'
import { richtungAus, RICHTUNG_TEXT, type Richtung3, type RichtungErgebnis } from '../engine/richtung'
import { findeZonen, vergleicheZonen, type Zone, type ZonenVergleich } from '../engine/zonen'
import { letzterAtr } from '../engine/indikatoren/atr'
import { neueRunde, type Runde } from './daten'
import { topDownStatistik, useTopDownStore } from './store'

// Top-Down-Übung, Teil 1 (Schritt 4a): 1. Tageschart → Richtung wählen, Auflösung mit Begründung.
// 2. Stundenchart → Zonen als Bänder zeichnen, Vergleich mit der Zonen-Erkennung. Markt und Datum
// bleiben bis zur Auflösung verdeckt. Teil 2 (15-Minuten-Replay) folgt als Schritt 4b.

const INDIKATOREN = { ema: [20, 50], rsi: false, volumen: false }
const EMA_TAG = [20, 50]

type Schritt = 'laedt' | 'richtung' | 'richtungAufgeloest' | 'zonen' | 'zonenAufgeloest' | 'fehler'

function datumText(unixSek: number): string {
  return new Date(unixSek * 1000).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function TopDownPage() {
  const schmal = useSchmal()
  const tracker = useTracker()
  const runden = useTopDownStore((s) => s.runden)
  const rundeSpeichern = useTopDownStore((s) => s.rundeSpeichern)
  const stats = useMemo(() => topDownStatistik(runden), [runden])

  const [schritt, setSchritt] = useState<Schritt>('laedt')
  const [fehler, setFehler] = useState<string | null>(null)
  const [runde, setRunde] = useState<Runde | null>(null)
  const [wahl, setWahl] = useState<Richtung3 | null>(null)
  const [richtung, setRichtung] = useState<RichtungErgebnis | null>(null)
  const [zeichnungen, setZeichnungen] = useState<Zeichnung[]>([])
  const [modus, setModus] = useState<'zone' | 'aus'>('zone')
  const [zonen, setZonen] = useState<Zone[]>([])
  const [vergleich, setVergleich] = useState<ZonenVergleich | null>(null)

  const starten = useCallback(async () => {
    setSchritt('laedt')
    setFehler(null)
    setRunde(null)
    setWahl(null)
    setRichtung(null)
    setZeichnungen([])
    setZonen([])
    setVergleich(null)
    setModus('zone')
    try {
      const r = await neueRunde(tracker.daten)
      setRunde(r)
      setRichtung(richtungAus(r.tag))
      setSchritt('richtung')
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
      setSchritt('fehler')
    }
  }, [tracker.daten])

  // erste Runde, sobald die Tracker-Daten da sind (oder deren Laden gescheitert ist → Binance)
  useEffect(() => {
    if (schritt === 'laedt' && !runde && tracker.status !== 'laedt') void starten()
  }, [schritt, runde, tracker.status, starten])

  const richtungWaehlen = (r: Richtung3) => {
    setWahl(r)
    setSchritt('richtungAufgeloest')
  }

  const zonenPruefen = () => {
    if (!runde) return
    const z = findeZonen(runde.stunde)
    const atr = letzterAtr(runde.stunde, runde.stunde.length - 1, 14)
    const baender = zeichnungen.flatMap((x) => (x.typ === 'zone' ? [{ preisVon: x.preisVon, preisBis: x.preisBis }] : []))
    const v = vergleicheZonen(z, baender, 0.3 * atr)
    setZonen(z)
    setVergleich(v)
    setSchritt('zonenAufgeloest')
    setModus('aus')
    rundeSpeichern({
      am: Date.now(),
      instrument: runde.instrumentName,
      richtungRichtig: wahl === richtung?.richtung,
      zonenGetroffen: v.getroffen.length,
      zonenWichtig: z.filter((x) => x.wichtig).length,
      zonenUeberfluessig: v.ueberfluessig.length,
    })
  }

  const tagKerzen = useMemo(() => runde?.tag.slice(-150) ?? [], [runde])
  const stundeKerzen = useMemo(() => runde?.stunde ?? [], [runde])
  const boxen = useMemo((): ChartBox[] => {
    if (!runde || zonen.length === 0) return []
    const zeitVon = runde.stunde[Math.max(0, runde.stunde.length - 300)].time
    const zeitBis = runde.endeZeit + 3600 * 12
    return zonen
      .filter((z) => z.wichtig)
      .map((z) => ({ id: z.id, zeitVon, zeitBis, preisVon: z.von, preisBis: z.bis, fuellung: 'rgba(34,197,94,0.12)', rand: 'rgba(34,197,94,0.6)' }))
  }, [runde, zonen])

  const anzahlBaender = zeichnungen.filter((z) => z.typ === 'zone').length
  const richtigeRichtung = wahl !== null && wahl === richtung?.richtung
  const chip = (aktiv: boolean) => `tipp inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${aktiv ? 'bg-akzent text-nacht' : 'bg-nacht text-gedimmt hover:text-schrift'}`

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      <Link to="/training" className="inline-flex items-center gap-1 text-xs font-semibold text-gedimmt hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Lernpfad
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
          <Layers className="h-6 w-6 text-akzent" /> Top-Down-Analyse
        </h1>
        {stats.runden > 0 && (
          <span className="text-xs text-gedimmt">
            {stats.runden} Runden · Richtung {(stats.richtungQuote * 100).toFixed(0)} % · Zonen {(stats.zonenQuote * 100).toFixed(0)} %
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gedimmt">Erst die Richtung auf dem Tageschart, dann die Zonen auf dem Stundenchart. Markt und Datum bleiben bis zur Auflösung verdeckt.</p>

      {schritt === 'laedt' && (
        <p className="mt-6 inline-flex items-center gap-2 text-sm text-gedimmt">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Runde wird geladen …
        </p>
      )}
      {schritt === 'fehler' && (
        <div className="mt-6 rounded-xl border border-rand bg-flaeche p-4 text-sm">
          <p className="text-short">Keine Daten für eine Runde: {fehler}</p>
          <button type="button" onClick={() => void starten()} className={`${KNOPF} mt-3`}>
            <RotateCcw className="h-3.5 w-3.5" /> Nochmal versuchen
          </button>
        </div>
      )}

      {runde && schritt !== 'laedt' && schritt !== 'fehler' && (
        <>
          {/* Schritt 1: Richtung */}
          <section className="mt-5 rounded-xl border border-rand bg-flaeche p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-white">1. Tageschart: Welche Richtung?</h2>
            <p className="mt-0.5 text-xs text-gedimmt">Letzte 150 Tageskerzen mit EMA 20 und 50. {schritt === 'richtung' ? 'Entscheide nach Hochs und Tiefs.' : ''}</p>
            <div className="-mx-3 mt-3 sm:-mx-2">
              <ChartPanel candles={tagKerzen} hoehe={schmal ? 300 : 360} zeigeVolumen={false} emaPerioden={EMA_TAG} zeitSichtbar={false} kompakteBeschriftung />
            </div>
            {schritt === 'richtung' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(['auf', 'ab', 'seitwaerts'] as Richtung3[]).map((r) => (
                  <button key={r} type="button" onClick={() => richtungWaehlen(r)} className={KNOPF_AKZENT}>
                    {RICHTUNG_TEXT[r]}
                  </button>
                ))}
              </div>
            ) : (
              richtung && (
                <div className={`mt-3 rounded-lg border p-3 text-sm ${richtigeRichtung ? 'border-long/40 bg-long/10' : 'border-short/40 bg-short/10'}`}>
                  <p className="font-semibold text-white">
                    {richtigeRichtung ? <Check className="mr-1 inline h-4 w-4 text-long" /> : <X className="mr-1 inline h-4 w-4 text-short" />}
                    Du: {wahl ? RICHTUNG_TEXT[wahl] : '–'} · Auflösung: {RICHTUNG_TEXT[richtung.richtung]}
                  </p>
                  <p className="mt-1 text-schrift">{richtung.begruendung}</p>
                  {schritt === 'richtungAufgeloest' && (
                    <button type="button" onClick={() => setSchritt('zonen')} className={`${KNOPF_AKZENT} mt-3`}>
                      Weiter zu den Zonen
                    </button>
                  )}
                </div>
              )
            )}
          </section>

          {/* Schritt 2: Zonen */}
          {(schritt === 'zonen' || schritt === 'zonenAufgeloest') && (
            <section className="mt-4 rounded-xl border border-rand bg-flaeche p-3 sm:p-4">
              <h2 className="text-sm font-semibold text-white">2. Stundenchart: Zonen einzeichnen</h2>
              <p className="mt-0.5 text-xs text-gedimmt">
                Bänder an markanten Hochs und Tiefs, Range-Kanten und Ausgangspunkten starker Bewegungen. Zone = zwei Tipps in den Chart (obere und untere Kante).
              </p>
              {schritt === 'zonen' && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button type="button" className={chip(modus === 'zone')} onClick={() => setModus(modus === 'zone' ? 'aus' : 'zone')} aria-pressed={modus === 'zone'}>
                    <RectangleHorizontal className="h-3.5 w-3.5" /> Zone
                  </button>
                  <button type="button" className={chip(false)} onClick={() => setZeichnungen((z) => z.slice(0, -1))} disabled={zeichnungen.length === 0}>
                    <Eraser className="h-3.5 w-3.5" /> Letzte weg
                  </button>
                  <button type="button" className={chip(false)} onClick={() => setZeichnungen([])} disabled={zeichnungen.length === 0}>
                    Alle weg
                  </button>
                  <span className="text-[11px] text-gedimmt">
                    {anzahlBaender} {anzahlBaender === 1 ? 'Band' : 'Bänder'}
                  </span>
                </div>
              )}
              <div className="-mx-3 mt-3 sm:-mx-2">
                <HandelsChart
                  candles={stundeKerzen}
                  cursor={stundeKerzen.length - 1}
                  hoehe={schmal ? 360 : 440}
                  indikatoren={INDIKATOREN}
                  zeichnungen={zeichnungen}
                  zeichenModus={modus}
                  onZeichnung={(z) => setZeichnungen((alt) => [...alt, z])}
                  boxen={boxen}
                  kompakteBeschriftung
                />
              </div>
              {schritt === 'zonen' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={zonenPruefen} className={KNOPF_AKZENT} disabled={anzahlBaender === 0}>
                    Zonen prüfen
                  </button>
                  {anzahlBaender === 0 && <span className="text-xs text-gedimmt">Mindestens ein Band einzeichnen.</span>}
                </div>
              )}
              {schritt === 'zonenAufgeloest' && vergleich && (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <Kachel titel="Getroffen" wert={`${vergleich.getroffen.length} / ${zonen.filter((z) => z.wichtig).length}`} farbe={vergleich.quote >= 0.6 ? 'text-long' : vergleich.quote >= 0.3 ? 'text-akzent' : 'text-short'} hinweis="wichtige Zonen" />
                    <Kachel titel="Verfehlt" wert={String(vergleich.verfehlt.length)} farbe={vergleich.verfehlt.length ? 'text-short' : 'text-long'} />
                    <Kachel titel="Ohne Zone" wert={String(vergleich.ueberfluessig.length)} farbe={vergleich.ueberfluessig.length ? 'text-akzent' : 'text-long'} hinweis="deine Bänder" />
                  </div>
                  <p className="text-xs text-gedimmt">Grüne Boxen im Chart: die wichtigen Zonen der Erkennung. Deine Bänder bleiben sichtbar.</p>
                  {vergleich.getroffen.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-long">Getroffen</div>
                      <ul className="mt-1 space-y-0.5 text-xs text-schrift">
                        {vergleich.getroffen.map(({ zone }) => (
                          <li key={zone.id}>
                            <Check className="mr-1 inline h-3.5 w-3.5 text-long" />
                            {fmtKurs(zone.von, runde.waehrung)} – {fmtKurs(zone.bis, runde.waehrung)}: {zone.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {vergleich.verfehlt.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-short">Fehlt bei dir</div>
                      <ul className="mt-1 space-y-0.5 text-xs text-schrift">
                        {vergleich.verfehlt.map((zone) => (
                          <li key={zone.id}>
                            <X className="mr-1 inline h-3.5 w-3.5 text-short" />
                            {fmtKurs(zone.von, runde.waehrung)} – {fmtKurs(zone.bis, runde.waehrung)}: {zone.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(vergleich.nebensaechlich.length > 0 || vergleich.ueberfluessig.length > 0) && (
                    <div>
                      <div className="text-xs font-semibold text-akzent">Unwichtig oder ohne Zone</div>
                      <ul className="mt-1 space-y-0.5 text-xs text-schrift">
                        {vergleich.nebensaechlich.map(({ zone, band }, i) => (
                          <li key={`n${i}`}>
                            {fmtKurs(Math.min(band.preisVon, band.preisBis), runde.waehrung)} – {fmtKurs(Math.max(band.preisVon, band.preisBis), runde.waehrung)}: trifft nur eine schwache Zone ({zone.text})
                          </li>
                        ))}
                        {vergleich.ueberfluessig.map((band, i) => (
                          <li key={`u${i}`}>
                            {fmtKurs(Math.min(band.preisVon, band.preisBis), runde.waehrung)} – {fmtKurs(Math.max(band.preisVon, band.preisBis), runde.waehrung)}: dort hat die Erkennung nichts – welche Hochs oder Tiefs stützen das Band?
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-gedimmt">
                    Auflösung: {runde.instrumentName} ({runde.symbol}), Stand {datumText(runde.endeZeit)} · Quelle {runde.quelle === 'binance' ? 'Binance' : 'Tracker (Yahoo)'}
                  </p>
                  <button type="button" onClick={() => void starten()} className={KNOPF_AKZENT}>
                    <RotateCcw className="h-3.5 w-3.5" /> Nächste Runde
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
