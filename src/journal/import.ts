import type { ErkanntePosition } from './positionTypes'
import type { AusstiegGrund, JournalEintrag } from './types'
import { marktListe, unixAusOrtszeit, type EintragEntwurf, type MarktDef } from './engine'

// Screenshot-Import: erkannte Broker-Positionen auf Journal-Einträge abbilden, vorhandene Einträge
// wiederfinden (Positions-ID, sonst Symbol + Richtung + Einstieg + Zeit) und entscheiden, was zu tun
// ist: neu anlegen, schließen, Stop/Ziel aktualisieren oder nichts. Reine Logik, getestet.

/** eToro-Kürzel → Instrument-Id des Tracker-Katalogs */
export const ETORO_MARKT: Record<string, string> = {
  NSDQ100: 'nasdaq100',
  NASDAQ100: 'nasdaq100',
  SPX500: 'sp500',
  GER40: 'dax',
  GER30: 'dax',
  ESTX50: 'stoxx50',
  JPN225: 'nikkei',
  GOLD: 'gold',
  XAUUSD: 'gold',
  SILVER: 'silber',
  XAGUSD: 'silber',
  OIL: 'oel',
  USOIL: 'oel',
  BTC: 'bitcoin',
  BTCUSD: 'bitcoin',
  ETH: 'ethereum',
  ETHUSD: 'ethereum',
  EURUSD: 'eurusd',
}

export function marktAusInstrument(instrument: string, maerkte: MarktDef[] = marktListe()): MarktDef | null {
  const kurz = instrument.trim().toUpperCase().replace(/[\s/._-]/g, '')
  const id = ETORO_MARKT[kurz]
  if (id) return maerkte.find((m) => m.id === id) ?? null
  const direkt = maerkte.find((m) => m.symbol.toUpperCase() === instrument.trim().toUpperCase() || m.name.toUpperCase().replace(/\s/g, '') === kurz)
  return direkt ?? null
}

/** Risiko in Kontowährung = Kontrakte × Abstand Einstieg–Stop (so rechnet auch der Broker) */
export function risikoAus(p: Pick<ErkanntePosition, 'kontrakte' | 'eroeffnungskurs' | 'stopLoss'>): number | null {
  if (!p.kontrakte || !p.eroeffnungskurs || !p.stopLoss) return null
  const r = p.kontrakte * Math.abs(p.eroeffnungskurs - p.stopLoss)
  return Number.isFinite(r) && r > 0 ? Math.round(r * 100) / 100 : null
}

/** Entwurf eines neuen Eintrags; Setup und Zeitrahmen setzt der Nutzer, Markt/Symbol bleiben leer bei unbekanntem Instrument */
export function entwurfAus(p: ErkanntePosition, konto: number, jetztSek = Math.floor(Date.now() / 1000)): Partial<EintragEntwurf> {
  const markt = marktAusInstrument(p.instrument)
  const risikoBetrag = risikoAus(p) ?? undefined
  return {
    markt: markt?.name ?? p.instrument,
    symbol: markt?.symbol ?? '',
    waehrung: markt?.waehrung ?? 'USD',
    richtung: p.richtung === 'verkaufen' ? 'short' : 'long',
    entryTime: (p.eroeffnungsdatum ? unixAusOrtszeit(p.eroeffnungsdatum) : null) ?? jetztSek,
    entryPreis: p.eroeffnungskurs ?? 0,
    stopLoss: p.stopLoss ?? 0,
    takeProfit: p.takeProfit ?? 0,
    risikoProzent: risikoBetrag && konto > 0 ? Math.round((risikoBetrag / konto) * 1000) / 10 : 0,
    risikoBetrag,
    hebel: p.hebel ?? undefined,
    brokerId: p.brokerId ?? undefined,
    kontrakte: p.kontrakte ?? undefined,
    einsatz: p.einsatz ?? undefined,
    imPlan: null,
  }
}

function nahe(a: number, b: number, anteil = 0.0005): boolean {
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * anteil
}

/** Ausstiegsgrund aus dem Schlusskurs: am Ziel, am Stop, sonst manuell */
export function ausstiegGrundAus(p: ErkanntePosition): AusstiegGrund {
  if (p.schlusskurs && p.takeProfit && nahe(p.schlusskurs, p.takeProfit, 0.001)) return 'ziel'
  if (p.schlusskurs && p.stopLoss && nahe(p.schlusskurs, p.stopLoss, 0.001)) return 'stop'
  return 'manuell'
}

/** Abschluss-Felder für einen vorhandenen offenen Eintrag */
export function abschlussAus(p: ErkanntePosition, jetztSek = Math.floor(Date.now() / 1000)): Partial<JournalEintrag> {
  return {
    status: 'geschlossen',
    exitPreis: p.schlusskurs ?? undefined,
    exitTime: (p.schlussdatum ? unixAusOrtszeit(p.schlussdatum) : null) ?? jetztSek,
    exitGrund: ausstiegGrundAus(p),
    ergebnisBetrag: p.gewinnVerlust ?? undefined,
    gebuehren: p.uebernachtgebuehren ? Math.abs(p.uebernachtgebuehren) : undefined,
  }
}

/** Vorhandenen Eintrag finden: Positions-ID, sonst Symbol + Richtung + Einstieg (±0,05 %) + Zeit (±15 min) */
export function findeVorhanden(eintraege: JournalEintrag[], p: ErkanntePosition): JournalEintrag | null {
  if (p.brokerId) {
    const perId = eintraege.find((e) => e.brokerId === p.brokerId)
    if (perId) return perId
  }
  const markt = marktAusInstrument(p.instrument)
  if (!markt || !p.eroeffnungskurs) return null
  const richtung = p.richtung === 'verkaufen' ? 'short' : 'long'
  const zeit = p.eroeffnungsdatum ? unixAusOrtszeit(p.eroeffnungsdatum) : null
  return (
    eintraege.find(
      (e) =>
        e.symbol === markt.symbol &&
        e.richtung === richtung &&
        nahe(e.entryPreis, p.eroeffnungskurs!) &&
        (zeit === null || Math.abs(e.entryTime - zeit) <= 15 * 60),
    ) ?? null
  )
}

export type ImportAktion = 'neu' | 'schliessen' | 'aktualisieren' | 'unveraendert'

export interface ImportVorschlag {
  position: ErkanntePosition
  aktion: ImportAktion
  vorhanden: JournalEintrag | null
  /** bei 'neu' */
  entwurf: Partial<EintragEntwurf>
  /** bei 'schliessen' oder 'aktualisieren' */
  aenderung: Partial<JournalEintrag>
  probleme: string[]
}

export function vorschlaege(positionen: ErkanntePosition[], eintraege: JournalEintrag[], konto: number, jetztSek = Math.floor(Date.now() / 1000)): ImportVorschlag[] {
  return positionen.map((p) => {
    const vorhanden = findeVorhanden(eintraege, p)
    const entwurf = entwurfAus(p, konto, jetztSek)
    const probleme: string[] = []
    if (!entwurf.symbol) probleme.push(`Instrument „${p.instrument}“ unbekannt – Markt im Formular wählen.`)
    if (!p.eroeffnungskurs) probleme.push('Eröffnungskurs nicht erkannt.')
    if (!p.stopLoss) probleme.push('Kein Stop erkannt – ohne Stop keine R-Rechnung.')
    if (!p.richtung) probleme.push('Richtung nicht erkannt, Long angenommen.')

    if (p.status === 'geschlossen') {
      if (vorhanden && vorhanden.status === 'offen') {
        return { position: p, aktion: 'schliessen', vorhanden, entwurf, aenderung: abschlussAus(p, jetztSek), probleme }
      }
      if (vorhanden) return { position: p, aktion: 'unveraendert', vorhanden, entwurf, aenderung: {}, probleme }
      // geschlossene Position ohne Eintrag: direkt als geschlossener Eintrag
      return { position: p, aktion: 'neu', vorhanden: null, entwurf: { ...entwurf, ...abschlussAus(p, jetztSek) } as Partial<EintragEntwurf>, aenderung: {}, probleme }
    }

    if (!vorhanden) return { position: p, aktion: 'neu', vorhanden: null, entwurf, aenderung: {}, probleme }
    const aenderung: Partial<JournalEintrag> = {}
    if (p.stopLoss && !nahe(vorhanden.stopLoss, p.stopLoss)) aenderung.stopLoss = p.stopLoss
    if (p.takeProfit && !nahe(vorhanden.takeProfit, p.takeProfit)) aenderung.takeProfit = p.takeProfit
    if (p.brokerId && !vorhanden.brokerId) aenderung.brokerId = p.brokerId
    if (entwurf.risikoBetrag && !vorhanden.risikoBetrag) aenderung.risikoBetrag = entwurf.risikoBetrag
    return {
      position: p,
      aktion: Object.keys(aenderung).length ? 'aktualisieren' : 'unveraendert',
      vorhanden,
      entwurf,
      aenderung,
      probleme,
    }
  })
}

export const AKTION_TEXT: Record<ImportAktion, string> = {
  neu: 'Neu anlegen',
  schliessen: 'Vorhandenen Trade abschließen',
  aktualisieren: 'Stop/Ziel aktualisieren',
  unveraendert: 'Schon im Journal',
}
