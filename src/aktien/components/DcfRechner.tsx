import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { DCF_STANDARD, dcf, dcfBasisAus, sensitivitaet, stufenUm } from '../engine/dcf'
import { fmtBetrag, fmtKurs, fmtProzent } from '../engine/format'
import { useAktienStore } from '../store'
import type { DcfAnnahmen, Fundamentaldaten } from '../types'
import { EINGABE, KNOPF, Kachel } from './ui'

const FELDER: { key: keyof DcfAnnahmen; titel: string; einheit: string; schritt: number; hinweis: string }[] = [
  { key: 'basisJahre', titel: 'FCF-Basis', einheit: 'Jahre Ø', schritt: 1, hinweis: 'Durchschnitt der letzten n Geschäftsjahre (glättet Ausreißer)' },
  { key: 'wachstum1', titel: 'Wachstum Phase 1', einheit: '% p.a.', schritt: 0.5, hinweis: 'Realistisch am Umsatz-/FCF-Wachstum der letzten Jahre orientieren' },
  { key: 'jahre1', titel: 'Dauer Phase 1', einheit: 'Jahre', schritt: 1, hinweis: '' },
  { key: 'wachstum2', titel: 'Wachstum Phase 2', einheit: '% p.a.', schritt: 0.5, hinweis: 'Abflachung Richtung Marktwachstum' },
  { key: 'jahre2', titel: 'Dauer Phase 2', einheit: 'Jahre', schritt: 1, hinweis: '' },
  { key: 'diskontsatz', titel: 'Diskontsatz', einheit: '%', schritt: 0.5, hinweis: 'Deine geforderte Rendite; 8–10 % für solide Firmen, mehr bei Risiko' },
  { key: 'endwachstum', titel: 'Ewiges Wachstum', einheit: '%', schritt: 0.25, hinweis: 'Für den Endwert; höchstens Inflation + etwas (2–3 %)' },
  { key: 'sicherheitsmarge', titel: 'Sicherheitsmarge', einheit: '%', schritt: 5, hinweis: 'Abschlag auf den fairen Wert für den Kaufkurs' },
]

/** Zwei-Phasen-DCF mit gespeicherten Annahmen je Firma und Sensitivitätsmatrix. */
export function DcfRechner({ daten }: { daten: Fundamentaldaten }) {
  const symbol = daten.firma.symbol
  const gespeichert = useAktienStore((s) => s.dcfAnnahmen[symbol])
  const dcfSetzen = useAktienStore((s) => s.dcfSetzen)
  const annahmen = gespeichert ?? DCF_STANDARD
  const waehrung = daten.firma.waehrung
  const kurs = daten.kurs
  const kursVergleichbar = kurs !== null && kurs.waehrung === waehrung

  const basis = useMemo(() => dcfBasisAus(daten.jahre, kursVergleichbar ? kurs?.aktienAnzahl : undefined), [daten.jahre, kurs, kursVergleichbar])
  const ergebnis = useMemo(() => (basis ? dcf(basis, annahmen) : null), [basis, annahmen])
  const matrix = useMemo(() => {
    if (!basis) return null
    return { w: stufenUm(annahmen.wachstum1, 2.5), d: stufenUm(annahmen.diskontsatz, 1), werte: sensitivitaet(basis, annahmen, stufenUm(annahmen.wachstum1, 2.5), stufenUm(annahmen.diskontsatz, 1)) }
  }, [basis, annahmen])

  if (!basis) {
    return <p className="text-sm text-gedimmt">Für den DCF fehlen freier Cashflow oder Aktienzahl in den Abschlüssen.</p>
  }

  function setze(key: keyof DcfAnnahmen, text: string) {
    const n = Number(text.replace(',', '.'))
    if (!Number.isFinite(n)) return
    dcfSetzen(symbol, { ...annahmen, [key]: n })
  }

  const abstand = ergebnis && kursVergleichbar && kurs ? ergebnis.fairerWertJeAktie / kurs.preis - 1 : null

  return (
    <div className="space-y-5">
      <p className="text-xs text-gedimmt">
        Freier Cashflow der letzten Jahre wird mit deinen Annahmen fortgeschrieben, auf heute abgezinst, um Nettoschulden bereinigt und durch die Aktienzahl geteilt. Das
        Ergebnis ist so gut wie die Annahmen — deshalb die Matrix unten.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {FELDER.map((f) => (
          <label key={f.key} className="text-xs text-gedimmt">
            {f.titel} <span className="text-[10px]">({f.einheit})</span>
            <input className={`mt-1 ${EINGABE}`} type="number" step={f.schritt} inputMode="decimal" value={annahmen[f.key]} onChange={(e) => setze(f.key, e.target.value)} />
            {f.hinweis && <span className="mt-0.5 block text-[11px]">{f.hinweis}</span>}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={KNOPF} onClick={() => dcfSetzen(symbol, null)} disabled={!gespeichert}>
          <RotateCcw className="h-3.5 w-3.5" /> Standardannahmen
        </button>
        <span className="text-[11px] text-gedimmt">
          Basis-FCF {fmtBetrag(ergebnis?.basisFcf ?? null, waehrung)} · Nettoschulden {fmtBetrag(basis.nettoschulden, waehrung)} · {fmtBetrag(basis.aktien, '', 2)} Aktien
        </span>
      </div>

      {ergebnis ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kachel titel="Fairer Wert je Aktie" wert={fmtKurs(ergebnis.fairerWertJeAktie, waehrung)} />
            <Kachel titel={`Kaufkurs (−${annahmen.sicherheitsmarge} %)`} wert={fmtKurs(ergebnis.kaufkursMitMarge, waehrung)} farbe="text-akzent" />
            <Kachel
              titel="Aktueller Kurs"
              wert={kurs ? fmtKurs(kurs.preis, kurs.waehrung) : '–'}
              hinweis={abstand === null ? (kurs ? 'andere Währung, kein Vergleich' : undefined) : abstand >= 0 ? `${fmtProzent(abstand, 0)} unter fairem Wert` : `${fmtProzent(-abstand, 0)} über fairem Wert`}
              farbe={abstand === null ? 'text-white' : abstand >= 0 ? 'text-long' : 'text-short'}
            />
            <Kachel titel="Endwert-Anteil" wert={fmtProzent(ergebnis.endwertAnteil, 0)} hinweis="über 75 % = Ergebnis hängt fast nur an der Ewigkeit" farbe={ergebnis.endwertAnteil > 0.75 ? 'text-akzent' : 'text-white'} />
          </div>

          {matrix && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gedimmt">Sensitivität: Wachstum Phase 1 × Diskontsatz</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-center text-xs tabular-nums">
                  <thead>
                    <tr className="text-[10px] text-gedimmt">
                      <th className="py-1 text-left">Wachstum ↓ · Diskont →</th>
                      {matrix.d.map((d) => (
                        <th key={d} className="py-1">
                          {d} %
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.w.map((w, i) => (
                      <tr key={w} className="border-t border-rand/40">
                        <td className="py-1 text-left text-gedimmt">{w} %</td>
                        {matrix.werte[i].map((v, j) => {
                          const mitte = i === 2 && j === 2
                          const unterKurs = v !== null && kursVergleichbar && kurs ? v >= kurs.preis : null
                          return (
                            <td key={j} className={`py-1 ${mitte ? 'rounded bg-flaeche font-semibold text-white' : unterKurs === null ? 'text-schrift' : unterKurs ? 'text-long' : 'text-short'}`}>
                              {v === null ? '–' : fmtKurs(v)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-gedimmt">Grün: fairer Wert über dem Kurs, rot: darunter. Mitte = deine Annahmen.</p>
            </div>
          )}

          <details className="text-xs text-gedimmt">
            <summary className="cursor-pointer hover:text-schrift">Rechenweg je Jahr</summary>
            <table className="mt-2 w-full text-right tabular-nums">
              <thead>
                <tr className="text-[10px] uppercase">
                  <th className="py-1 text-left">Jahr</th>
                  <th className="py-1">FCF</th>
                  <th className="py-1">Barwert</th>
                </tr>
              </thead>
              <tbody>
                {ergebnis.jahre.map((j) => (
                  <tr key={j.jahr} className="border-t border-rand/30">
                    <td className="py-0.5 text-left">{j.jahr}</td>
                    <td className="py-0.5">{fmtBetrag(j.fcf, '', 2)}</td>
                    <td className="py-0.5">{fmtBetrag(j.barwert, '', 2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-rand/30">
                  <td className="py-0.5 text-left">Endwert (abgezinst)</td>
                  <td className="py-0.5">{fmtBetrag(ergebnis.endwert, '', 2)}</td>
                  <td className="py-0.5">{fmtBetrag(ergebnis.endwertBarwert, '', 2)}</td>
                </tr>
                <tr className="border-t border-rand text-schrift">
                  <td className="py-0.5 text-left">Unternehmenswert − Nettoschulden = Eigenkapitalwert</td>
                  <td className="py-0.5">{fmtBetrag(ergebnis.unternehmenswert, '', 2)}</td>
                  <td className="py-0.5">{fmtBetrag(ergebnis.eigenkapitalwert, '', 2)}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="text-sm text-short">Diskontsatz muss klar über dem ewigen Wachstum liegen.</p>
      )}
    </div>
  )
}
