import type { Candle } from '../../types'

export interface VolumeProfileBin {
  preisVon: number
  preisBis: number
  volumen: number
}

export interface VolumeProfil {
  bins: VolumeProfileBin[]
  poc: number // Preis-Mitte des volumenstärksten Bins (Point of Control)
  valueAreaLow: number
  valueAreaHigh: number
}

/**
 * Volume Profile aus OHLCV: Das Volumen jeder Kerze wird gleichmäßig über
 * ihre High-Low-Spanne verteilt und in Preis-Bins aufsummiert.
 * Value Area = kleinster Preisbereich um den POC mit ~70 % des Gesamtvolumens.
 */
export function volumeProfile(candles: Candle[], anzahlBins = 40): VolumeProfil {
  const min = Math.min(...candles.map((c) => c.low))
  const max = Math.max(...candles.map((c) => c.high))
  const spanne = max - min || 1
  const binGroesse = spanne / anzahlBins

  const volumina = new Array<number>(anzahlBins).fill(0)
  for (const c of candles) {
    const von = Math.max(0, Math.floor((c.low - min) / binGroesse))
    const bis = Math.min(anzahlBins - 1, Math.floor((c.high - min) / binGroesse))
    const anteil = c.volume / (bis - von + 1)
    for (let i = von; i <= bis; i++) volumina[i] += anteil
  }

  const bins: VolumeProfileBin[] = volumina.map((volumen, i) => ({
    preisVon: min + i * binGroesse,
    preisBis: min + (i + 1) * binGroesse,
    volumen,
  }))

  let pocIndex = 0
  for (let i = 1; i < anzahlBins; i++) {
    if (volumina[i] > volumina[pocIndex]) pocIndex = i
  }

  // Value Area: vom POC aus abwechselnd den stärkeren Nachbarn hinzunehmen
  const gesamt = volumina.reduce((s, v) => s + v, 0)
  let vaVolumen = volumina[pocIndex]
  let unten = pocIndex
  let oben = pocIndex
  while (vaVolumen < gesamt * 0.7 && (unten > 0 || oben < anzahlBins - 1)) {
    const untenWert = unten > 0 ? volumina[unten - 1] : -1
    const obenWert = oben < anzahlBins - 1 ? volumina[oben + 1] : -1
    if (obenWert >= untenWert) {
      oben++
      vaVolumen += volumina[oben]
    } else {
      unten--
      vaVolumen += volumina[unten]
    }
  }

  return {
    bins,
    poc: bins[pocIndex].preisVon + binGroesse / 2,
    valueAreaLow: bins[unten].preisVon,
    valueAreaHigh: bins[oben].preisBis,
  }
}
