import type { Order, Richtung } from '../types'
import { mengeAusRisiko } from './broker'
import { preisText, zahl } from './format'

// Order-Entwurf: der Zustand des Order-Tickets, bevor platziert wird. Liegt beim
// Seiten-Eigentümer, damit Ticket und Chart (ziehbare SL/TP-Linien) dasselbe zeigen.

export interface OrderEntwurf {
  richtung: Richtung
  /** „preis“ = wartende Order; ob Limit oder Stop ergibt sich aus der Lage zum Kurs */
  typ: 'market' | 'preis'
  entry: string
  sl: string
  tp: string
  risikoProzent: number
  trailing: string
  strategieId: string
  notiz: string
}

export const LEERER_ENTWURF: OrderEntwurf = {
  richtung: 'long',
  typ: 'market',
  entry: '',
  sl: '',
  tp: '',
  risikoProzent: 1,
  trailing: '',
  strategieId: '',
  notiz: '',
}

export interface EntwurfAuswertung {
  /** Erwarteter Einstiegskurs (Kurs bei Market, sonst der gesetzte Preis) */
  entryRef: number
  stopLoss: number
  takeProfit: number
  orderTyp: Order['typ']
  menge: number
  risikoBetrag: number
  positionswert: number
  hebel: number
  /** Chance-Risiko-Verhältnis; 0 ohne Take-Profit */
  crv: number
  /** true: Größe wurde auf den Maximal-Hebel begrenzt (Risiko ist dann kleiner als gewählt) */
  gekappt: boolean
  fehler: string | null
}

export function entwurfAuswerten(
  e: OrderEntwurf,
  aktuellerPreis: number,
  kontostand: number,
  optionen: { maxHebel?: number; tpPflicht?: boolean } = {},
): EntwurfAuswertung {
  const maxHebel = optionen.maxHebel ?? 20
  const entry = zahl(e.entry)
  const stopLoss = zahl(e.sl)
  const takeProfit = zahl(e.tp)
  const trailing = zahl(e.trailing)
  const long = e.richtung === 'long'
  const entryRef = e.typ === 'preis' ? entry : aktuellerPreis

  let orderTyp: Order['typ'] = 'market'
  if (e.typ === 'preis') {
    // Besserer Preis als jetzt → Limit; schlechterer (Durchbruch) → Stop
    orderTyp = (long ? entry < aktuellerPreis : entry > aktuellerPreis) ? 'limit' : 'stop'
  }

  let fehler: string | null = null
  if (e.typ === 'preis' && entry <= 0) fehler = 'Einstiegspreis fehlt.'
  else if (stopLoss <= 0) fehler = 'Stop-Loss fehlt — ohne SL kein Trade.'
  else if (long && stopLoss >= entryRef) fehler = 'Long: SL muss unter dem Einstieg liegen.'
  else if (!long && stopLoss <= entryRef) fehler = 'Short: SL muss über dem Einstieg liegen.'
  else if (takeProfit <= 0 && optionen.tpPflicht) fehler = 'Take-Profit fehlt.'
  else if (takeProfit > 0 && long && takeProfit <= entryRef) fehler = 'Long: TP muss über dem Einstieg liegen.'
  else if (takeProfit > 0 && !long && takeProfit >= entryRef) fehler = 'Short: TP muss unter dem Einstieg liegen.'
  else if (e.trailing.trim() !== '' && trailing <= 0) fehler = 'Trailing-Abstand muss größer 0 sein.'

  const wunschRisiko = (kontostand * e.risikoProzent) / 100
  let menge = entryRef > 0 && stopLoss > 0 ? mengeAusRisiko(wunschRisiko, entryRef, stopLoss) : 0
  const maxMenge = entryRef > 0 ? (kontostand * maxHebel) / entryRef : 0
  const gekappt = menge > maxMenge
  if (gekappt) menge = maxMenge

  const abstand = Math.abs(entryRef - stopLoss)
  const positionswert = menge * entryRef
  return {
    entryRef,
    stopLoss,
    takeProfit,
    orderTyp,
    menge,
    risikoBetrag: menge * abstand,
    positionswert,
    hebel: kontostand > 0 ? positionswert / kontostand : 0,
    crv: takeProfit > 0 && abstand > 0 ? Math.abs(takeProfit - entryRef) / abstand : 0,
    gekappt,
    fehler,
  }
}

export function entwurfZuOrder(e: OrderEntwurf, a: EntwurfAuswertung, barIndex: number, mitTag: boolean): Order {
  const trailing = zahl(e.trailing)
  return {
    id: `order-${barIndex}-${Date.now()}`,
    richtung: e.richtung,
    typ: a.orderTyp,
    limitPreis: a.orderTyp === 'market' ? undefined : a.entryRef,
    stopLoss: a.stopLoss,
    takeProfit: a.takeProfit > 0 ? a.takeProfit : 0,
    menge: a.menge,
    erstelltBarIndex: barIndex,
    trailingAbstand: trailing > 0 ? trailing : undefined,
    strategieId: mitTag && e.strategieId ? e.strategieId : undefined,
    notiz: e.notiz.trim() || undefined,
  }
}

/** SL im Abstand von `faktor` × ATR zum Einstieg; ein vorhandener TP behält sein R-Vielfaches. */
export function slAusAtr(e: OrderEntwurf, entryRef: number, atr: number, faktor: number): Partial<OrderEntwurf> {
  if (entryRef <= 0 || atr <= 0) return {}
  const long = e.richtung === 'long'
  const sl = long ? entryRef - faktor * atr : entryRef + faktor * atr
  const alterAbstand = Math.abs(entryRef - zahl(e.sl))
  const alterTp = zahl(e.tp)
  const r = alterTp > 0 && alterAbstand > 0 ? Math.abs(alterTp - entryRef) / alterAbstand : 2
  const tp = long ? entryRef + r * faktor * atr : entryRef - r * faktor * atr
  return { sl: preisText(sl, entryRef), tp: preisText(tp, entryRef) }
}

/** TP als R-Vielfaches des SL-Abstands. */
export function tpAusR(e: OrderEntwurf, entryRef: number, r: number): Partial<OrderEntwurf> {
  const sl = zahl(e.sl)
  if (entryRef <= 0 || sl <= 0) return {}
  const abstand = Math.abs(entryRef - sl)
  const tp = e.richtung === 'long' ? entryRef + r * abstand : entryRef - r * abstand
  return { tp: preisText(tp, entryRef) }
}

/** Richtung wechseln: SL und TP am Einstieg spiegeln, damit der Entwurf gültig bleibt. */
export function richtungWechseln(e: OrderEntwurf, richtung: Richtung, entryRef: number): Partial<OrderEntwurf> {
  if (richtung === e.richtung) return {}
  const sl = zahl(e.sl)
  const tp = zahl(e.tp)
  return {
    richtung,
    sl: sl > 0 && entryRef > 0 ? preisText(2 * entryRef - sl, entryRef) : e.sl,
    tp: tp > 0 && entryRef > 0 && 2 * entryRef - tp > 0 ? preisText(2 * entryRef - tp, entryRef) : '',
  }
}
