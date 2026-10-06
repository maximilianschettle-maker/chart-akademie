import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Candle, Order, Trade, Zeichnung } from '../types'
import {
  type BrokerZustand,
  FUNDING_RATE,
  neuerBroker,
  orderPlatzieren,
  orderStornieren,
  orderAendern,
  marketSofort,
  positionSchliessen,
  teilSchliessen,
  stopsAendern,
  breakEven,
  barVerarbeiten,
} from '../engine/broker'
import { letzterAtr } from '../engine/indikatoren/atr'
import { ladeBlock, type SitzungConfig, type SitzungDaten } from '../data/sitzung'
import { useSimulatorStore, type GespeicherteSitzung } from '../stores/simulatorStore'

export const GESCHWINDIGKEITEN = [1, 2, 5, 10, 25, 50] as const
export type Tempo = (typeof GESCHWINDIGKEITEN)[number]

export interface Ereignis {
  nr: number
  /** Kerze, an der es passiert ist */
  cursor: number
  art: 'fill' | 'exit'
  trade?: Trade
}

interface Zustand {
  cursor: number
  broker: BrokerZustand
  ereignis: Ereignis | null
}

const NACHLADE_SCHWELLE = 250 // so viele Kerzen vor dem Datenende wird der nächste Block geholt

/**
 * Simulator-Sitzung: Replay über nachwachsende Kerzen, Broker, Nachladen,
 * Auto-Pause bei Fill/Exit und laufendes Sichern (Reload-fest).
 */
export function useSitzung(
  config: SitzungConfig,
  daten: SitzungDaten,
  fortsetzen: GespeicherteSitzung | null,
  /** Wiederholung einer bekannten Stelle: Trades gehen nicht ins Journal, der Stand wird nicht gesichert */
  wiederholung = false,
) {
  const einstellungen = useSimulatorStore((s) => s.einstellungen)
  const tradesUebernehmen = useSimulatorStore((s) => s.tradesUebernehmen)
  const sitzungSpeichern = useSimulatorStore((s) => s.sitzungSpeichern)
  const kontostandStore = useSimulatorStore((s) => s.kontostand)

  // Startwerte einmalig einfrieren (der Store ändert sich während der Sitzung)
  const [start] = useState(() => {
    if (fortsetzen) {
      const i = daten.candles.findIndex((c) => c.time >= fortsetzen.cursorZeit)
      return {
        cursor: i >= 0 ? i : daten.startIndex,
        broker: fortsetzen.broker,
        startKapital: fortsetzen.startKapital,
        zeichnungen: fortsetzen.zeichnungen,
      }
    }
    return {
      // Die letzte Kerze der Vorgeschichte ist „jetzt“ — die erste Replay-Kerze kommt als Nächstes
      cursor: Math.max(0, daten.startIndex - 1),
      broker: neuerBroker(kontostandStore, {
        taker: einstellungen.taker,
        maker: einstellungen.maker,
        slippage: einstellungen.slippage,
        funding: einstellungen.funding ? FUNDING_RATE : 0,
      }),
      startKapital: kontostandStore,
      zeichnungen: [] as Zeichnung[],
    }
  })

  const [candles, setCandles] = useState<Candle[]>(daten.candles)
  const candlesRef = useRef(candles)
  useEffect(() => {
    candlesRef.current = candles
  }, [candles])
  const [naechsterBlock, setNaechsterBlock] = useState<number | null>(daten.naechsterBlock)
  const [ladeFehler, setLadeFehler] = useState(false)
  const laedtRef = useRef(false)

  const [zustand, setZustand] = useState<Zustand>({ cursor: start.cursor, broker: start.broker, ereignis: null })
  const [laufend, setLaufendRoh] = useState(false)
  const [tempo, setTempo] = useState<Tempo>(2)
  const [beendet, setBeendet] = useState(false)
  const [zeichnungen, setZeichnungen] = useState<Zeichnung[]>(start.zeichnungen)

  const { cursor, broker } = zustand
  const amDatenEnde = cursor >= candles.length - 1
  const fertig = beendet || (amDatenEnde && naechsterBlock === null)

  /** n Kerzen weiter — hält sofort an, wenn eine Order füllt oder eine Position schließt. */
  const schritte = useCallback((n: number) => {
    setZustand((z) => {
      const alle = candlesRef.current
      let { cursor, broker } = z
      let ereignis = z.ereignis
      for (let i = 0; i < n && cursor + 1 < alle.length; i++) {
        cursor++
        const vorher = broker
        broker = barVerarbeiten(broker, alle[cursor])
        const geschlossen = broker.trades.length > vorher.trades.length
        const gefuellt = !vorher.position && (!!broker.position || geschlossen)
        if (geschlossen || gefuellt) {
          ereignis = {
            nr: (z.ereignis?.nr ?? 0) + 1,
            cursor,
            art: geschlossen ? 'exit' : 'fill',
            trade: geschlossen ? broker.trades[broker.trades.length - 1] : undefined,
          }
          break
        }
      }
      if (cursor === z.cursor) return z
      return { cursor, broker, ereignis }
    })
  }, [])

  // Auto-Pause bei Fill/Exit
  const ereignisNr = zustand.ereignis?.nr ?? 0
  useEffect(() => {
    if (ereignisNr > 0 && einstellungen.pauseBeiEreignis) setLaufendRoh(false)
  }, [ereignisNr, einstellungen.pauseBeiEreignis])

  // Abspielen: ab 25 Kerzen/s mehrere Kerzen je Tick statt immer kürzerer Timer
  useEffect(() => {
    if (!laufend || fertig) return
    const intervall = Math.max(1000 / tempo, 40)
    const jeTick = Math.max(1, Math.round((tempo * intervall) / 1000))
    const timer = setInterval(() => schritte(jeTick), intervall)
    return () => clearInterval(timer)
  }, [laufend, tempo, fertig, schritte])

  // Nachladen, bevor das Replay das Ende der geladenen Kerzen erreicht
  const nachladen = useCallback(async () => {
    if (laedtRef.current || naechsterBlock === null) return
    laedtRef.current = true
    setLadeFehler(false)
    try {
      const block = await ladeBlock(config, naechsterBlock)
      const letzteZeit = candlesRef.current[candlesRef.current.length - 1]?.time ?? 0
      const neu = block.candles.filter((c) => c.time > letzteZeit)
      if (neu.length > 0) setCandles((alt) => [...alt, ...neu])
      setNaechsterBlock(block.hatMehr ? naechsterBlock + 1 : null)
    } catch {
      setLadeFehler(true)
    } finally {
      laedtRef.current = false
    }
  }, [config, naechsterBlock])

  useEffect(() => {
    if (beendet || ladeFehler || naechsterBlock === null) return
    if (candles.length - 1 - cursor < NACHLADE_SCHWELLE) void nachladen()
  }, [cursor, candles.length, naechsterBlock, beendet, ladeFehler, nachladen])

  // Abgeschlossene Trades laufend ins Journal
  useEffect(() => {
    if (wiederholung || broker.trades.length === 0) return
    tradesUebernehmen(
      broker.trades.map((t): Trade => ({
        ...t,
        id: `${config.id}:${t.id}`,
        interval: config.interval,
        symbol: config.symbol,
      })),
    )
  }, [wiederholung, broker.trades, config.id, config.interval, config.symbol, tradesUebernehmen])

  // Stand sichern: im Stand bei jeder Änderung, im Lauf alle 20 Kerzen
  const cursorZeit = candles[cursor]?.time ?? config.startZeit
  useEffect(() => {
    if (wiederholung) return
    if (fertig) {
      sitzungSpeichern(null)
      return
    }
    if (laufend && cursor % 20 !== 0) return
    sitzungSpeichern({
      config,
      cursorZeit,
      broker,
      zeichnungen,
      startKapital: start.startKapital,
      gespieltKerzen: cursor - daten.startIndex + 1,
    })
  }, [wiederholung, fertig, laufend, cursor, cursorZeit, broker, zeichnungen, config, start.startKapital, daten.startIndex, sitzungSpeichern])

  // Beim Verlassen der Seite mitten im Lauf den letzten Stand sichern
  const standRef = useRef<GespeicherteSitzung | null>(null)
  useEffect(() => {
    standRef.current = fertig
      ? null
      : {
          config,
          cursorZeit,
          broker,
          zeichnungen,
          startKapital: start.startKapital,
          gespieltKerzen: cursor - daten.startIndex + 1,
        }
  })
  useEffect(
    () => () => {
      if (!wiederholung) sitzungSpeichern(standRef.current)
    },
    [wiederholung, sitzungSpeichern],
  )

  const setLaufend = useCallback((wert: boolean) => setLaufendRoh(wert), [])

  const platzieren = useCallback((order: Order) => {
    setZustand((z) => {
      const bar = candlesRef.current[z.cursor]
      const neu =
        order.typ === 'market'
          ? marketSofort(z.broker, order, bar.close, bar.time)
          : orderPlatzieren(z.broker, order)
      return { ...z, broker: neu }
    })
  }, [])

  const stornieren = useCallback(() => setZustand((z) => ({ ...z, broker: orderStornieren(z.broker) })), [])

  const orderSetzen = useCallback(
    (neu: { limitPreis?: number; stopLoss?: number; takeProfit?: number }) =>
      setZustand((z) => ({ ...z, broker: orderAendern(z.broker, neu) })),
    [],
  )

  const schliessen = useCallback(() => {
    setZustand((z) => {
      const bar = candlesRef.current[z.cursor]
      return { ...z, broker: positionSchliessen(z.broker, bar.close, bar.time, 'manuell') }
    })
  }, [])

  const teilweiseSchliessen = useCallback((anteil: number) => {
    setZustand((z) => {
      const bar = candlesRef.current[z.cursor]
      return { ...z, broker: teilSchliessen(z.broker, anteil, bar.close, bar.time) }
    })
  }, [])

  const stopsSetzen = useCallback(
    (neu: { stopLoss?: number; takeProfit?: number; trailingAbstand?: number | null }) =>
      setZustand((z) => ({ ...z, broker: stopsAendern(z.broker, candlesRef.current[z.cursor].close, neu) })),
    [],
  )

  const aufBreakEven = useCallback(
    () => setZustand((z) => ({ ...z, broker: breakEven(z.broker, candlesRef.current[z.cursor].close) })),
    [],
  )

  /** Sitzung beenden: offene Position zum aktuellen Kurs glattstellen, Order verwerfen. */
  const beenden = useCallback(() => {
    setLaufendRoh(false)
    setZustand((z) => {
      const bar = candlesRef.current[z.cursor]
      let b = orderStornieren(z.broker)
      if (b.position) b = positionSchliessen(b, bar.close, bar.time, 'szenarioEnde')
      return { ...z, broker: b }
    })
    setBeendet(true)
  }, [])

  // Datenende erreicht: offene Position automatisch glattstellen
  useEffect(() => {
    if (!beendet && amDatenEnde && naechsterBlock === null) beenden()
  }, [beendet, amDatenEnde, naechsterBlock, beenden])

  const aktuelleBar = candles[cursor]
  const atr = useMemo(() => letzterAtr(candles, cursor), [candles, cursor])

  return {
    candles,
    cursor,
    broker,
    startIndex: daten.startIndex,
    startKapital: start.startKapital,
    aktuelleBar,
    aktuellerPreis: aktuelleBar?.close ?? 0,
    atr,
    ereignis: zustand.ereignis,
    laufend: laufend && !fertig,
    tempo,
    fertig,
    /** Replay wartet auf nachzuladende Kerzen */
    wartetAufDaten: amDatenEnde && naechsterBlock !== null && !beendet,
    ladeFehler,
    nachladen,
    setLaufend,
    setTempo,
    schritte,
    platzieren,
    stornieren,
    orderSetzen,
    schliessen,
    teilweiseSchliessen,
    stopsSetzen,
    aufBreakEven,
    beenden,
    zeichnungen,
    setZeichnungen,
  }
}
