import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Camera, Download, Plus, TriangleAlert } from 'lucide-react'
import { useJournalStore } from './store'
import { eintraegeAlsCsv, ergebnis, filtern, geschlosseneAlsTrades, planAbweichung, rMultiple, setupListe, setupName, tageslimitHinweis, tagVon, zeitKurz, type JournalFilter } from './engine'
import type { JournalEintrag } from './types'
import { logischeTrades, rVerteilung, fehlerMuster, gruppiere, kennzahlen } from '../engine/auswertung'
import { fmtR } from '../engine/format'
import { fmtKurs } from '../aktien/engine/format'
import { EINGABE, KNOPF, KNOPF_AKZENT, Kachel } from '../aktien/components/ui'
import { RVerteilung } from '../components/journal/RVerteilung'
import { Auswertungstabelle } from '../components/journal/Auswertungstabelle'
import { Fehlermuster } from '../components/journal/Fehlermuster'

// Journal-Reiter „Echte Trades“: offene Positionen, Tageslimit, Kennzahlen aus der bestehenden
// Auswertung (über die Abbildung auf Trade), Plan-Abweichung, Filter, Liste, CSV.

const ZEITRAEUME: { id: string; text: string; tage: number | null }[] = [
  { id: 'alle', text: 'Alle', tage: null },
  { id: '30', text: '30 Tage', tage: 30 },
  { id: '90', text: '90 Tage', tage: 90 },
  { id: '365', text: '1 Jahr', tage: 365 },
]

function rFarbe(r: number | null): string {
  if (r === null) return 'text-gedimmt'
  return r > 0 ? 'text-long' : r < 0 ? 'text-short' : 'text-gedimmt'
}

export function EintragZeile({ e }: { e: JournalEintrag }) {
  const r = rMultiple(e)
  const betrag = ergebnis(e)
  return (
    <li>
      <Link to={`/training/journal/${e.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-xs hover:bg-nacht/40">
        <span className="tabular-nums text-gedimmt">{zeitKurz(e.entryTime)}</span>
        <span className="font-semibold text-white">{e.markt}</span>
        <span className={`font-semibold ${e.richtung === 'long' ? 'text-long' : 'text-short'}`}>{e.richtung === 'long' ? 'Long' : 'Short'}</span>
        <span className="text-schrift">{setupName(e)}</span>
        <span className="text-gedimmt">{e.zeitrahmen}</span>
        {e.status === 'offen' ? (
          <span className="rounded bg-akzent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-akzent">offen</span>
        ) : (
          <span className={`tabular-nums font-semibold ${rFarbe(r)}`}>{r === null ? (e.stopLoss > 0 ? '–' : 'ohne Stop') : fmtR(r)}</span>
        )}
        {betrag !== null && <span className={`tabular-nums ${betrag >= 0 ? 'text-long' : 'text-short'}`}>{betrag >= 0 ? '+' : ''}{fmtKurs(betrag, e.waehrung)}</span>}
        {e.imPlan === false && <span className="text-[10px] uppercase tracking-wide text-short">außerhalb Plan</span>}
      </Link>
    </li>
  )
}

export function EchteTrades() {
  const eintraege = useJournalStore((s) => s.eintraege)
  const meldung = (useLocation().state as { meldung?: string } | null)?.meldung
  const setups = useMemo(() => setupListe(), [])
  // „jetzt“ einmal je Seitenaufruf – Filter und Tageslimit sollen beim Rendern stabil sein
  const [jetzt] = useState(() => Math.floor(Date.now() / 1000))
  const [markt, setMarkt] = useState('')
  const [strategieId, setStrategieId] = useState('')
  const [zeitraum, setZeitraum] = useState('alle')

  const filter = useMemo((): JournalFilter => {
    const tage = ZEITRAEUME.find((z) => z.id === zeitraum)?.tage ?? null
    return { markt: markt || undefined, strategieId: strategieId || undefined, von: tage ? jetzt - tage * 86_400 : undefined }
  }, [markt, strategieId, zeitraum, jetzt])
  const gefiltert = useMemo(() => filtern(eintraege, filter), [eintraege, filter])
  const offene = useMemo(() => eintraege.filter((e) => e.status === 'offen').sort((a, b) => b.entryTime - a.entryTime), [eintraege])
  const geschlossene = useMemo(() => gefiltert.filter((e) => e.status === 'geschlossen').sort((a, b) => (b.exitTime ?? b.entryTime) - (a.exitTime ?? a.entryTime)), [gefiltert])
  const logisch = useMemo(() => logischeTrades(geschlosseneAlsTrades(geschlossene)), [geschlossene])
  const stats = useMemo(() => kennzahlen(logisch, 0), [logisch])
  const bins = useMemo(() => rVerteilung(logisch), [logisch])
  const nachSetup = useMemo(() => gruppiere(logisch, (t) => (t.strategieId ? setupName({ strategieId: t.strategieId }) : 'Sonstiges')), [logisch])
  const nachMarkt = useMemo(() => {
    const name = new Map(geschlossene.map((e) => [e.id, e.markt]))
    return gruppiere(logisch, (t) => name.get(t.session) ?? '–')
  }, [logisch, geschlossene])
  const hinweise = useMemo(() => fehlerMuster(logisch), [logisch])
  const plan = useMemo(() => planAbweichung(geschlossene), [geschlossene])
  const heute = tageslimitHinweis(eintraege, tagVon(jetzt))
  const maerkte = useMemo(() => [...new Set(eintraege.map((e) => e.markt))].sort(), [eintraege])
  const summeBetrag = geschlossene.reduce((s, e) => s + (ergebnis(e) ?? 0), 0)
  const waehrung = geschlossene[0]?.waehrung ?? 'USD'

  function csv() {
    const blob = new Blob([eintraegeAlsCsv([...eintraege].sort((a, b) => a.entryTime - b.entryTime))], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chartakademie-journal-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/training/journal/neu" className={KNOPF_AKZENT}>
          <Plus className="h-3.5 w-3.5" /> Neuer Trade
        </Link>
        <Link to="/training/journal/screenshot" className={KNOPF} title="Positionen aus einem eToro-Screenshot übernehmen">
          <Camera className="h-3.5 w-3.5" /> Aus Screenshot
        </Link>
        <button type="button" onClick={csv} className={KNOPF} disabled={eintraege.length === 0}>
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {meldung && <p className="text-sm text-long">{meldung}</p>}

      {heute && (
        <p className="inline-flex items-start gap-2 rounded-xl border border-short/40 bg-short/10 px-3 py-2 text-sm text-short">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {heute}
        </p>
      )}

      {eintraege.length === 0 && (
        <p className="text-sm text-gedimmt">
          Noch kein echter Trade. Lege den ersten mit „Neuer Trade“ an, übernimm ihn aus einem eToro-Screenshot oder aus dem Trader-Chart (CRV-Rechner → „Ins Journal“).
        </p>
      )}

      {offene.length > 0 && (
        <section className="rounded-xl border border-rand bg-flaeche p-4">
          <h2 className="text-sm font-semibold text-white">Offen ({offene.length})</h2>
          <ul className="mt-1 divide-y divide-rand">
            {offene.map((e) => (
              <EintragZeile key={e.id} e={e} />
            ))}
          </ul>
        </section>
      )}

      {eintraege.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <select className={`${EINGABE} w-auto`} value={markt} onChange={(ev) => setMarkt(ev.target.value)} aria-label="Markt">
              <option value="">Alle Märkte</option>
              {maerkte.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select className={`${EINGABE} w-auto`} value={strategieId} onChange={(ev) => setStrategieId(ev.target.value)} aria-label="Setup">
              <option value="">Alle Setups</option>
              {setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select className={`${EINGABE} w-auto`} value={zeitraum} onChange={(ev) => setZeitraum(ev.target.value)} aria-label="Zeitraum">
              {ZEITRAEUME.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.text}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kachel titel="Geschlossene Trades" wert={String(logisch.length)} />
            <Kachel titel="Trefferquote" wert={`${stats.trefferquote.toFixed(0)} %`} />
            <Kachel titel="Ø R je Trade" wert={fmtR(stats.durchschnittR)} farbe={stats.durchschnittR >= 0 ? 'text-long' : 'text-short'} />
            <Kachel titel="Profit-Faktor" wert={Number.isFinite(stats.profitFaktor) ? stats.profitFaktor.toFixed(2) : '∞'} />
            <Kachel titel="Ø Gewinn / Ø Verlust" wert={`${fmtR(stats.durchschnittGewinnR)} / ${fmtR(stats.durchschnittVerlustR)}`} hinweis="in R" />
            <Kachel titel="Ergebnis gesamt" wert={`${summeBetrag >= 0 ? '+' : ''}${fmtKurs(summeBetrag, waehrung)}`} farbe={summeBetrag >= 0 ? 'text-long' : 'text-short'} hinweis="laut Broker, sonst R × Risiko" />
            <Kachel
              titel="Außerhalb des Plans"
              wert={plan.gesamt ? `${plan.ausserhalb} von ${plan.gesamt}` : '–'}
              hinweis={plan.ausserhalb ? `${fmtR(plan.summeRAusserhalb)} gesamt, im Plan ${fmtR(plan.summeRImPlan)}` : 'Feld „Im Plan?“ je Trade'}
              farbe={plan.ausserhalb && plan.summeRAusserhalb < 0 ? 'text-short' : undefined}
            />
            <Kachel titel="Längste Verlustserie" wert={String(stats.laengsteVerlustserie)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-rand bg-flaeche p-4">
              <h2 className="text-sm font-semibold text-white">R-Verteilung</h2>
              <p className="mb-3 text-xs text-gedimmt">Verlierer sollten um −1R liegen, Gewinner ab +1,5R.</p>
              <RVerteilung bins={bins} />
            </div>
            <Fehlermuster hinweise={hinweise} anzahlTrades={logisch.length} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Auswertungstabelle titel="Nach Setup" gruppen={nachSetup} hinweis="Welches Setup verdient bei dir Geld?" />
            <Auswertungstabelle titel="Nach Markt" gruppen={nachMarkt} />
          </div>

          <section className="rounded-xl border border-rand bg-flaeche p-4">
            <h2 className="text-sm font-semibold text-white">Geschlossen ({geschlossene.length})</h2>
            {geschlossene.length === 0 ? (
              <p className="mt-1 text-xs text-gedimmt">Kein geschlossener Trade im Filter.</p>
            ) : (
              <ul className="mt-1 divide-y divide-rand">
                {geschlossene.map((e) => (
                  <EintragZeile key={e.id} e={e} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
