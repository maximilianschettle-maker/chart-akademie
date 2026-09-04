import type { ComponentType } from 'react'
import { LeverageRechner } from './LeverageRechner'
import { PositionsRechner } from './PositionsRechner'
import { VolumeProfileDemo } from './VolumeProfileDemo'
import { LiqMapDemo } from './LiqMapDemo'
import { FundingOiDemo } from './FundingOiDemo'
import { HeatmapDemo } from './HeatmapDemo'
import { EmaRsiDemo } from './EmaRsiDemo'

// Registry: Lektions-Blöcke vom Typ 'demo' referenzieren Komponenten über ihre demoId.
export const DemoRegistry: Record<string, ComponentType<{ config?: Record<string, unknown> }>> = {
  'leverage-rechner': LeverageRechner,
  'positions-rechner': PositionsRechner,
  'volume-profile': VolumeProfileDemo,
  'liq-map': LiqMapDemo,
  'funding-oi': FundingOiDemo,
  'heatmap': HeatmapDemo,
  'ema-rsi': EmaRsiDemo,
}
