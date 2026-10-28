import type { Richtung } from './types'

const SYMBOL: Record<string, string> = { USD: '$', EUR: '€', JPY: '¥' }

export function fmtKurs(n: number, dezimalen: number, waehrung: string): string {
  const zahl = n.toLocaleString('de-DE', { minimumFractionDigits: dezimalen, maximumFractionDigits: dezimalen })
  return `${zahl} ${SYMBOL[waehrung] ?? waehrung}`
}

export function fmtProzentVz(anteil: number, stellen = 1): string {
  const p = anteil * 100
  return `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p).toFixed(stellen).replace('.', ',')} %`
}

export function fmtDatumKurz(isoDatum: string): string {
  const [j, m, t] = isoDatum.split('-')
  return `${t}.${m}.${j.slice(2)}`
}

export function fmtStand(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function richtungFarbe(r: Richtung): string {
  return r === 'long' ? 'text-long' : r === 'short' ? 'text-short' : 'text-akzent'
}

export function richtungText(r: Richtung): string {
  return r === 'long' ? 'bullish' : r === 'short' ? 'bearish' : 'neutral'
}
