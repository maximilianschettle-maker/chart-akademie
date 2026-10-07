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
import { intervalSekunden } from '../engine/aggregation'
import {
  type Teilstand,
  UNTER_INTERVALL,
  aktuellerStand,
  fertigerStand,
  istKerzeFertig,
  naechsterTeilschritt,
  schritteJeKerze,
  sichtbareKerzen,
  unterkerzenBis,
} from '../engine/intrabar'
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
  /** Intrabar-Cursor: Hauptkerze + verarbeitete Unterkerzen */
  stand: Teilstand
  broker: BrokerZustand
  ereignis: Ereignis | null
}

const NACHLADE_SCHWELLE = 250 // so viele Kerzen vor dem Datenende wird der nächste Block geholt

/**
 * Simulator-Sitzung: Intrabar-Replay über nachwachsende Kerzen (jede Hauptkerze
 * wächst aus ihren Unterkerzen, der Broker prüft je Unterkerze), Nachladen,
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

  const sek = useMemo(() => intervalSekunden(daten.candles), [daten.candles])

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
  const [unter, setUnter] = useState<Candle[]>(daten.unter ?? [])
  const unterRef = useRef(unter)
  useEffect(() => {
    unterRef.current = unter
  }, [unter])
  const unterOderNull = unter.length > 0 ? unter : null
  const [naechsterBlock, setNaechsterBlock] = useState<number | null>(daten.naechsterBlock)
  const [ladeFehler, setLadeFehler] = useState(false)
  const laedtRef = useRef(false)

  const [zustand, setZustand] = useState<Zustand>(() => ({
    stand: fertigerStand(daten.candles, sek, daten.unter?.length ? daten.unter : null, start.cursor),
    broker: start.broker,
    ereignis: null,
  }))
  const [laufend, setLaufendRoh] = useState(false)
  const [tempo, setTempo] = useState<Tempo>(2)
  const [beendet, setBeendet] = useState(false)
  const [zeichnungen, setZeichnungen] = useState<Zeichnung[]>(start.zeichnungen)

  const { stand, broker } = zustand
  const cursor = stand.cursor
  const amDatenEnde = cursor >= candles.length - 1 && istKerzeFertig(candles, sek, unterOderNull, stand)
  const fertig = beendet || (amDatenEnde && naechsterBlock === null)
  const jeKerze = useMemo(() => schritteJeKerze(sek, unterOderNull), [sek, unterOderNull])

  /** n Unterkerzen weiter — hält sofort an, wenn eine Order füllt oder eine Position schließt. */
  const schritte = useCallback((n: number) => {
    setZustand((z) => {
      const alle = candlesRef.current
      const u = unterRef.current.length > 0 ? unterRef.current : null
      let st = z.stand
      let broker = z.broker
      let ereignis = z.ereignis
      for (let i = 0; i < n; i++) {
        const s = naechsterTeilschritt(alle, sek, u, st)
        if (!s) break
        st = s.stand
        const vorher = broker
        broker = barVerarbeiten(broker, s.sub)
        const geschlossen = broker.trades.length > vorher.trades.length
        const gefuellt = !vorher.position && (!!broker.position || geschlossen)
        if (geschlossen || gefuellt) {
          ereignis = {
            nr: (z.ereignis?.nr ?? 0) + 1,
            cursor: st.cursor,
            art: geschlossen ? 'exit' : 'fill',
            trade: geschlossen ? broker.trades[broker.trades.length - 1] : undefined,
          }
          break
        }
      }
      if (st === z.stand) return z
      return { stand: st, broker, ereignis }
    })
  }, [sek])

  // Auto-Pause bei Fill/Exit
  const ereignisNr = zustand.ereignis?.nr ?? 0
  useEffect(() => {
    if (ereignisNr > 0 && einstellungen.pauseBeiEreignis) setLaufendRoh(false)
  }, [ereignisNr, einstellungen.pauseBeiEreignis])

  // Abspielen: Tempo = Hauptkerzen je Sekunde; ab ~25 Schritten/s mehrere Unterkerzen je Tick
  useEffect(() => {
    if (!laufend || fertig) return
    const proSekunde = tempo * jeKerze
    const intervall = Math.max(1000 / proSekunde, 40)
    const jeTick = Math.max(1, Math.round((proSekunde * intervall) / 1000))
    const timer = setInterval(() => schritte(jeTick), intervall)
    return () => clearInterval(timer)
  }, [laufend, tempo, fertig, schritte, jeKerze])

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
      const letzteUnter = unterRef.current[unterRef.current.length - 1]?.time ?? 0
      const neuUnter = block.unter.filter((c) => c.time > letzteUnter && c.time > letzteZeit)
      if (neuUnter.length > 0) setUnter((alt) => [...alt, ...neuUnter])
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

  // Stand sichern: im Stand bei jeder Änderung, im Lauf alle 20 Kerzen.
  // Gesichert wird die letzte VOLLSTÄNDIGE Kerze — eine halb aufgebaute Kerze beginnt nach dem Reload neu.
  const kerzeFertig = istKerzeFertig(candles, sek, unterOderNull, stand)
  const cursorZeit = candles[kerzeFertig ? cursor : Math.max(0, cursor - 1)]?.time ?? config.startZeit
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

  /** Aktueller Kurs und Zeitpunkt (letzte verarbeitete Unterkerze) für Market-Aktionen */
  const jetzt = useCallback(
    (st: Teilstand) => aktuellerStand(candlesRef.current, sek, unterRef.current.length > 0 ? unterRef.current : null, st),
    [sek],
  )

  const platzieren = useCallback(
    (order: Order) => {
      setZustand((z) => {
        const { kerze, zeit } = jetzt(z.stand)
        const neu =
          order.typ === 'market' ? marketSofort(z.broker, order, kerze.close, zeit) : orderPlatzieren(z.broker, order)
        return { ...z, broker: neu }
      })
    },
    [jetzt],
  )

  const stornieren = useCallback(() => setZustand((z) => ({ ...z, broker: orderStornieren(z.broker) })), [])

  const orderSetzen = useCallback(
    (neu: { limitPreis?: number; stopLoss?: number; takeProfit?: number }) =>
      setZustand((z) => ({ ...z, broker: orderAendern(z.broker, neu) })),
    [],
  )

  const schliessen = useCallback(() => {
    setZustand((z) => {
      const { kerze, zeit } = jetzt(z.stand)
      return { ...z, broker: positionSchliessen(z.broker, kerze.close, zeit, 'manuell') }
    })
  }, [jetzt])

  const teilweiseSchliessen = useCallback(
    (anteil: number) => {
      setZustand((z) => {
        const { kerze, zeit } = jetzt(z.stand)
        return { ...z, broker: teilSchliessen(z.broker, anteil, kerze.close, zeit) }
      })
    },
    [jetzt],
  )

  const stopsSetzen = useCallback(
    (neu: { stopLoss?: number; takeProfit?: number; trailingAbstand?: number | null }) =>
      setZustand((z) => ({ ...z, broker: stopsAendern(z.broker, jetzt(z.stand).kerze.close, neu) })),
    [jetzt],
  )

  const aufBreakEven = useCallback(
    () => setZustand((z) => ({ ...z, broker: breakEven(z.broker, jetzt(z.stand).kerze.close) })),
    [jetzt],
  )

  /** Sitzung beenden: offene Position zum aktuellen Kurs glattstellen, Order verwerfen. */
  const beenden = useCallback(() => {
    setLaufendRoh(false)
    setZustand((z) => {
      const { kerze, zeit } = jetzt(z.stand)
      let b = orderStornieren(z.broker)
      if (b.position) b = positionSchliessen(b, kerze.close, zeit, 'szenarioEnde')
      return { ...z, broker: b }
    })
    setBeendet(true)
  }, [jetzt])

  // Datenende erreicht: offene Position automatisch glattstellen
  useEffect(() => {
    if (!beendet && amDatenEnde && naechsterBlock === null) beenden()
  }, [beendet, amDatenEnde, naechsterBlock, beenden])

  // Sichtbare Hauptkerzen (letzte ggf. unfertig) — alles Nachgelagerte (ATR, Rückblick) sieht nur das
  const sichtbar = useMemo(() => sichtbareKerzen(candles, sek, unterOderNull, stand), [candles, sek, unterOderNull, stand])
  const basisUnter = useMemo(() => unterkerzenBis(candles, sek, unterOderNull, stand), [candles, sek, unterOderNull, stand])
  const aktuelleBar = sichtbar[cursor]
  const atr = useMemo(() => letzterAtr(sichtbar, cursor), [sichtbar, cursor])

  return {
    candles: sichtbar,
    cursor,
    teil: stand.teil,
    /** Unterkerzen bis zum aktuellen Schritt (Anzeige im Unter-Timeframe) */
    basisUnter,
    unterVerfuegbar: unter.length > 0,
    unterInterval: UNTER_INTERVALL[config.interval],
    /** Replay-Schritte je Hauptkerze */
    jeKerze,
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
