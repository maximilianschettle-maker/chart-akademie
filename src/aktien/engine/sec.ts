// SEC EDGAR XBRL → Abschluss. Reine Funktionen; die Netzanfragen macht der Worker.
//
// Die SEC liefert je Konzept (z.B. us-gaap/Revenues) alle jemals gemeldeten Werte
// als Liste von Einträgen. Ein Wert taucht mehrfach auf (im Jahr der Meldung und in
// späteren Jahren als Vergleichszahl) — wir nehmen je Stichtag die jüngste
// Einreichung, damit Restatements greifen. Flussgrößen (Umsatz …) brauchen eine
// Zeitspanne von ~1 Jahr bzw. ~1 Quartal, Bestandsgrößen (Bilanz) nur den Stichtag.

import type { Abschluss, AbschlussFeld, Quelle } from '../types'
import { fiskalQuartal, gjEndeMonatAus, jahrVon, tage } from './zeitraum'

export interface SecEintrag {
  start?: string
  end: string
  val: number
  accn: string
  fy: number
  fp: string
  form: string
  filed: string
  frame?: string
}

export interface SecKonzept {
  cik: number
  taxonomy: string
  tag: string
  entityName: string
  units: Record<string, SecEintrag[]>
}

export type Taxonomie = 'us-gaap' | 'ifrs-full' | 'dei'

/** Interne Felder: wie AbschlussFeld, aber Schulden/EBITDA/FCF aus Bestandteilen abgeleitet */
export type SecFeld =
  | Exclude<AbschlussFeld, 'ebitda' | 'finanzschulden' | 'freierCashflow'>
  | 'abschreibungen'
  | 'schuldenGesamt'
  | 'schuldenLang'
  | 'schuldenKurz'

export interface SecFeldDef {
  feld: SecFeld
  art: 'fluss' | 'bestand'
  einheit: 'geld' | 'jeAktie' | 'stueck'
  /** Stichtag-Zuordnung über das Enddatum (Standard) oder über das fy-Feld (Deckblatt-Angaben) */
  zuordnung?: 'fy'
  kandidaten: Partial<Record<Taxonomie, string[]>>
}

// Reihenfolge der Kandidaten = Häufigkeit in der Praxis. Der Worker holt Kandidaten
// nacheinander, bis die Reihe lang genug ist (siehe reiheReichtAus).
export const SEC_FELDER: SecFeldDef[] = [
  {
    feld: 'umsatz',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': [
        'Revenues',
        'RevenueFromContractWithCustomerExcludingAssessedTax',
        'SalesRevenueNet',
        'RevenueFromContractWithCustomerIncludingAssessedTax',
        'RevenuesNetOfInterestExpense',
      ],
      'ifrs-full': ['Revenue', 'RevenueFromContractsWithCustomers'],
    },
  },
  { feld: 'bruttogewinn', art: 'fluss', einheit: 'geld', kandidaten: { 'us-gaap': ['GrossProfit'], 'ifrs-full': ['GrossProfit'] } },
  {
    feld: 'ebit',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: { 'us-gaap': ['OperatingIncomeLoss'], 'ifrs-full': ['ProfitLossFromOperatingActivities'] },
  },
  {
    feld: 'abschreibungen',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'],
      'ifrs-full': ['DepreciationAndAmortisationExpense', 'AdjustmentsForDepreciationAndAmortisationExpense'],
    },
  },
  {
    feld: 'nettogewinn',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
      'ifrs-full': ['ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'],
    },
  },
  {
    feld: 'epsVerwaessert',
    art: 'fluss',
    einheit: 'jeAktie',
    kandidaten: { 'us-gaap': ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'], 'ifrs-full': ['DilutedEarningsLossPerShare'] },
  },
  {
    feld: 'aktienVerwaessert',
    art: 'fluss',
    einheit: 'stueck',
    kandidaten: {
      'us-gaap': ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'],
      'ifrs-full': ['AdjustedWeightedAverageShares', 'WeightedAverageShares'],
    },
  },
  { feld: 'bilanzsumme', art: 'bestand', einheit: 'geld', kandidaten: { 'us-gaap': ['Assets'], 'ifrs-full': ['Assets'] } },
  {
    feld: 'eigenkapital',
    art: 'bestand',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
      'ifrs-full': ['EquityAttributableToOwnersOfParent', 'Equity'],
    },
  },
  {
    feld: 'schuldenGesamt',
    art: 'bestand',
    einheit: 'geld',
    kandidaten: { 'us-gaap': ['LongTermDebt', 'DebtLongtermAndShorttermCombinedAmount'], 'ifrs-full': ['Borrowings'] },
  },
  {
    feld: 'schuldenLang',
    art: 'bestand',
    einheit: 'geld',
    kandidaten: { 'us-gaap': ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'], 'ifrs-full': ['LongtermBorrowings', 'NoncurrentBorrowings'] },
  },
  {
    feld: 'schuldenKurz',
    art: 'bestand',
    einheit: 'geld',
    // Bewusst nur ein Posten je Stichtag (DebtCurrent enthält z.B. schon Commercial Paper) — kein Doppelzählen.
    kandidaten: {
      'us-gaap': ['DebtCurrent', 'LongTermDebtCurrent', 'ShortTermBorrowings', 'CommercialPaper'],
      'ifrs-full': ['CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings', 'ShorttermBorrowings'],
    },
  },
  {
    feld: 'zahlungsmittel',
    art: 'bestand',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
      'ifrs-full': ['CashAndCashEquivalents'],
    },
  },
  {
    feld: 'operativerCashflow',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
      'ifrs-full': ['CashFlowsFromUsedInOperatingActivities'],
    },
  },
  {
    feld: 'capex',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
      'ifrs-full': [
        'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',
        'PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets',
      ],
    },
  },
  {
    feld: 'dividenden',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: {
      'us-gaap': ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock', 'PaymentsOfOrdinaryDividends'],
      'ifrs-full': ['DividendsPaidClassifiedAsFinancingActivities', 'DividendsPaid'],
    },
  },
  {
    feld: 'rueckkaeufe',
    art: 'fluss',
    einheit: 'geld',
    kandidaten: { 'us-gaap': ['PaymentsForRepurchaseOfCommonStock'], 'ifrs-full': ['PaymentsToAcquireOrRedeemEntitysShares', 'PurchaseOfTreasuryShares'] },
  },
  {
    feld: 'aktienAusstehend',
    art: 'bestand',
    einheit: 'stueck',
    kandidaten: { 'us-gaap': ['CommonStockSharesOutstanding'], 'ifrs-full': ['NumberOfSharesOutstanding', 'NumberOfSharesIssued'] },
  },
  // Deckblatt-Angabe (Stichtag liegt nach dem Bilanzstichtag) → Zuordnung über fy
  { feld: 'aktienAusstehend', art: 'bestand', einheit: 'stueck', zuordnung: 'fy', kandidaten: { dei: ['EntityCommonStockSharesOutstanding'] } },
]

const JAHRESFORMEN = new Set(['10-K', '10-K/A', '10-KT', '20-F', '20-F/A', '40-F', '40-F/A'])
const QUARTALSFORMEN = new Set(['10-Q', '10-Q/A', '10-QT'])

/** Ab so vielen Geschäftsjahren hört der Worker auf, weitere Kandidaten zu holen. */
export const REIHE_AUSREICHEND = 8

export function einheitSchluessel(einheit: SecFeldDef['einheit'], waehrung: string): string {
  if (einheit === 'geld') return waehrung
  if (einheit === 'jeAktie') return `${waehrung}/shares`
  return 'shares'
}

/** Berichtswährung raten: die Währungseinheit mit den meisten Einträgen (USD-Umrechnungen sind selten). */
export function waehrungAusKonzept(k: SecKonzept): string | null {
  let best: string | null = null
  let bestN = 0
  for (const [einheit, liste] of Object.entries(k.units)) {
    if (!/^[A-Z]{3}$/.test(einheit)) continue
    if (liste.length > bestN) {
      best = einheit
      bestN = liste.length
    }
  }
  return best
}

export interface Reihe {
  /** Stichtag → Wert (je Stichtag die jüngste Einreichung) */
  werte: Map<string, number>
}

interface Auswahl {
  zeitraum: 'FY' | 'Q'
  art: 'fluss' | 'bestand'
  /** Q: kumulierte Werte seit Geschäftsjahresbeginn (6 und 9 Monate) statt echter Quartale */
  kumuliert?: boolean
}

function passtDauer(e: SecEintrag, art: 'fluss' | 'bestand', zeitraum: 'FY' | 'Q', kumuliert = false): boolean {
  if (art === 'bestand') return !e.start
  if (!e.start) return false
  const d = tage(e.start, e.end)
  if (zeitraum === 'FY') return d >= 340 && d <= 380
  return kumuliert ? d >= 170 && d <= 290 : d >= 80 && d <= 100
}

/**
 * Wählt aus einem Konzept die Werte je Stichtag aus. FY: Jahresformen + fp FY.
 * Q: Quartalsformen + fp Q1–Q3 (Q4 wird später aus FY − ΣQ abgeleitet).
 */
export function reiheAus(k: SecKonzept, einheit: string, wahl: Auswahl, def?: Pick<SecFeldDef, 'zuordnung'>): Reihe {
  const liste = k.units[einheit] ?? []
  const jüngste = new Map<string, SecEintrag>()
  for (const e of liste) {
    const formOk = wahl.zeitraum === 'FY' ? JAHRESFORMEN.has(e.form) && e.fp === 'FY' : QUARTALSFORMEN.has(e.form) && /^Q[123]$/.test(e.fp)
    if (!formOk) continue
    if (def?.zuordnung !== 'fy' && !passtDauer(e, wahl.art, wahl.zeitraum, wahl.kumuliert)) continue
    const schluessel = def?.zuordnung === 'fy' ? `fy:${e.fy}` : e.end
    const alt = jüngste.get(schluessel)
    if (!alt || e.filed > alt.filed) jüngste.set(schluessel, e)
  }
  const werte = new Map<string, number>()
  for (const [s, e] of jüngste) werte.set(s, e.val)
  return { werte }
}

/** Mehrere Kandidaten-Konzepte zu einer Reihe: frühere Kandidaten gewinnen je Stichtag. */
export function reihenVereinen(reihen: Reihe[]): Reihe {
  const werte = new Map<string, number>()
  for (const r of reihen) for (const [s, v] of r.werte) if (!werte.has(s)) werte.set(s, v)
  return { werte }
}

export function reiheReichtAus(r: Reihe): boolean {
  return r.werte.size >= REIHE_AUSREICHEND
}

/** Alle geholten Konzepte einer Firma, Schlüssel 'taxonomie:Tag'; null = bei der SEC nicht vorhanden (404). */
export type SecKonzepte = Record<string, SecKonzept | null>

function leererAbschluss(geschaeftsjahr: number, ende: string, zeitraum: 'FY' | 'Q', waehrung: string, quelle: Quelle): Abschluss {
  return {
    geschaeftsjahr,
    ende,
    zeitraum,
    waehrung,
    umsatz: null,
    bruttogewinn: null,
    ebit: null,
    ebitda: null,
    nettogewinn: null,
    epsVerwaessert: null,
    aktienVerwaessert: null,
    bilanzsumme: null,
    eigenkapital: null,
    finanzschulden: null,
    zahlungsmittel: null,
    operativerCashflow: null,
    capex: null,
    freierCashflow: null,
    dividenden: null,
    rueckkaeufe: null,
    aktienAusstehend: null,
    quellen: [quelle],
  }
}

export { leererAbschluss }

type FeldReihen = Partial<Record<SecFeld, Reihe>>

/** Je internes Feld eine Reihe (alle Kandidaten vereint), für FY oder Q. */
export function feldReihen(konzepte: SecKonzepte, waehrung: string, zeitraum: 'FY' | 'Q', kumuliert = false): FeldReihen {
  const ergebnis: FeldReihen = {}
  for (const def of SEC_FELDER) {
    const reihen: Reihe[] = []
    for (const [tax, tags] of Object.entries(def.kandidaten) as [Taxonomie, string[]][]) {
      for (const tag of tags) {
        const k = konzepte[`${tax}:${tag}`]
        if (!k) continue
        reihen.push(reiheAus(k, einheitSchluessel(def.einheit, waehrung), { zeitraum, art: def.art, kumuliert }, def))
      }
    }
    if (reihen.length === 0) continue
    const vereint = reihenVereinen(ergebnis[def.feld] ? [ergebnis[def.feld]!, ...reihen] : reihen)
    if (vereint.werte.size > 0) ergebnis[def.feld] = vereint
  }
  return ergebnis
}

function wert(r: Reihe | undefined, schluessel: string): number | null {
  const v = r?.werte.get(schluessel)
  return v === undefined ? null : v
}

function ableiten(a: Abschluss, abschreibungen: number | null, gesamt: number | null, lang: number | null, kurz: number | null) {
  if (a.ebit !== null && abschreibungen !== null) a.ebitda = a.ebit + abschreibungen
  if (gesamt !== null) a.finanzschulden = gesamt
  else if (lang !== null || kurz !== null) a.finanzschulden = (lang ?? 0) + (kurz ?? 0)
  if (a.operativerCashflow !== null && a.capex !== null) a.freierCashflow = a.operativerCashflow - a.capex
  if (a.capex !== null) a.capex = Math.abs(a.capex)
  if (a.dividenden !== null) a.dividenden = Math.abs(a.dividenden)
  if (a.rueckkaeufe !== null) a.rueckkaeufe = Math.abs(a.rueckkaeufe)
}

const DIREKT: Exclude<SecFeld, 'abschreibungen' | 'schuldenGesamt' | 'schuldenLang' | 'schuldenKurz'>[] = [
  'umsatz',
  'bruttogewinn',
  'ebit',
  'nettogewinn',
  'epsVerwaessert',
  'aktienVerwaessert',
  'bilanzsumme',
  'eigenkapital',
  'zahlungsmittel',
  'operativerCashflow',
  'capex',
  'dividenden',
  'rueckkaeufe',
  'aktienAusstehend',
]

/** Geschäftsjahre aus den SEC-Konzepten, aufsteigend nach Stichtag. */
export function secJahre(konzepte: SecKonzepte, waehrung: string): Abschluss[] {
  const reihen = feldReihen(konzepte, waehrung, 'FY')
  // Stichtage: alle Enddaten, die bei Umsatz, Gewinn oder Bilanzsumme vorkommen
  const stichtage = new Set<string>()
  for (const f of ['umsatz', 'nettogewinn', 'bilanzsumme', 'operativerCashflow'] as SecFeld[]) {
    for (const s of reihen[f]?.werte.keys() ?? []) if (!s.startsWith('fy:')) stichtage.add(s)
  }
  const jahre: Abschluss[] = []
  for (const ende of [...stichtage].sort()) {
    const gj = jahrVon(ende)
    const a = leererAbschluss(gj, ende, 'FY', waehrung, 'sec')
    for (const f of DIREKT) a[f] = wert(reihen[f], ende)
    // Deckblatt-Aktienzahl über fy, falls die Bilanz keine liefert
    if (a.aktienAusstehend === null) a.aktienAusstehend = wert(reihen.aktienAusstehend, `fy:${gj}`)
    ableiten(a, wert(reihen.abschreibungen, ende), wert(reihen.schuldenGesamt, ende), wert(reihen.schuldenLang, ende), wert(reihen.schuldenKurz, ende))
    jahre.push(a)
  }
  // Ein Geschäftsjahr kann durch 52/53-Wochen-Jahre zwei nahe Stichtage haben → den mit mehr Werten behalten
  const jeJahr = new Map<number, Abschluss>()
  for (const a of jahre) {
    const alt = jeJahr.get(a.geschaeftsjahr)
    if (!alt || gefuellt(a) > gefuellt(alt)) jeJahr.set(a.geschaeftsjahr, a)
  }
  return [...jeJahr.values()].sort((x, y) => x.ende.localeCompare(y.ende))
}

function gefuellt(a: Abschluss): number {
  let n = 0
  for (const f of DIREKT) if (a[f] !== null) n++
  return n
}

const FLUSS_SUMMIERBAR: AbschlussFeld[] = [
  'umsatz',
  'bruttogewinn',
  'ebit',
  'ebitda',
  'nettogewinn',
  'epsVerwaessert',
  'operativerCashflow',
  'capex',
  'freierCashflow',
  'dividenden',
  'rueckkaeufe',
]
const BESTAND: AbschlussFeld[] = ['bilanzsumme', 'eigenkapital', 'finanzschulden', 'zahlungsmittel', 'aktienAusstehend']

/**
 * Quartale: Q1–Q3 aus 10-Q, Q4 = Geschäftsjahr − (Q1+Q2+Q3) für Flussgrößen,
 * Bestandsgrößen am GJ-Ende direkt. Nur für 10-Q-Filer (US); 20-F-Filer liefern keine Quartale.
 */
export function secQuartale(konzepte: SecKonzepte, waehrung: string, jahre: Abschluss[]): Abschluss[] {
  const reihen = feldReihen(konzepte, waehrung, 'Q')
  const stichtage = new Set<string>()
  for (const f of ['umsatz', 'nettogewinn', 'bilanzsumme'] as SecFeld[]) for (const s of reihen[f]?.werte.keys() ?? []) stichtage.add(s)
  if (stichtage.size === 0) return []
  const gjEndeMonat = gjEndeMonatAus(jahre.map((j) => j.ende))
  const quartale: Abschluss[] = []
  for (const ende of [...stichtage].sort()) {
    const { geschaeftsjahr, quartal } = fiskalQuartal(ende, gjEndeMonat)
    if (quartal === 4) continue // Jahresabschluss-Stichtag ohne 10-Q
    const a = leererAbschluss(geschaeftsjahr, ende, 'Q', waehrung, 'sec')
    a.quartal = quartal
    for (const f of DIREKT) a[f] = wert(reihen[f], ende)
    ableiten(a, wert(reihen.abschreibungen, ende), wert(reihen.schuldenGesamt, ende), wert(reihen.schuldenLang, ende), wert(reihen.schuldenKurz, ende))
    quartale.push(a)
  }
  // Fehlende Flussgrößen (typisch: Cashflow) aus kumulierten Werten: Q_n = YTD_n − YTD_n−1
  const kumuliert = feldReihen(konzepte, waehrung, 'Q', true)
  const FLUSS_INTERN: Exclude<SecFeld, 'schuldenGesamt' | 'schuldenLang' | 'schuldenKurz'>[] = [
    'umsatz', 'bruttogewinn', 'ebit', 'abschreibungen', 'nettogewinn', 'epsVerwaessert', 'operativerCashflow', 'capex', 'dividenden', 'rueckkaeufe',
  ]
  const ytd = (f: SecFeld, q: Abschluss): number | null => {
    // Q1 ist selbst kumuliert; sonst der kumulierte Wert zum Stichtag
    if (q.quartal === 1) return f === 'abschreibungen' ? wert(reihen.abschreibungen, q.ende) ?? wert(kumuliert.abschreibungen, q.ende) : (q[f as AbschlussFeld] ?? wert(kumuliert[f], q.ende))
    return wert(kumuliert[f], q.ende)
  }
  for (const q of quartale) {
    if (q.quartal === 1) continue
    const vorher = quartale.find((v) => v.geschaeftsjahr === q.geschaeftsjahr && v.quartal === (q.quartal as number) - 1)
    if (!vorher) continue
    let abschreibungenQ: number | null = null
    for (const f of FLUSS_INTERN) {
      const istAbschreibung = f === 'abschreibungen'
      if (!istAbschreibung && q[f] !== null) continue
      const bis = ytd(f, q)
      const von = ytd(f, vorher)
      if (bis === null || von === null) continue
      if (istAbschreibung) abschreibungenQ = bis - von
      else q[f] = bis - von
    }
    if (q.capex !== null) q.capex = Math.abs(q.capex)
    if (q.dividenden !== null) q.dividenden = Math.abs(q.dividenden)
    if (q.rueckkaeufe !== null) q.rueckkaeufe = Math.abs(q.rueckkaeufe)
    if (q.ebitda === null && q.ebit !== null && abschreibungenQ !== null) q.ebitda = q.ebit + abschreibungenQ
    if (q.freierCashflow === null && q.operativerCashflow !== null && q.capex !== null) q.freierCashflow = q.operativerCashflow - q.capex
  }
  // Q4 ableiten
  for (const j of jahre) {
    const drei = quartale.filter((q) => q.geschaeftsjahr === j.geschaeftsjahr)
    if (drei.length !== 3) continue
    const q4 = leererAbschluss(j.geschaeftsjahr, j.ende, 'Q', waehrung, 'sec')
    q4.quartal = 4
    for (const f of FLUSS_SUMMIERBAR) {
      const jw = j[f]
      if (jw === null || drei.some((q) => q[f] === null)) continue
      q4[f] = jw - drei.reduce((s, q) => s + (q[f] as number), 0)
    }
    for (const f of BESTAND) q4[f] = j[f]
    q4.aktienVerwaessert = j.aktienVerwaessert // Näherung: gewichtete Aktien sind nicht additiv
    quartale.push(q4)
  }
  return quartale.sort((x, y) => x.ende.localeCompare(y.ende))
}

// ── Ticker/Name → CIK ─────────────────────────────────────────────────────────

export interface SecTickerEintrag {
  cik_str: number
  ticker: string
  title: string
}

export interface CikIndex {
  /** Ticker (Großbuchstaben) → CIK (10-stellig) */
  ticker: Record<string, string>
  /** normalisierter Name → CIK */
  name: Record<string, string>
}

const NAMENS_FUELLWOERTER = new Set([
  'inc', 'inc.', 'corp', 'corp.', 'corporation', 'co', 'co.', 'company', 'ltd', 'ltd.', 'limited', 'plc', 'se', 'ag', 'nv', 'n.v.', 'sa',
  's.a.', 'the', 'holdings', 'holding', 'group', 'aktiengesellschaft', 'incorporated', 'llc', 'lp', 'l.p.', 'trust', 'class', 'a', 'b',
  'common', 'stock', 'shares', 'ordinary', 'adr', 'ads',
])

export function nameNormalisieren(name: string): string {
  return name
    .toLowerCase()
    .replace(/[(),"'’&/\\-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NAMENS_FUELLWOERTER.has(w))
    .join(' ')
}

export function cikIndexBauen(liste: Record<string, SecTickerEintrag> | SecTickerEintrag[]): CikIndex {
  const eintraege = Array.isArray(liste) ? liste : Object.values(liste)
  const ticker: Record<string, string> = {}
  const name: Record<string, string> = {}
  for (const e of eintraege) {
    const cik = String(e.cik_str).padStart(10, '0')
    ticker[e.ticker.toUpperCase()] = cik
    const n = nameNormalisieren(e.title)
    if (n && !(n in name)) name[n] = cik
  }
  return { ticker, name }
}

/**
 * Sucht die CIK zu einem Yahoo-Symbol: erst der Ticker (US-Symbole direkt, bei 'SAP.DE'
 * der Teil vor dem Punkt — trifft bei vielen ADRs), sonst der normalisierte Firmenname.
 */
export function cikSuchen(index: CikIndex, symbol: string, name?: string): { cik: string; zuordnung: 'ticker' | 'name' } | null {
  const basis = symbol.toUpperCase().split('.')[0].replace('-', '.')
  const direkt = index.ticker[symbol.toUpperCase()] ?? (symbol.includes('.') ? undefined : index.ticker[basis])
  if (direkt) return { cik: direkt, zuordnung: 'ticker' }
  if (name) {
    const n = nameNormalisieren(name)
    if (n && index.name[n]) return { cik: index.name[n], zuordnung: 'name' }
  }
  // US-Ticker als Teil eines EU-Symbols (z.B. 'SAP.DE' → 'SAP'): nur wenn der Name passt
  if (symbol.includes('.') && index.ticker[basis] && name) {
    return { cik: index.ticker[basis], zuordnung: 'name' }
  }
  return null
}
