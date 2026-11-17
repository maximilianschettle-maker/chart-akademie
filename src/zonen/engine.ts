import { fmtPreis } from '../engine/format'
import {
  ANNAEHERUNG_MAX,
  ANNAEHERUNG_MIN,
  ANNAEHERUNG_STANDARD,
  NOTIZ_MAX,
  ZONEN_MARKT_NACH_ID,
  ZONEN_MAX,
  ZONEN_ZEITEINHEITEN,
  type PreisZone,
  type ZonenMarktId,
  type ZonenStand,
  type ZonenTyp,
  type ZonenZeiteinheit,
} from './types'

// Reine Logik rund um Preiszonen (ohne Store, ohne Netz) – läuft im Browser, im Worker und in der Action.

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Zone unter dem Kurs stützt, Zone über dem Kurs deckelt; liegt der Kurs in der Zone, zählt, auf welcher Seite der größere Teil der Zone liegt */
export function typAusLage(von: number, bis: number, kurs: number): ZonenTyp {
  if (!(kurs > 0)) return 'support'
  if (kurs >= bis) return 'support'
  if (kurs <= von) return 'resistance'
  return kurs - von >= bis - kurs ? 'support' : 'resistance'
}

export function neueZone(markt: ZonenMarktId, zeiteinheit: ZonenZeiteinheit, a: number, b: number, kurs: number, jetzt: number, id = `pz-${jetzt.toString(36)}-${Math.random().toString(36).slice(2, 6)}`): PreisZone {
  const von = Math.min(a, b)
  const bis = Math.max(a, b)
  return { id, markt, zeiteinheit, typ: typAusLage(von, bis, kurs), von, bis, notiz: '', sichtbar: true, alarm: true, erstelltAm: jetzt, geaendertAm: jetzt }
}

/** Änderung übernehmen; Kanten bleiben geordnet und positiv, sonst bleibt die Zone, wie sie war */
export function zoneGeaendert(z: PreisZone, teil: Partial<Omit<PreisZone, 'id' | 'erstelltAm'>>, jetzt: number): PreisZone {
  const neu = { ...z, ...teil }
  const von = Math.min(neu.von, neu.bis)
  const bis = Math.max(neu.von, neu.bis)
  if (!(von > 0) || !(bis > von)) return z
  return { ...neu, von, bis, notiz: neu.notiz.slice(0, NOTIZ_MAX), geaendertAm: jetzt }
}

/** Breite der Zone in Prozent ihrer Mitte */
export function zonenBreiteProzent(z: Pick<PreisZone, 'von' | 'bis'>): number {
  const mitte = (z.von + z.bis) / 2
  return mitte > 0 ? ((z.bis - z.von) / mitte) * 100 : 0
}

export function zonenSpanne(z: Pick<PreisZone, 'von' | 'bis'>): string {
  return `${fmtPreis(z.von, z.bis)}–${fmtPreis(z.bis)}`
}

export const TYP_TEXT: Record<ZonenTyp, string> = { support: 'Support', resistance: 'Resistance' }

/** Kurztitel im Chart, z.B. „S · 1 h“ */
export function zonenTitel(z: PreisZone): string {
  const einheit = ZONEN_ZEITEINHEITEN.find((e) => e.id === z.zeiteinheit)?.text ?? z.zeiteinheit
  return `${z.typ === 'support' ? 'S' : 'R'} · ${einheit}${z.alarm ? '' : ' · stumm'}`
}

function zoneAus(roh: unknown): PreisZone | null {
  if (!roh || typeof roh !== 'object') return null
  const r = roh as Partial<PreisZone>
  if (typeof r.id !== 'string' || !r.id || r.id.length > 60) return null
  if (typeof r.markt !== 'string' || !(r.markt in ZONEN_MARKT_NACH_ID)) return null
  if (!ZONEN_ZEITEINHEITEN.some((e) => e.id === r.zeiteinheit)) return null
  if (!istZahl(r.von) || !istZahl(r.bis)) return null
  const von = Math.min(r.von, r.bis)
  const bis = Math.max(r.von, r.bis)
  if (!(von > 0) || !(bis > von)) return null
  return {
    id: r.id,
    markt: r.markt,
    zeiteinheit: r.zeiteinheit as ZonenZeiteinheit,
    typ: r.typ === 'resistance' ? 'resistance' : 'support',
    von,
    bis,
    notiz: typeof r.notiz === 'string' ? r.notiz.slice(0, NOTIZ_MAX) : '',
    sichtbar: r.sichtbar !== false,
    alarm: r.alarm !== false,
    erstelltAm: istZahl(r.erstelltAm) ? r.erstelltAm : 0,
    geaendertAm: istZahl(r.geaendertAm) ? r.geaendertAm : 0,
  }
}

export function annaeherungBegrenzt(wert: unknown): number {
  if (!istZahl(wert)) return ANNAEHERUNG_STANDARD
  return Math.min(ANNAEHERUNG_MAX, Math.max(ANNAEHERUNG_MIN, Math.round(wert * 100) / 100))
}

/** Gespeicherten oder fernen Stand bereinigen: kaputte Zonen raus, doppelte Ids raus, Grenzen einhalten */
export function normalisiereZonen(roh: unknown): ZonenStand {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Partial<ZonenStand>
  const gesehen = new Set<string>()
  const zonen: PreisZone[] = []
  for (const x of Array.isArray(r.zonen) ? r.zonen : []) {
    const z = zoneAus(x)
    if (!z || gesehen.has(z.id)) continue
    gesehen.add(z.id)
    zonen.push(z)
    if (zonen.length >= ZONEN_MAX) break
  }
  return { zonen, annaeherungProzent: annaeherungBegrenzt(r.annaeherungProzent), aktualisiertAm: istZahl(r.aktualisiertAm) ? r.aktualisiertAm : 0 }
}
