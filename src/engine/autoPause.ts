import type { Candle, Scenario } from '../types'
import { KRITERIEN, zoneText } from './szenarioGrader'

// Auto-Pause im Übungs-Replay: Stundenkerzen erscheinen auf einmal — wer die
// Entry-Zone per Market handeln will, kommt oft zu spät. Deshalb hält das Replay
// an, sobald eine Kerze die (um `pauseAbstand` erweiterte) Entry-Zone berührt,
// frühestens eine Kerze vor dem Trigger und nur innerhalb des Entry-Fensters.
// Pur, damit die Logik ohne React testbar ist; die Seite pausiert einmal je
// Annäherung und nicht bei offener Position/Order.

export interface AutoPauseGrund {
  zone: string
  /** null: Übung ohne Trigger */
  triggerErfuellt: boolean | null
  text: string
}

export function autoPauseGrund(szenario: Scenario, candles: Candle[], cursor: number, kerze: Candle | undefined = candles[cursor]): AutoPauseGrund | null {
  const z = szenario.entryZone
  if (!z || szenario.richtung === 'keiner') return null
  const trigger = szenario.kriterien?.trigger
  const abstand = szenario.kriterien?.pauseAbstand ?? KRITERIEN.pauseAbstand
  const ab = Math.max(z.barVon, trigger?.bar ?? 0) - 1
  if (cursor < ab || cursor > z.barBis) return null
  const bar = kerze
  if (!bar) return null
  const unten = z.preisVon * (1 - abstand)
  const oben = z.preisBis * (1 + abstand)
  if (bar.low > oben || bar.high < unten) return null

  const zone = zoneText(szenario)
  const triggerErfuellt = trigger ? cursor >= trigger.bar : null
  let text = `Auto-Pause: Der Kurs nähert sich der Entry-Zone (${zone}).`
  if (trigger && triggerErfuellt) text += ` Trigger erfüllt (${trigger.beschreibung}) — jetzt die Limit-Order in die Zone legen.`
  else if (trigger) text += ` Trigger noch offen: ${trigger.beschreibung}. Erst danach die Limit-Order in die Zone legen.`
  else text += ' Jetzt die Limit-Order in die Zone legen.'
  return { zone, triggerErfuellt, text }
}
