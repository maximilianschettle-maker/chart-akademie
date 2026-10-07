import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Candle, Order } from '../types'
import {
  type BrokerZustand,
  neuerBroker,
  orderPlatzieren,
  orderStornieren,
  marketSofort,
  positionSchliessen,
  teilSchliessen,
  stopsAendern,
  breakEven,
  barVerarbeiten,
} from '../engine/broker'
import { intervalSekunden } from '../engine/aggregation'
import {
  type Teilstand,
  aktuellerStand,
  fertigerStand,
  istKerzeFertig,
  naechsterTeilschritt,
  schritteJeKerze,
  sichtbareKerzen,
  unterkerzenBis,
} from '../engine/intrabar'

export type Geschwindigkeit = 1 | 2 | 5 | 10

interface ReplayZustand {
  stand: Teilstand
  broker: BrokerZustand
}

/**
 * Intrabar-Replay über einem festen Kerzen-Array: Jede Hauptkerze wächst aus
 * ihren Unterkerzen (echte 15m/1h-Daten oder OHLC-Pfad); jede Unterkerze läuft
 * durch den Broker. Der Chart zeigt candles[0..cursor], die letzte ggf. unfertig.
 */
export function useReplay(
  candles: Candle[],
  startCursor: number,
  startKapital: number,
  szenarioId?: string,
  unter: Candle[] | null = null,
) {
  const sek = useMemo(() => intervalSekunden(candles), [candles])
  const [zustand, setZustand] = useState<ReplayZustand>(() => ({
    stand: fertigerStand(candles, sek, unter, startCursor),
    broker: neuerBroker(startKapital),
  }))
  const [laufend, setLaufendRoh] = useState(false)
  const [geschwindigkeit, setGeschwindigkeit] = useState<Geschwindigkeit>(2)

  const { stand } = zustand
  const fertig = stand.cursor >= candles.length - 1 && istKerzeFertig(candles, sek, unter, stand)
  const jeKerze = useMemo(() => schritteJeKerze(sek, unter), [sek, unter])

  /** Eine Unterkerze weiter. */
  const step = useCallback(() => {
    setZustand((z) => {
      const s = naechsterTeilschritt(candles, sek, unter, z.stand)
      if (!s) return z
      let broker = barVerarbeiten(z.broker, s.sub, szenarioId)
      // Session-Ende: offene Position zum letzten Kurs glattstellen
      if (s.stand.cursor === candles.length - 1 && s.kerzeFertig && broker.position) {
        broker = positionSchliessen(broker, s.sub.close, s.sub.time, 'szenarioEnde', szenarioId)
      }
      return { stand: s.stand, broker }
    })
  }, [candles, sek, unter, szenarioId])

  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  }, [step])

  // Timer läuft nur, solange „laufend“ und noch Schritte übrig sind; Tempo = Hauptkerzen je Sekunde
  useEffect(() => {
    if (!laufend || fertig) return
    const timer = setInterval(() => stepRef.current(), 1000 / (geschwindigkeit * jeKerze))
    return () => clearInterval(timer)
  }, [laufend, geschwindigkeit, fertig, jeKerze])

  const setLaufend = useCallback(
    (wert: boolean) => setLaufendRoh(wert && !fertig),
    [fertig],
  )

  // Market füllt sofort zum aktuellen Kurs (Schlusskurs der letzten verarbeiteten Unterkerze)
  const platzieren = useCallback(
    (order: Order) => {
      setZustand((z) => {
        const { kerze, zeit } = aktuellerStand(candles, sek, unter, z.stand)
        const broker =
          order.typ === 'market'
            ? marketSofort(z.broker, order, kerze.close, zeit)
            : orderPlatzieren(z.broker, order)
        return { ...z, broker }
      })
    },
    [candles, sek, unter],
  )

  const stornieren = useCallback(() => {
    setZustand((z) => ({ ...z, broker: orderStornieren(z.broker) }))
  }, [])

  const schliessen = useCallback(() => {
    setZustand((z) => {
      const { kerze, zeit } = aktuellerStand(candles, sek, unter, z.stand)
      return { ...z, broker: positionSchliessen(z.broker, kerze.close, zeit, 'manuell', szenarioId) }
    })
  }, [candles, sek, unter, szenarioId])

  const teilweiseSchliessen = useCallback(
    (anteil: number) => {
      setZustand((z) => {
        const { kerze, zeit } = aktuellerStand(candles, sek, unter, z.stand)
        return { ...z, broker: teilSchliessen(z.broker, anteil, kerze.close, zeit, szenarioId) }
      })
    },
    [candles, sek, unter, szenarioId],
  )

  const stopsSetzen = useCallback(
    (neu: { stopLoss?: number; takeProfit?: number; trailingAbstand?: number | null }) => {
      setZustand((z) => ({ ...z, broker: stopsAendern(z.broker, aktuellerStand(candles, sek, unter, z.stand).kerze.close, neu) }))
    },
    [candles, sek, unter],
  )

  const aufBreakEven = useCallback(() => {
    setZustand((z) => ({ ...z, broker: breakEven(z.broker, aktuellerStand(candles, sek, unter, z.stand).kerze.close) }))
  }, [candles, sek, unter])

  /** „Kein Trade“: alle restlichen Unterkerzen in einem Rutsch durch den Broker laufen lassen. */
  const zumEnde = useCallback(() => {
    setLaufendRoh(false)
    setZustand((z) => {
      let st = z.stand
      let broker = z.broker
      for (;;) {
        const s = naechsterTeilschritt(candles, sek, unter, st)
        if (!s) break
        st = s.stand
        broker = barVerarbeiten(broker, s.sub, szenarioId)
        if (st.cursor === candles.length - 1 && s.kerzeFertig && broker.position) {
          broker = positionSchliessen(broker, s.sub.close, s.sub.time, 'szenarioEnde', szenarioId)
        }
      }
      return { stand: st, broker }
    })
  }, [candles, sek, unter, szenarioId])

  // Sichtbare Hauptkerzen (letzte ggf. unfertig) und Unterkerzen bis zum aktuellen Schritt
  const sichtbar = useMemo(() => sichtbareKerzen(candles, sek, unter, stand), [candles, sek, unter, stand])
  const basisUnter = useMemo(() => unterkerzenBis(candles, sek, unter, stand), [candles, sek, unter, stand])
  const aktuelleBar = sichtbar[stand.cursor]

  return {
    cursor: stand.cursor,
    teil: stand.teil,
    broker: zustand.broker,
    aktuelleBar,
    aktuellerPreis: aktuelleBar?.close ?? 0,
    /** Hauptkerzen 0..cursor, die letzte ggf. erst teilweise aufgebaut */
    sichtbar,
    /** Unterkerzen bis zum aktuellen Schritt (Anzeige im Unter-Timeframe) */
    basisUnter,
    unterVerfuegbar: !!unter && unter.length > 0,
    jeKerze,
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
    zumEnde,
  }
}
