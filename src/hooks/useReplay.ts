import { useCallback, useEffect, useRef, useState } from 'react'
import type { Candle, Order } from '../types'
import {
  type BrokerZustand,
  neuerBroker,
  orderPlatzieren,
  orderStornieren,
  positionSchliessen,
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
  const [laufend, setLaufend] = useState(false)
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
  stepRef.current = step

  useEffect(() => {
    if (!laufend || fertig) return
    const timer = setInterval(() => stepRef.current(), 1000 / geschwindigkeit)
    return () => clearInterval(timer)
  }, [laufend, geschwindigkeit, fertig])

  useEffect(() => {
    if (fertig) setLaufend(false)
  }, [fertig])

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

  const aktuelleBar = candles[zustand.cursor]

  return {
    cursor: zustand.cursor,
    broker: zustand.broker,
    aktuelleBar,
    aktuellerPreis: aktuelleBar?.close ?? 0,
    laufend,
    geschwindigkeit,
    fertig,
    setLaufend,
    setGeschwindigkeit,
    step,
    platzieren,
    stornieren,
    schliessen,
  }
}
