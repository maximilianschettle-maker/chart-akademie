// Die fünf Setups aus Level 4 — als Tag für Orders/Trades (Journal-Auswertung)
// und als Anzeige-Name in Übungen/Auflösungen.

export interface StrategieDef {
  id: string
  name: string
  kurz: string
  lektionId?: string
}

export const STRATEGIEN: StrategieDef[] = [
  { id: 'trendfolge-ema', name: 'Trendfolge-Pullback', kurz: 'Trend', lektionId: 'l4-01' },
  { id: 'sr-bounce', name: 'Support/Resistance-Bounce', kurz: 'S/R', lektionId: 'l4-02' },
  { id: 'breakout-retest', name: 'Breakout + Retest', kurz: 'Breakout', lektionId: 'l4-03' },
  { id: 'range-trading', name: 'Range Trading', kurz: 'Range', lektionId: 'l4-04' },
  { id: 'liquidity-sweep', name: 'Liquidity Sweep', kurz: 'Sweep', lektionId: 'l4-05' },
  { id: 'kein-setup', name: 'Kein klares Setup / Bauchgefühl', kurz: 'Kein Setup' },
]

/** Anzeige-Name inkl. der Sonder-Ids aus Übungen (nicht wählbar im Order-Ticket). */
export const SONDER_NAMEN: Record<string, string> = {
  'kein-trade': 'Kein Trade — richtig war Abwarten',
}

export const STRATEGIE_NAME: Record<string, string> = Object.fromEntries(
  STRATEGIEN.map((s) => [s.id, s.name]),
)

export function strategieName(id?: string): string {
  if (!id) return 'Ohne Tag'
  return STRATEGIE_NAME[id] ?? SONDER_NAMEN[id] ?? id
}
