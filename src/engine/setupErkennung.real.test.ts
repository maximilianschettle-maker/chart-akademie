/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, CandleDatensatz } from '../types'
import { erkenneAn, findeSetup } from './setupErkennung'

// Prüft die Detektoren gegen die eingecheckten ECHTEN Datensätze: Sie müssen die
// kuratierten Setups an ungefähr der richtigen Stelle finden — und dürfen einen
// Datensatz nicht mit Treffern zupflastern.

function lade(ordner: string, name: string): Candle[] {
  const pfad = join(process.cwd(), 'public', ordner, `${name}.json`)
  return (JSON.parse(readFileSync(pfad, 'utf8')) as CandleDatensatz).candles
}

function trefferProStrategie(c: Candle[]): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (let i = 150; i < c.length - 10; i++) {
    const s = erkenneAn(c, i)
    if (s) (out[s.strategieId] ??= []).push(i)
  }
  return out
}

describe('Setup-Erkennung an echten Daten', () => {
  it('ETH Nov 23: Breakout + Retest in der kuratierten Retest-Zone (Bars 480–672)', () => {
    const t = trefferProStrategie(lade('szenarien', 'eth-breakout-nov23'))
    const inZone = (t['breakout-retest'] ?? []).filter((i) => i >= 470 && i <= 680)
    expect(inZone.length).toBeGreaterThan(0)
  })

  it('SOL Aug 24: Liquidity Sweep um den 5. August (Bars 247–262)', () => {
    const t = trefferProStrategie(lade('szenarien', 'sol-sweep-aug24'))
    const inZone = (t['liquidity-sweep'] ?? []).filter((i) => i >= 245 && i <= 265)
    expect(inZone.length).toBeGreaterThan(0)
  })

  it('BTC Sep 23: Range-/S-R-Setup an der Unterkante (Bars 408–480)', () => {
    const t = trefferProStrategie(lade('szenarien', 'btc-range-sep23'))
    const inZone = [...(t['range-trading'] ?? []), ...(t['sr-bounce'] ?? [])].filter((i) => i >= 400 && i <= 490)
    expect(inZone.length).toBeGreaterThan(0)
  })

  it('BTC Juni 23: Support-Bounce am dritten Test (Bars 420–480)', () => {
    const t = trefferProStrategie(lade('szenarien', 'btc-bounce-juni23'))
    const inZone = [...(t['sr-bounce'] ?? []), ...(t['range-trading'] ?? []), ...(t['liquidity-sweep'] ?? [])].filter(
      (i) => i >= 415 && i <= 485,
    )
    expect(inZone.length).toBeGreaterThan(0)
  })

  it('findet in jedem eingebauten Replay-Abschnitt mindestens ein Setup, aber nicht an jeder zweiten Bar', () => {
    const dateien = readdirSync(join(process.cwd(), 'public', 'replay')).filter((f) => f.endsWith('.json'))
    expect(dateien.length).toBeGreaterThan(0)
    const bericht: Record<string, Record<string, number>> = {}
    for (const f of dateien) {
      const c = lade('replay', f.replace('.json', ''))
      const t = trefferProStrategie(c)
      bericht[f] = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.length]))
      const gesamt = Object.values(t).reduce((s, v) => s + v.length, 0)
      expect(gesamt, `${f}: kein Setup`).toBeGreaterThan(0)
      expect(gesamt / c.length, `${f}: zu viele Treffer`).toBeLessThan(0.1)
      let seed = 0.5
      const zufall = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
      expect(findeSetup(c, 80, zufall), `${f}: findeSetup leer`).not.toBeNull()
    }
    // Sichtbar im Testlauf (vitest zeigt console.table nicht immer) — als Kommentar-Ersatz:
    expect(JSON.stringify(bericht).length).toBeGreaterThan(2)
  })
})
