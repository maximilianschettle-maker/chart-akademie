// Yahoo Finance (yahoo-finance2) → Firma, Kurs, Abschluss. Reine Funktionen.
// Die Rohdaten kommen ohne Schema-Validierung (validateResult: false), deshalb
// werden alle Felder defensiv gelesen.

import type { Abschluss, Firma, Kurs, Suchtreffer } from '../types'
import { leererAbschluss } from './sec'
import { fiskalQuartal, jahrVon } from './zeitraum'

type Roh = Record<string, unknown>

function zahl(o: Roh | undefined, ...schluessel: string[]): number | null {
  if (!o) return null
  for (const k of schluessel) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    // yahoo-finance2 liefert manche Werte als { raw, fmt }
    if (v && typeof v === 'object' && typeof (v as Roh).raw === 'number') return (v as Roh).raw as number
  }
  return null
}

function text(o: Roh | undefined, ...schluessel: string[]): string | undefined {
  if (!o) return undefined
  for (const k of schluessel) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function datumIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && v.length >= 10) return v.slice(0, 10)
  if (typeof v === 'number') return new Date(v * 1000).toISOString().slice(0, 10)
  return null
}

function unixSekunden(v: unknown): number {
  if (v instanceof Date) return Math.floor(v.getTime() / 1000)
  if (typeof v === 'string') return Math.floor(Date.parse(v) / 1000)
  if (typeof v === 'number') return v > 1e11 ? Math.floor(v / 1000) : v
  return Math.floor(Date.now() / 1000)
}

export interface QuoteSummaryRoh {
  price?: Roh
  summaryDetail?: Roh
  defaultKeyStatistics?: Roh
  financialData?: Roh
  assetProfile?: Roh
}

export function firmaAusQuoteSummary(symbol: string, q: QuoteSummaryRoh): Firma {
  const kursWaehrung = text(q.price, 'currency') ?? 'USD'
  const mitarbeiter = zahl(q.assetProfile, 'fullTimeEmployees')
  return {
    symbol,
    name: text(q.price, 'longName', 'shortName') ?? symbol,
    waehrung: text(q.financialData, 'financialCurrency') ?? kursWaehrung,
    kursWaehrung,
    boerse: text(q.price, 'exchangeName', 'fullExchangeName', 'exchange') ?? '',
    land: text(q.assetProfile, 'country'),
    sektor: text(q.assetProfile, 'sector'),
    branche: text(q.assetProfile, 'industry'),
    beschreibung: text(q.assetProfile, 'longBusinessSummary'),
    website: text(q.assetProfile, 'website'),
    mitarbeiter: mitarbeiter ?? undefined,
  }
}

export function kursAusQuoteSummary(q: QuoteSummaryRoh): Kurs | null {
  const preis = zahl(q.price, 'regularMarketPrice') ?? zahl(q.financialData, 'currentPrice')
  if (preis === null) return null
  const opt = (v: number | null) => (v === null ? undefined : v)
  return {
    preis,
    waehrung: text(q.price, 'currency') ?? 'USD',
    zeit: unixSekunden(q.price?.regularMarketTime),
    marktkap: opt(zahl(q.price, 'marketCap') ?? zahl(q.summaryDetail, 'marketCap')),
    aktienAnzahl: opt(zahl(q.defaultKeyStatistics, 'sharesOutstanding')),
    enterpriseValue: opt(zahl(q.defaultKeyStatistics, 'enterpriseValue')),
    kgvTtm: opt(zahl(q.summaryDetail, 'trailingPE')),
    kgvForward: opt(zahl(q.summaryDetail, 'forwardPE')),
    kbv: opt(zahl(q.defaultKeyStatistics, 'priceToBook')),
    kuv: opt(zahl(q.summaryDetail, 'priceToSalesTrailing12Months')),
    evEbitda: opt(zahl(q.defaultKeyStatistics, 'enterpriseToEbitda')),
    dividendenrendite: opt(zahl(q.summaryDetail, 'dividendYield')),
    kursziel: opt(zahl(q.financialData, 'targetMeanPrice')),
    hoch52w: opt(zahl(q.summaryDetail, 'fiftyTwoWeekHigh')),
    tief52w: opt(zahl(q.summaryDetail, 'fiftyTwoWeekLow')),
  }
}

/** Monat des Geschäftsjahresendes aus defaultKeyStatistics.lastFiscalYearEnd, sonst 12 */
export function gjEndeMonatAusQuoteSummary(q: QuoteSummaryRoh): number {
  const iso = datumIso(q.defaultKeyStatistics?.lastFiscalYearEnd)
  return iso ? Number(iso.slice(5, 7)) : 12
}

/** Eine Zeile aus fundamentalsTimeSeries (module 'all'), Felder camelCase, Vorzeichen wie bei Yahoo. */
export type ZeitreihenZeile = Roh & { date: unknown; periodType?: string }

const MIN_FELDER = 10 // Zeilen mit nur 2–3 Werten (Randjahre) überspringen

function abs(v: number | null): number | null {
  return v === null ? null : Math.abs(v)
}

function abschlussAusZeile(z: ZeitreihenZeile, waehrung: string, zeitraum: 'FY' | 'Q', gjEndeMonat: number): Abschluss | null {
  const ende = datumIso(z.date)
  if (!ende || Object.keys(z).length < MIN_FELDER) return null
  const { geschaeftsjahr, quartal } = zeitraum === 'Q' ? fiskalQuartal(ende, gjEndeMonat) : { geschaeftsjahr: jahrVon(ende), quartal: undefined }
  const a = leererAbschluss(geschaeftsjahr, ende, zeitraum, waehrung, 'yahoo')
  if (quartal) a.quartal = quartal
  a.umsatz = zahl(z, 'totalRevenue', 'operatingRevenue')
  a.bruttogewinn = zahl(z, 'grossProfit')
  a.ebit = zahl(z, 'operatingIncome', 'EBIT')
  const abschreibungen = zahl(z, 'reconciledDepreciation', 'depreciationAndAmortization')
  a.ebitda = zahl(z, 'EBITDA') ?? (a.ebit !== null && abschreibungen !== null ? a.ebit + abschreibungen : null)
  a.nettogewinn = zahl(z, 'netIncomeCommonStockholders', 'netIncome')
  a.epsVerwaessert = zahl(z, 'dilutedEPS')
  a.aktienVerwaessert = zahl(z, 'dilutedAverageShares', 'basicAverageShares')
  a.bilanzsumme = zahl(z, 'totalAssets')
  a.eigenkapital = zahl(z, 'stockholdersEquity', 'commonStockEquity')
  a.finanzschulden = zahl(z, 'totalDebt')
  a.zahlungsmittel = zahl(z, 'cashAndCashEquivalents')
  a.operativerCashflow = zahl(z, 'operatingCashFlow')
  a.capex = abs(zahl(z, 'capitalExpenditure'))
  a.freierCashflow = zahl(z, 'freeCashFlow') ?? (a.operativerCashflow !== null && a.capex !== null ? a.operativerCashflow - a.capex : null)
  a.dividenden = abs(zahl(z, 'cashDividendsPaid', 'commonStockDividendPaid'))
  a.rueckkaeufe = abs(zahl(z, 'repurchaseOfCapitalStock'))
  a.aktienAusstehend = zahl(z, 'ordinarySharesNumber')
  return a
}

export function yahooJahre(zeilen: ZeitreihenZeile[], waehrung: string): Abschluss[] {
  const jahre: Abschluss[] = []
  for (const z of zeilen) {
    const a = abschlussAusZeile(z, waehrung, 'FY', 12)
    if (a) jahre.push(a)
  }
  return jahre.sort((x, y) => x.ende.localeCompare(y.ende))
}

export function yahooQuartale(zeilen: ZeitreihenZeile[], waehrung: string, gjEndeMonat: number): Abschluss[] {
  const q: Abschluss[] = []
  for (const z of zeilen) {
    const a = abschlussAusZeile(z, waehrung, 'Q', gjEndeMonat)
    if (a) q.push(a)
  }
  return q.sort((x, y) => x.ende.localeCompare(y.ende))
}

export function suchtrefferAus(roh: { quotes?: Roh[] } | undefined): Suchtreffer[] {
  const treffer: Suchtreffer[] = []
  for (const q of roh?.quotes ?? []) {
    const symbol = text(q, 'symbol')
    if (!symbol) continue
    const typ = text(q, 'quoteType') ?? ''
    if (typ && typ !== 'EQUITY') continue
    treffer.push({
      symbol,
      name: text(q, 'longname', 'shortname') ?? symbol,
      boerse: text(q, 'exchDisp', 'exchange') ?? '',
      typ,
    })
  }
  return treffer
}
