import { fmtBetrag, fmtFaktor, fmtProzent } from '../engine/format'
import type { Kennzahlen } from '../engine/kennzahlen'
import { Kachel, vzFarbe } from './ui'

/** Kennzahlen in vier Gruppen: Bewertung, Profitabilität, Wachstum, Bilanz. */
export function KennzahlenKacheln({ k, waehrung, kursWaehrung, kursbezugMoeglich }: { k: Kennzahlen; waehrung: string; kursWaehrung?: string; kursbezugMoeglich: boolean }) {
  const jahr = k.jahr ? `GJ ${k.jahr}` : undefined
  return (
    <div className="space-y-4">
      <Gruppe titel="Bewertung" hinweis={!kursbezugMoeglich && kursWaehrung ? `Kurs in ${kursWaehrung}, Abschlüsse in ${waehrung}: nur Yahoo-Verhältnisse` : undefined}>
        <Kachel titel="KGV" wert={fmtFaktor(k.kgv)} hinweis="Kurs ÷ Gewinn je Aktie (TTM)" />
        <Kachel titel="KBV" wert={fmtFaktor(k.kbv)} hinweis="Kurs ÷ Buchwert" />
        <Kachel titel="KUV" wert={fmtFaktor(k.kuv)} hinweis="Marktkap. ÷ Umsatz" />
        <Kachel titel="EV / EBITDA" wert={fmtFaktor(k.evEbitda)} />
        <Kachel titel="FCF-Rendite" wert={fmtProzent(k.fcfRendite)} hinweis="Freier Cashflow ÷ Marktkap." />
        <Kachel titel="Dividendenrendite" wert={fmtProzent(k.dividendenrendite, 2)} />
      </Gruppe>
      <Gruppe titel="Profitabilität" hinweis={jahr}>
        <Kachel titel="Bruttomarge" wert={fmtProzent(k.bruttomarge)} />
        <Kachel titel="EBIT-Marge" wert={fmtProzent(k.ebitMarge)} />
        <Kachel titel="Nettomarge" wert={fmtProzent(k.nettomarge)} />
        <Kachel titel="FCF-Marge" wert={fmtProzent(k.fcfMarge)} />
        <Kachel titel="Eigenkapitalrendite" wert={fmtProzent(k.eigenkapitalrendite)} hinweis="Gewinn ÷ Eigenkapital" />
        <Kachel titel="Gesamtkapitalrendite" wert={fmtProzent(k.gesamtkapitalrendite)} hinweis="Gewinn ÷ Bilanzsumme" />
      </Gruppe>
      <Gruppe titel="Wachstum (p.a.)" hinweis="CAGR, nur bei durchgehend positiven Werten">
        <Kachel titel="Umsatz 1 J." wert={fmtProzent(k.umsatzWachstum1, 1, true)} farbe={vzFarbe(k.umsatzWachstum1)} />
        <Kachel titel="Umsatz 3 J." wert={fmtProzent(k.umsatzWachstum3, 1, true)} farbe={vzFarbe(k.umsatzWachstum3)} />
        <Kachel titel="Umsatz 5 J." wert={fmtProzent(k.umsatzWachstum5, 1, true)} farbe={vzFarbe(k.umsatzWachstum5)} />
        <Kachel titel="Umsatz 10 J." wert={fmtProzent(k.umsatzWachstum10, 1, true)} farbe={vzFarbe(k.umsatzWachstum10)} />
        <Kachel titel="Gewinn 3 J." wert={fmtProzent(k.gewinnWachstum3, 1, true)} farbe={vzFarbe(k.gewinnWachstum3)} />
        <Kachel titel="Gewinn 5 J." wert={fmtProzent(k.gewinnWachstum5, 1, true)} farbe={vzFarbe(k.gewinnWachstum5)} />
        <Kachel titel="FCF 5 J." wert={fmtProzent(k.fcfWachstum5, 1, true)} farbe={vzFarbe(k.fcfWachstum5)} />
        <Kachel titel="EPS 5 J." wert={fmtProzent(k.epsWachstum5, 1, true)} farbe={vzFarbe(k.epsWachstum5)} />
        <Kachel titel="Aktienzahl 5 J." wert={fmtProzent(k.aktienVeraenderung5, 1, true)} farbe={k.aktienVeraenderung5 === null ? 'text-white' : k.aktienVeraenderung5 <= 0 ? 'text-long' : 'text-short'} hinweis="gesamt, sinkend = Rückkäufe" />
      </Gruppe>
      <Gruppe titel="Bilanz & Ausschüttung" hinweis={jahr}>
        <Kachel titel="Eigenkapitalquote" wert={fmtProzent(k.eigenkapitalquote)} />
        <Kachel titel="Nettoverschuldung" wert={fmtBetrag(k.nettoverschuldung, waehrung)} hinweis="Finanzschulden − Kasse" farbe={k.nettoverschuldung !== null && k.nettoverschuldung < 0 ? 'text-long' : 'text-white'} />
        <Kachel titel="Nettoschulden / EBITDA" wert={fmtFaktor(k.nettoverschuldungZuEbitda)} hinweis="unter 2× ist entspannt" />
        <Kachel titel="Ausschüttungsquote" wert={fmtProzent(k.ausschuettungsquote)} hinweis="Dividende ÷ Gewinn" />
        <Kachel titel="Rückführung / FCF" wert={fmtProzent(k.kapitalrueckfuehrungZuFcf)} hinweis="Dividende + Rückkäufe ÷ FCF" />
      </Gruppe>
    </div>
  )
}

function Gruppe({ titel, hinweis, children }: { titel: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gedimmt">{titel}</h3>
        {hinweis && <span className="text-[11px] text-gedimmt">{hinweis}</span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  )
}
