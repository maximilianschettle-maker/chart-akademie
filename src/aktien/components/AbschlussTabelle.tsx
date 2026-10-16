import { useState } from 'react'
import { fmtBetrag, fmtKurs, fmtProzent, fmtStueck } from '../engine/format'
import type { Abschluss, AbschlussFeld } from '../types'
import { QuellenBadge } from './ui'

interface ZeilenDef {
  feld: AbschlussFeld | 'bruttomarge' | 'ebitMarge' | 'nettomarge' | 'fcfMarge'
  titel: string
  art: 'geld' | 'jeAktie' | 'stueck' | 'prozent'
}

const GRUPPEN: { titel: string; zeilen: ZeilenDef[] }[] = [
  {
    titel: 'Gewinn- und Verlustrechnung',
    zeilen: [
      { feld: 'umsatz', titel: 'Umsatz', art: 'geld' },
      { feld: 'bruttogewinn', titel: 'Bruttogewinn', art: 'geld' },
      { feld: 'bruttomarge', titel: 'Bruttomarge', art: 'prozent' },
      { feld: 'ebit', titel: 'EBIT', art: 'geld' },
      { feld: 'ebitMarge', titel: 'EBIT-Marge', art: 'prozent' },
      { feld: 'ebitda', titel: 'EBITDA', art: 'geld' },
      { feld: 'nettogewinn', titel: 'Nettogewinn', art: 'geld' },
      { feld: 'nettomarge', titel: 'Nettomarge', art: 'prozent' },
      { feld: 'epsVerwaessert', titel: 'Gewinn je Aktie (verw.)', art: 'jeAktie' },
      { feld: 'aktienVerwaessert', titel: 'Aktien (verw., Ø)', art: 'stueck' },
    ],
  },
  {
    titel: 'Bilanz',
    zeilen: [
      { feld: 'bilanzsumme', titel: 'Bilanzsumme', art: 'geld' },
      { feld: 'eigenkapital', titel: 'Eigenkapital', art: 'geld' },
      { feld: 'finanzschulden', titel: 'Finanzschulden', art: 'geld' },
      { feld: 'zahlungsmittel', titel: 'Zahlungsmittel', art: 'geld' },
      { feld: 'aktienAusstehend', titel: 'Aktien ausstehend', art: 'stueck' },
    ],
  },
  {
    titel: 'Cashflow',
    zeilen: [
      { feld: 'operativerCashflow', titel: 'Operativer Cashflow', art: 'geld' },
      { feld: 'capex', titel: 'Investitionen (Capex)', art: 'geld' },
      { feld: 'freierCashflow', titel: 'Freier Cashflow', art: 'geld' },
      { feld: 'fcfMarge', titel: 'FCF-Marge', art: 'prozent' },
      { feld: 'dividenden', titel: 'Dividenden gezahlt', art: 'geld' },
      { feld: 'rueckkaeufe', titel: 'Aktienrückkäufe', art: 'geld' },
    ],
  },
]

function wertVon(a: Abschluss, z: ZeilenDef): number | null {
  switch (z.feld) {
    case 'bruttomarge':
      return a.umsatz ? (a.bruttogewinn ?? 0) / a.umsatz : null
    case 'ebitMarge':
      return a.umsatz && a.ebit !== null ? a.ebit / a.umsatz : null
    case 'nettomarge':
      return a.umsatz && a.nettogewinn !== null ? a.nettogewinn / a.umsatz : null
    case 'fcfMarge':
      return a.umsatz && a.freierCashflow !== null ? a.freierCashflow / a.umsatz : null
    default:
      return a[z.feld]
  }
}

function formatiert(v: number | null, z: ZeilenDef, waehrung: string): string {
  if (z.art === 'prozent') return fmtProzent(v)
  if (z.art === 'jeAktie') return fmtKurs(v, waehrung)
  if (z.art === 'stueck') return fmtStueck(v)
  return fmtBetrag(v, '', 2)
}

/** Mehrjahres-Tabelle: neueste Periode links, horizontal scrollbar; Jahr/Quartal umschaltbar. */
export function AbschlussTabelle({ jahre, quartale, waehrung }: { jahre: Abschluss[]; quartale: Abschluss[]; waehrung: string }) {
  const [modus, setModus] = useState<'FY' | 'Q'>('FY')
  const perioden = [...(modus === 'FY' ? jahre : quartale)].sort((a, b) => b.ende.localeCompare(a.ende)).slice(0, modus === 'FY' ? 15 : 12)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-nacht p-0.5 text-xs">
          {(['FY', 'Q'] as const).map((m) => (
            <button key={m} type="button" className={`rounded-md px-3 py-1 ${modus === m ? 'bg-flaeche text-white' : 'text-gedimmt hover:text-schrift'}`} onClick={() => setModus(m)}>
              {m === 'FY' ? 'Geschäftsjahre' : 'Quartale'}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gedimmt">Beträge in {waehrung}, Mio./Mrd. · neueste Periode links</span>
      </div>
      {perioden.length === 0 ? (
        <p className="py-4 text-center text-xs text-gedimmt">Keine {modus === 'FY' ? 'Jahres' : 'Quartals'}daten.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-rand text-[10px] uppercase tracking-wide text-gedimmt">
                <th className="sticky left-0 bg-flaeche py-1.5 pr-3">Posten</th>
                {perioden.map((p) => (
                  <th key={p.ende} className="py-1.5 pr-3 text-right whitespace-nowrap">
                    {modus === 'FY' ? `GJ ${p.geschaeftsjahr}` : `Q${p.quartal} ${p.geschaeftsjahr}`}
                    <div className="font-normal normal-case tracking-normal">{p.ende.slice(0, 7)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {GRUPPEN.map((g) => (
                <GruppeZeilen key={g.titel} titel={g.titel} zeilen={g.zeilen} perioden={perioden} waehrung={waehrung} />
              ))}
              <tr>
                <td className="sticky left-0 bg-flaeche py-1.5 pr-3 text-gedimmt">Quelle</td>
                {perioden.map((p) => (
                  <td key={p.ende} className="py-1.5 pr-3 text-right">
                    <span className="inline-flex gap-1">{p.quellen.map((q) => <QuellenBadge key={q} quelle={q} />)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function GruppeZeilen({ titel, zeilen, perioden, waehrung }: { titel: string; zeilen: ZeilenDef[]; perioden: Abschluss[]; waehrung: string }) {
  return (
    <>
      <tr>
        <td colSpan={perioden.length + 1} className="sticky left-0 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-akzent">
          {titel}
        </td>
      </tr>
      {zeilen.map((z) => (
        <tr key={z.feld} className="border-b border-rand/40">
          <td className={`sticky left-0 bg-flaeche py-1.5 pr-3 whitespace-nowrap ${z.art === 'prozent' ? 'text-gedimmt' : 'text-schrift'}`}>{z.titel}</td>
          {perioden.map((p) => {
            const v = wertVon(p, z)
            const negativ = v !== null && v < 0 && z.art !== 'prozent'
            return (
              <td key={p.ende} className={`py-1.5 pr-3 text-right whitespace-nowrap ${z.art === 'prozent' ? 'text-gedimmt' : negativ ? 'text-short' : 'text-schrift'}`}>
                {formatiert(v, z, waehrung)}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
