import { useCallback, useEffect, useRef, useState } from 'react'
import type { Candle, Order } from '../types'
import {
  type BrokerZustand,
  neuerBroker,
  orderPlatzieren,
  orderStornieren,
  positionSchliessen,
  teilSchliessen,
  stopsAendern,
  breakEven,
  barVerarbeiten,
} from '../engine/broker'

export type Geschwindigkeit = 1 | 2 | 5 | 10

interface ReplayZustand {
  cursor: number
  broker: BrokerZustand
}

/**
 * Bar-by-Bar-Replay über einem festen Kerzen-Array.
 * Der Chart zeigt candles[0..cursor]; jede neue Bar läuft durch den Broker.
 */
export function useReplay(
  candles: Candle[],
  startCursor: number,
  startKapital: number,
  szenarioId?: string,
) {
  const [zustand, setZustand] = useState<ReplayZustand>(() => ({
    cursor: startCursor,
    broker: neuerBroker(startKapital),
  }))
  const [laufend, setLaufendRoh] = useState(false)
  const [geschwindigkeit, setGeschwindigkeit] = useState<Geschwindigkeit>(2)

  const fertig = zustand.cursor >= candles.length - 1

  const step = useCallback(() => {
    setZustand((z) => {
      const naechster = z.cursor + 1
      if (naechster >= candles.length) return z
      const bar = candles[naechster]
      let broker = barVerarbeiten(z.broker, bar, szenarioId)
      // Session-Ende: offene Position zum Schlusskurs der letzten Bar glattstellen
      if (naechster === candles.length - 1 && broker.position) {
        broker = positionSchliessen(broker, bar.close, bar.time, 'szenarioEnde', szenarioId)
      }
      return { cursor: naechster, broker }
    })
  }, [candles, szenarioId])

  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  }, [step])

  // Timer läuft nur, solange „laufend“ und noch Bars übrig sind; am Ende stoppt er
  // sich selbst, ohne einen zusätzlichen Render-Zyklus über einen State-Effekt.
  useEffect(() => {
    if (!laufend || fertig) return
    const timer = setInterval(() => stepRef.current(), 1000 / geschwindigkeit)
    return () => clearInterval(timer)
  }, [laufend, geschwindigkeit, fertig])

  const setLaufend = useCallback(
    (wert: boolean) => setLaufendRoh(wert && !fertig),
    [fertig],
  )

  const platzieren = useCallback((order: Order) => {
    setZustand((z) => ({ ...z, broker: orderPlatzieren(z.broker, order) }))
  }, [])

  const stornieren = useCallback(() => {
    setZustand((z) => ({ ...z, broker: orderStornieren(z.broker) }))
  }, [])

  const schliessen = useCallback(() => {
    setZustand((z) => {
      const bar = candles[z.cursor]
      return { ...z, broker: positionSchliessen(z.broker, bar.close, bar.time, 'manuell', szenarioId) }
    })
  }, [candles, szenarioId])

  const teilweiseSchliessen = useCallback(
    (anteil: number) => {
      setZustand((z) => {
        const bar = candles[z.cursor]
        return { ...z, broker: teilSchliessen(z.broker, anteil, bar.close, bar.time, szenarioId) }
      })
    },
    [candles, szenarioId],
  )

  const stopsSetzen = useCallback(
    (neu: { stopLoss?: number; takeProfit?: number; trailingAbstand?: number | null }) => {
      setZustand((z) => ({ ...z, broker: stopsAendern(z.broker, candles[z.cursor].close, neu) }))
    },
    [candles],
  )

  const aufBreakEven = useCallback(() => {
    setZustand((z) => ({ ...z, broker: breakEven(z.broker, candles[z.cursor].close) }))
  }, [candles])

  const aktuelleBar = candles[zustand.cursor]

  return {
    cursor: zustand.cursor,
    broker: zustand.broker,
    aktuelleBar,
    aktuellerPreis: aktuelleBar?.close ?? 0,
    laufend: laufend && !fertig,
    geschwindigkeit,
    fertig,
    setLaufend,
    setGeschwindigkeit,
    step,
    platzieren,
    stornieren,
    schliessen,
    teilweiseSchliessen,
    stopsSetzen,
    aufBreakEven,
  }
}
