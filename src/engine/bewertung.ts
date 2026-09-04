import type { Trade } from '../types'

export interface TradeStatistik {
  anzahl: number
  gewinner: number
  verlierer: number
  trefferquote: number // 0..100
  summePnl: number
  durchschnittR: number
  profitFaktor: number // Summe Gewinne / Summe Verluste (Infinity bei 0 Verlusten)
  maxDrawdown: number // größter Rückgang der kumulierten PnL-Kurve
}

export function statistik(trades: Trade[]): TradeStatistik {
  const gewinner = trades.filter((t) => t.pnl > 0)
  const verlierer = trades.filter((t) => t.pnl <= 0)
  const summeGewinne = gewinner.reduce((s, t) => s + t.pnl, 0)
  const summeVerluste = Math.abs(verlierer.reduce((s, t) => s + t.pnl, 0))

  let kumuliert = 0
  let hoch = 0
  let maxDrawdown = 0
  for (const t of trades) {
    kumuliert += t.pnl
    hoch = Math.max(hoch, kumuliert)
    maxDrawdown = Math.max(maxDrawdown, hoch - kumuliert)
  }

  return {
    anzahl: trades.length,
    gewinner: gewinner.length,
    verlierer: verlierer.length,
    trefferquote: trades.length > 0 ? (gewinner.length / trades.length) * 100 : 0,
    summePnl: trades.reduce((s, t) => s + t.pnl, 0),
    durchschnittR:
      trades.length > 0 ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length : 0,
    profitFaktor: summeVerluste > 0 ? summeGewinne / summeVerluste : summeGewinne > 0 ? Infinity : 0,
    maxDrawdown,
  }
}
