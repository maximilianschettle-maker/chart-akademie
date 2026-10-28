import type { Instrument, MusterDef, MusterId, TrackerConfig } from '../types'

// Katalog der gängigen Instrumente (Yahoo-Symbole) und der erkennbaren Muster.
// Gemeinsam für Action (scripts/tracker) und Frontend.

export const INSTRUMENTE: Instrument[] = [
  { id: 'sp500', name: 'S&P 500', symbol: '^GSPC', waehrung: 'USD', dezimalen: 0, markt: 'aktien-us' },
  { id: 'nasdaq100', name: 'Nasdaq 100', symbol: '^NDX', waehrung: 'USD', dezimalen: 0, markt: 'aktien-us' },
  { id: 'dax', name: 'DAX', symbol: '^GDAXI', waehrung: 'EUR', dezimalen: 0, markt: 'aktien-eu' },
  { id: 'stoxx50', name: 'Euro Stoxx 50', symbol: '^STOXX50E', waehrung: 'EUR', dezimalen: 0, markt: 'aktien-eu' },
  { id: 'nikkei', name: 'Nikkei 225', symbol: '^N225', waehrung: 'JPY', dezimalen: 0, markt: 'aktien-asien' },
  { id: 'gold', name: 'Gold', symbol: 'GC=F', waehrung: 'USD', dezimalen: 0, markt: 'rohstoff' },
  { id: 'silber', name: 'Silber', symbol: 'SI=F', waehrung: 'USD', dezimalen: 2, markt: 'rohstoff' },
  { id: 'oel', name: 'Öl (WTI)', symbol: 'CL=F', waehrung: 'USD', dezimalen: 2, markt: 'rohstoff' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC-USD', coinbase: 'BTC-USD', waehrung: 'USD', dezimalen: 0, markt: 'krypto' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH-USD', coinbase: 'ETH-USD', waehrung: 'USD', dezimalen: 0, markt: 'krypto' },
  { id: 'eurusd', name: 'EUR/USD', symbol: 'EURUSD=X', waehrung: 'USD', dezimalen: 4, markt: 'devisen' },
]

export const INSTRUMENT_NACH_ID: Record<string, Instrument> = Object.fromEntries(INSTRUMENTE.map((i) => [i.id, i]))

export const MUSTER: MusterDef[] = [
  {
    id: 'ausbruch',
    name: 'Breakout',
    beschreibung: 'Schlusskurs über dem 20-Tage-Hoch bzw. unter dem 20-Tage-Tief (erster Tag). 52-Wochen-Hoch/-Tief wird erwähnt.',
  },
  {
    id: 'tunnel',
    name: 'Tunnel / Range',
    beschreibung: 'Kurs pendelt seit mindestens 15 Tagen zwischen zwei Marken. Meldung, wenn der Tunnel entsteht und wenn der Kurs einen Rand erreicht.',
  },
  {
    id: 'ema-kreuz',
    name: 'EMA-Kreuzung',
    beschreibung: 'EMA 20 kreuzt EMA 50 bzw. EMA 50 kreuzt EMA 200 (Golden/Death Cross).',
  },
  {
    id: 'rsi',
    name: 'RSI extrem',
    beschreibung: 'RSI 14 steigt über 70 (überkauft) oder fällt unter 30 (überverkauft).',
  },
  {
    id: 'setup',
    name: 'Lehrbuch-Setup',
    beschreibung: 'Die Setup-Erkennung aus den Übungen (Breakout + Retest, Range-Bounce, S/R-Bounce, Trend-Pullback, Liquidity Sweep) auf Tageskerzen.',
  },
]

export const MUSTER_NACH_ID: Record<MusterId, MusterDef> = Object.fromEntries(MUSTER.map((m) => [m.id, m])) as Record<MusterId, MusterDef>

export const STANDARD_CONFIG: TrackerConfig = {
  instrumente: ['sp500', 'nasdaq100', 'gold', 'bitcoin', 'dax', 'eurusd'],
  muster: { ausbruch: true, tunnel: true, 'ema-kreuz': true, rsi: true, setup: true },
  push: true,
  aktualisiertAm: 0,
}

/** Unbekannte Instrumente raus, fehlende Muster mit Standard auffüllen */
export function normalisiereConfig(roh: unknown): TrackerConfig {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Partial<TrackerConfig>
  const instrumente = Array.isArray(r.instrumente)
    ? [...new Set(r.instrumente.filter((id): id is string => typeof id === 'string' && id in INSTRUMENT_NACH_ID))]
    : [...STANDARD_CONFIG.instrumente]
  const muster = { ...STANDARD_CONFIG.muster }
  if (r.muster && typeof r.muster === 'object') {
    for (const m of MUSTER) if (typeof r.muster[m.id] === 'boolean') muster[m.id] = r.muster[m.id]
  }
  return {
    instrumente,
    muster,
    push: typeof r.push === 'boolean' ? r.push : STANDARD_CONFIG.push,
    aktualisiertAm: typeof r.aktualisiertAm === 'number' && Number.isFinite(r.aktualisiertAm) ? r.aktualisiertAm : 0,
  }
}
