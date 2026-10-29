import { Kachel, vzFarbe } from '../aktien/components/ui'
import { fmtFaktor, fmtProzent } from '../aktien/engine/format'
import type { Kennzahlen } from '../aktien/engine/kennzahlen'

// Investor-Ansicht: die sechs Kennzahlen, die ein langfristiger Anleger zuerst sehen will,
// direkt unter dem Chart. Die vollständigen Gruppen stehen weiter unten auf der Firmenseite.

export function InvestorKennzahlen({ k }: { k: Kennzahlen }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Kachel titel="KGV" wert={fmtFaktor(k.kgv)} hinweis="Kurs ÷ Gewinn (TTM)" />
      <Kachel titel="Umsatz 5 J. p.a." wert={fmtProzent(k.umsatzWachstum5, 1, true)} farbe={vzFarbe(k.umsatzWachstum5)} />
      <Kachel titel="Dividendenrendite" wert={fmtProzent(k.dividendenrendite, 2)} />
      <Kachel titel="Nettomarge" wert={fmtProzent(k.nettomarge)} />
      <Kachel titel="FCF-Rendite" wert={fmtProzent(k.fcfRendite)} hinweis="Freier Cashflow ÷ Marktkap." />
      <Kachel titel="Eigenkapitalquote" wert={fmtProzent(k.eigenkapitalquote)} />
    </div>
  )
}
