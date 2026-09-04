import type { Candle } from '../../types'

export interface LiqCluster {
  preis: number
  gewicht: number // relatives Gewicht (Volumen am Swing-Punkt)
  hebel: number
  seite: 'long' | 'short' // welche Positionsseite hier liquidiert würde
}

const HEBEL = [10, 25, 50, 100]

/**
 * Geschätzte Liquidations-Cluster aus OHLCV — dasselbe Schätzverfahren, das
 * auch kommerzielle "Liquidity Maps" verwenden: An markanten Swing-Punkten
 * eröffnen viele Trader Positionen; aus deren typischen Hebeln (10x/25x/50x/100x)
 * ergeben sich rechnerische Liquidationspreise.
 *  - Longs, eröffnet am Swing-Tief L  → Liquidation bei L·(1 − 1/Hebel) (unter dem Markt)
 *  - Shorts, eröffnet am Swing-Hoch H → Liquidation bei H·(1 + 1/Hebel) (über dem Markt)
 * KEINE echten Daten — eine didaktische, aber realistische Schätzung.
 */
export function liqCluster(candles: Candle[], lookback = 10): LiqCluster[] {
  const cluster: LiqCluster[] = []

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i]
    let istSwingHoch = true
    let istSwingTief = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue
      if (candles[j].high >= c.high) istSwingHoch = false
      if (candles[j].low <= c.low) istSwingTief = false
      if (!istSwingHoch && !istSwingTief) break
    }
    if (istSwingHoch) {
      for (const hebel of HEBEL) {
        cluster.push({
          preis: c.high * (1 + 1 / hebel),
          gewicht: c.volume / hebel, // hohe Hebel: weniger Kapital dahinter
          hebel,
          seite: 'short',
        })
      }
    }
    if (istSwingTief) {
      for (const hebel of HEBEL) {
        cluster.push({
          preis: c.low * (1 - 1 / hebel),
          gewicht: c.volume / hebel,
          hebel,
          seite: 'long',
        })
      }
    }
  }
  return cluster
}

export interface LiqBin {
  preisVon: number
  preisBis: number
  gewichtLong: number
  gewichtShort: number
}

/** Aggregiert Cluster in Preis-Bins für die Histogramm-Darstellung. */
export function liqBins(
  cluster: LiqCluster[],
  minPreis: number,
  maxPreis: number,
  anzahlBins = 60,
): LiqBin[] {
  const spanne = maxPreis - minPreis || 1
  const binGroesse = spanne / anzahlBins
  const bins: LiqBin[] = Array.from({ length: anzahlBins }, (_, i) => ({
    preisVon: minPreis + i * binGroesse,
    preisBis: minPreis + (i + 1) * binGroesse,
    gewichtLong: 0,
    gewichtShort: 0,
  }))
  for (const c of cluster) {
    if (c.preis < minPreis || c.preis >= maxPreis) continue
    const i = Math.floor((c.preis - minPreis) / binGroesse)
    if (c.seite === 'long') bins[i].gewichtLong += c.gewicht
    else bins[i].gewichtShort += c.gewicht
  }
  return bins
}
