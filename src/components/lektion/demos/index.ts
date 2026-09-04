import type { ComponentType } from 'react'
import { LeverageRechner } from './LeverageRechner'
import { PositionsRechner } from './PositionsRechner'

// Registry: Lektions-Blöcke vom Typ 'demo' referenzieren Komponenten über ihre demoId.
export const DemoRegistry: Record<string, ComponentType<{ config?: Record<string, unknown> }>> = {
  'leverage-rechner': LeverageRechner,
  'positions-rechner': PositionsRechner,
}
