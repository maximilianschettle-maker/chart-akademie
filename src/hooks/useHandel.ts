import { useCallback, useMemo, useState } from 'react'
import type { BrokerZustand } from '../engine/broker'
import type { ChartLinie } from '../components/chart/HandelsChart'
import type { PickZiel } from '../components/simulator/OrderTicket'
import { CHART_FARBEN } from '../components/chart/ChartPanel'
import { LEERER_ENTWURF, type OrderEntwurf } from '../engine/orderEntwurf'
import { preisText, zahl } from '../engine/format'

const ENTRY_FARBE = '#F59E0B'

interface Aktionen {
  stopsSetzen: (neu: { stopLoss?: number; takeProfit?: number }) => void
  /** fehlt → wartende Orders sind im Chart nicht verschiebbar */
  orderSetzen?: (neu: { limitPreis?: number; stopLoss?: number; takeProfit?: number }) => void
}

/**
 * Verbindet Order-Ticket und Chart: hält den Order-Entwurf, liefert die
 * Preislinien (Entwurf, wartende Order oder offene Position) und übersetzt
 * Ziehen/Antippen im Chart zurück in Entwurf bzw. Broker-Aktionen.
 */
export function useHandel(broker: BrokerZustand, aktuellerPreis: number, aktionen: Aktionen) {
  const [entwurf, setEntwurf] = useState<OrderEntwurf>(LEERER_ENTWURF)
  const [pickZiel, setPickZiel] = useState<PickZiel | null>(null)
  const { stopsSetzen, orderSetzen } = aktionen

  const entwurfTeil = useCallback(
    (teil: Partial<OrderEntwurf>) => setEntwurf((alt) => ({ ...alt, ...teil })),
    [],
  )

  const { position, offeneOrder } = broker
  const linien = useMemo((): ChartLinie[] => {
    const liste: ChartLinie[] = []
    const linie = (id: string, preis: number, farbe: string, titel: string, extra: Partial<ChartLinie> = {}) => {
      if (preis > 0) liste.push({ id, preis, farbe, titel, imBlick: true, ...extra })
    }
    if (position) {
      linie('pos-entry', position.entryPreis, ENTRY_FARBE, 'Entry', { fest: true })
      linie('pos-sl', position.stopLoss, CHART_FARBEN.short, 'SL', { ziehbar: true })
      linie('pos-tp', position.takeProfit, CHART_FARBEN.long, 'TP', { ziehbar: true })
    } else if (offeneOrder) {
      const verschiebbar = !!orderSetzen
      const titel = offeneOrder.typ === 'stop' ? 'Stop-Entry' : offeneOrder.typ === 'limit' ? 'Limit' : 'Entry'
      linie('ord-entry', offeneOrder.limitPreis ?? 0, ENTRY_FARBE, titel, { ziehbar: verschiebbar })
      linie('ord-sl', offeneOrder.stopLoss, CHART_FARBEN.short, 'SL', { ziehbar: verschiebbar })
      linie('ord-tp', offeneOrder.takeProfit, CHART_FARBEN.long, 'TP', { ziehbar: verschiebbar })
    } else {
      if (entwurf.typ === 'preis') linie('ent-entry', zahl(entwurf.entry), ENTRY_FARBE, 'Einstieg', { ziehbar: true })
      linie('ent-sl', zahl(entwurf.sl), CHART_FARBEN.short, 'SL', { ziehbar: true })
      linie('ent-tp', zahl(entwurf.tp), CHART_FARBEN.long, 'TP', { ziehbar: true })
    }
    return liste
  }, [position, offeneOrder, entwurf.typ, entwurf.entry, entwurf.sl, entwurf.tp, orderSetzen])

  const onLinieZiehen = useCallback(
    (id: string, preis: number) => {
      const text = preisText(preis, aktuellerPreis)
      if (id === 'ent-entry') entwurfTeil({ entry: text })
      else if (id === 'ent-sl') entwurfTeil({ sl: text })
      else if (id === 'ent-tp') entwurfTeil({ tp: text })
    },
    [aktuellerPreis, entwurfTeil],
  )

  const onLinieLos = useCallback(
    (id: string, preis: number) => {
      if (id === 'pos-sl') stopsSetzen({ stopLoss: preis })
      else if (id === 'pos-tp') stopsSetzen({ takeProfit: preis })
      else if (id === 'ord-entry') orderSetzen?.({ limitPreis: preis })
      else if (id === 'ord-sl') orderSetzen?.({ stopLoss: preis })
      else if (id === 'ord-tp') orderSetzen?.({ takeProfit: preis })
    },
    [stopsSetzen, orderSetzen],
  )

  const onPick = useMemo(() => {
    if (!pickZiel) return null
    return (preis: number) => {
      const text = preisText(preis, aktuellerPreis)
      if (pickZiel === 'entry') entwurfTeil({ entry: text, typ: 'preis' })
      else entwurfTeil({ [pickZiel]: text })
      setPickZiel(null)
    }
  }, [pickZiel, aktuellerPreis, entwurfTeil])

  return { entwurf, entwurfTeil, pickZiel, setPickZiel, linien, onLinieZiehen, onLinieLos, onPick }
}
