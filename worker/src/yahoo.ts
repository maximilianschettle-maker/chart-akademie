// Yahoo Finance über yahoo-finance2: Suche, Kurs, Profil, Abschlüsse (ca. 4 Jahre).
import YahooFinance from 'yahoo-finance2'
import type { Kurs, Suchtreffer, YahooTeil } from '../../src/aktien/types'
import { firmaAusQuoteSummary, gjEndeMonatAusQuoteSummary, kursAusQuoteSummary, suchtrefferAus, yahooJahre, yahooQuartale, type QuoteSummaryRoh, type ZeitreihenZeile } from '../../src/aktien/engine/yahoo'
import { HttpFehler } from './http'

// Eine Instanz je Isolate: Cookie und Crumb werden wiederverwendet.
type YahooInstanz = InstanceType<typeof YahooFinance>
let instanz: YahooInstanz | null = null
function yf(): YahooInstanz {
  if (!instanz) {
    instanz = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
      queue: { concurrency: 2 },
      fetchOptions: { signal: AbortSignal.timeout(15_000) },
    })
  }
  return instanz
}

const MODULE = ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'] as const

async function quoteSummary(symbol: string): Promise<QuoteSummaryRoh> {
  try {
    return (await yf().quoteSummary(symbol, { modules: [...MODULE] }, { validateResult: false })) as QuoteSummaryRoh
  } catch (e) {
    throw uebersetzen(e, symbol)
  }
}

function uebersetzen(e: unknown, symbol: string): Error {
  const text = e instanceof Error ? e.message : String(e)
  if (/not found|No fundamentals|404|Quote not found/i.test(text)) return new HttpFehler(`Yahoo kennt "${symbol}" nicht`, 404)
  if (/429|Too Many Requests/i.test(text)) return new HttpFehler('Yahoo bremst gerade (429) — später erneut versuchen', 503)
  return new HttpFehler(`Yahoo: ${text}`, 502)
}

export async function yahooTeil(symbol: string): Promise<YahooTeil> {
  const q = await quoteSummary(symbol)
  if (!q.price) throw new HttpFehler(`Yahoo kennt "${symbol}" nicht`, 404)
  const firma = firmaAusQuoteSummary(symbol, q)
  const gjEndeMonat = gjEndeMonatAusQuoteSummary(q)
  const optionen = { period1: '2005-01-01', module: 'all' }
  const [jahreRoh, quartaleRoh] = await Promise.all([
    zeitreihe(symbol, { ...optionen, type: 'annual' }),
    zeitreihe(symbol, { ...optionen, type: 'quarterly' }),
  ])
  return {
    firma,
    jahre: yahooJahre(jahreRoh, firma.waehrung),
    quartale: yahooQuartale(quartaleRoh, firma.waehrung, gjEndeMonat),
    standAm: Date.now(),
  }
}

async function zeitreihe(symbol: string, optionen: { period1: string; module: string; type: string }): Promise<ZeitreihenZeile[]> {
  try {
    const rows = (await yf().fundamentalsTimeSeries(symbol, optionen, { validateResult: false })) as unknown
    return Array.isArray(rows) ? (rows as ZeitreihenZeile[]) : []
  } catch (e) {
    // Fehlende Abschlüsse (z.B. junge Firma) sind kein Grund, die Firma ganz zu verwerfen
    const text = e instanceof Error ? e.message : String(e)
    if (/not found|No fundamentals|404/i.test(text)) return []
    throw uebersetzen(e, symbol)
  }
}

export async function kurs(symbol: string): Promise<Kurs> {
  const q = await quoteSummary(symbol)
  const k = kursAusQuoteSummary(q)
  if (!k) throw new HttpFehler(`Kein Kurs für "${symbol}"`, 404)
  return k
}

export async function suche(begriff: string): Promise<Suchtreffer[]> {
  try {
    const roh = (await yf().search(begriff, { quotesCount: 12, newsCount: 0 }, { validateResult: false })) as { quotes?: Record<string, unknown>[] }
    return suchtrefferAus(roh)
  } catch (e) {
    throw uebersetzen(e, begriff)
  }
}
