import type { Candle } from '../types'
import { aggregiere } from '../engine/aggregation'
import { fmtPreis } from '../engine/format'
import { TYP_TEXT, zonenSpanne } from './engine'
import { ZONEN_MARKT_NACH_ID, ZONEN_ZEITEINHEITEN, type PreisZone, type ZonenMarktId, type ZonenStand, type ZonenTyp, type ZonenZeiteinheit } from './types'

// Alarm-Logik der Preiszonen – rein, ohne Netz. Läuft in der Tracker-Action (scripts/tracker/zonen-alarm.ts);
// der Zustand je Zone liegt im Worker-KV (zonenstatus:<nutzerId>), nie im öffentlichen Repo.
//
//   nah        Kurs innerhalb von X % vor der Zone
//   drin       Kurs innerhalb des Bands
//   gebrochen  eine abgeschlossene Kerze der Zeiteinheit schließt jenseits der Zone (Support: darunter,
//              Resistance: darüber), die Kerze davor schloss noch nicht jenseits
//
// Je Eintritt ein Alarm: „drin“ wird erst wieder scharf, wenn der Kurs die Zone verlassen hat, „nah“ erst,
// wenn er auch den Annäherungsbereich verlassen hat. Bewertet wird nicht nur der letzte Kurs, sondern das
// Fenster der letzten 45 Minuten (15-Minuten-Kerzen): so geht ein Docht zwischen zwei Läufen nicht verloren,
// und ein Kurs, der an der Kante zappelt, löst nicht bei jedem Lauf neu aus.
// Eine neue oder verschobene Zone startet still: gemeldet wird erst die nächste Änderung.

export type AlarmArt = 'nah' | 'drin' | 'gebrochen'
export type Lage = 'fern' | 'nah' | 'drin'

export interface ZonenZustand {
  /** „von|bis“ – ändern sich die Kanten, beginnt die Zone neu */
  kanten: string
  nah: boolean
  drin: boolean
  /** Kerzen bis zu diesem Beginn (Unix-Sekunden) zählen nicht mehr für „gebrochen“: Stand beim Anlegen bzw. die zuletzt gemeldete Bruchkerze */
  bruchKerze: number
}

export interface ZonenAlarm {
  id: string
  zoneId: string
  markt: ZonenMarktId
  art: AlarmArt
  /** Zeitpunkt der Prüfung (ms) */
  zeit: number
  kurs: number
  von: number
  bis: number
  typ: ZonenTyp
  zeiteinheit: ZonenZeiteinheit
  notiz: string
  /** nah: Abstand zur Zone in Prozent des Kurses */
  abstandProzent?: number
  /** gebrochen: Schlusskurs der Kerze */
  schluss?: number
}

export interface ZonenStatus {
  zustand: Record<string, ZonenZustand>
  /** jüngste zuerst, höchstens ALARME_MAX */
  alarme: ZonenAlarm[]
  aktualisiertAm: number
}

export interface MarktDaten {
  kurs: number
  /** Zeit des Kurses (ms) */
  kursZeit: number
  k15: Candle[]
  k1h: Candle[]
  k1d: Candle[]
}

export const ALARME_MAX = 50
export const LEERER_STATUS: ZonenStatus = { zustand: {}, alarme: [], aktualisiertAm: 0 }
/** Fenster für nah/drin */
const FENSTER_SEK = 45 * 60
/** Ältere Kurse (Börse zu, Quelle hängt) lösen kein nah/drin aus */
const KURS_MAX_ALTER_MS = 40 * 60_000
/** so viele abgeschlossene Kerzen zurück wird ein Bruch gesucht (ausgefallene Läufe) */
const BRUCH_RUECKSCHAU = 6
const DAUER_SEK: Record<ZonenZeiteinheit, number> = { '15m': 900, '1h': 3600, '4h': 4 * 3600, '1d': 86_400 }

const kantenText = (z: Pick<PreisZone, 'von' | 'bis'>) => `${z.von}|${z.bis}`

/** Lage des Kurses zur Zone über das Fenster [tief, hoch] */
export function lageZurZone(z: Pick<PreisZone, 'von' | 'bis'>, tief: number, hoch: number, kurs: number, annaeherungProzent: number): { lage: Lage; abstandProzent: number } {
  if (hoch >= z.von && tief <= z.bis) return { lage: 'drin', abstandProzent: 0 }
  const abstand = tief > z.bis ? tief - z.bis : z.von - hoch
  const abstandProzent = kurs > 0 ? (abstand / kurs) * 100 : Infinity
  return { lage: abstandProzent <= annaeherungProzent ? 'nah' : 'fern', abstandProzent }
}

/** Tief und Hoch der letzten 45 Minuten inklusive aktuellem Kurs */
export function fenster(d: MarktDaten, jetztMs: number): { tief: number; hoch: number } {
  let tief = d.kurs
  let hoch = d.kurs
  const ab = jetztMs / 1000 - FENSTER_SEK
  for (let i = d.k15.length - 1; i >= 0 && d.k15[i].time + 900 > ab; i--) {
    tief = Math.min(tief, d.k15[i].low)
    hoch = Math.max(hoch, d.k15[i].high)
  }
  return { tief, hoch }
}

/** Abgeschlossene Kerzen der Zeiteinheit (die laufende letzte fällt weg) */
export function abgeschlosseneKerzen(d: MarktDaten, einheit: ZonenZeiteinheit, jetztMs: number): Candle[] {
  const roh = einheit === '15m' ? d.k15 : einheit === '1d' ? d.k1d : einheit === '4h' ? aggregiere(d.k1h, DAUER_SEK['4h']) : d.k1h
  if (roh.length === 0) return roh
  const letzte = roh[roh.length - 1]
  return letzte.time + DAUER_SEK[einheit] <= jetztMs / 1000 ? roh : roh.slice(0, -1)
}

const jenseits = (z: Pick<PreisZone, 'von' | 'bis' | 'typ'>, schluss: number) => (z.typ === 'support' ? schluss < z.von : schluss > z.bis)

export interface PruefErgebnis {
  status: ZonenStatus
  /** neue Alarme dieses Laufs */
  alarme: ZonenAlarm[]
  /** Zustand oder Alarmliste haben sich geändert → speichern */
  geaendert: boolean
}

export function pruefeZonen(stand: ZonenStand, alt: ZonenStatus | null, daten: Partial<Record<ZonenMarktId, MarktDaten>>, jetztMs: number): PruefErgebnis {
  const vorher = alt ?? LEERER_STATUS
  const zustand: Record<string, ZonenZustand> = {}
  const alarme: ZonenAlarm[] = []

  for (const z of stand.zonen) {
    if (!z.alarm) continue // stumm: Zustand fällt weg, beim Einschalten startet die Zone still
    const d = daten[z.markt]
    const bisher = vorher.zustand[z.id]
    if (!d) {
      // Markt in diesem Lauf nicht geladen: Zustand unverändert mitnehmen
      if (bisher) zustand[z.id] = bisher
      continue
    }
    const kursFrisch = jetztMs - d.kursZeit <= KURS_MAX_ALTER_MS
    const f = fenster(d, jetztMs)
    const { lage } = lageZurZone(z, f.tief, f.hoch, d.kurs, stand.annaeherungProzent)
    const kerzen = abgeschlosseneKerzen(d, z.zeiteinheit, jetztMs)
    const letzteZeit = kerzen.length ? kerzen[kerzen.length - 1].time : 0

    if (!bisher || bisher.kanten !== kantenText(z)) {
      zustand[z.id] = { kanten: kantenText(z), nah: lage !== 'fern', drin: lage === 'drin', bruchKerze: letzteZeit }
      continue
    }

    const neu: ZonenZustand = { ...bisher }
    const alarm = (art: AlarmArt, extra: Partial<ZonenAlarm> = {}) =>
      alarme.push({ id: `${z.id}:${art}:${jetztMs}`, zoneId: z.id, markt: z.markt, art, zeit: jetztMs, kurs: d.kurs, von: z.von, bis: z.bis, typ: z.typ, zeiteinheit: z.zeiteinheit, notiz: z.notiz, ...extra })

    // gebrochen: jüngste Kerze nach bruchKerze, die jenseits schließt, während die davor es nicht tat.
    // bruchKerze rückt nur bei einem Alarm vor – sonst müsste der Zustand bei jeder neuen Kerze ins KV.
    for (let i = kerzen.length - 1; i >= Math.max(1, kerzen.length - BRUCH_RUECKSCHAU) && kerzen[i].time > bisher.bruchKerze; i--) {
      if (jenseits(z, kerzen[i].close) && !jenseits(z, kerzen[i - 1].close)) {
        alarm('gebrochen', { schluss: kerzen[i].close })
        neu.bruchKerze = kerzen[i].time
        break
      }
    }

    if (kursFrisch) {
      if (lage === 'drin') {
        if (!bisher.drin) alarm('drin')
        neu.drin = true
        neu.nah = true
      } else if (lage === 'nah') {
        // im Text der Abstand des aktuellen Kurses, nicht der des Fenster-Extrems
        if (!bisher.nah) alarm('nah', { abstandProzent: lageZurZone(z, d.kurs, d.kurs, d.kurs, stand.annaeherungProzent).abstandProzent })
        neu.drin = false
        neu.nah = true
      } else {
        neu.drin = false
        neu.nah = false
      }
    }
    zustand[z.id] = neu
  }

  const geaendert = alarme.length > 0 || JSON.stringify(zustand) !== JSON.stringify(vorher.zustand)
  return {
    status: geaendert ? { zustand, alarme: [...alarme].reverse().concat(vorher.alarme).slice(0, ALARME_MAX), aktualisiertAm: jetztMs } : vorher,
    alarme,
    geaendert,
  }
}

// ── Texte ─────────────────────────────────────────────────────────────────────

export const ALARM_TEXT: Record<AlarmArt, string> = { nah: 'Nähert sich', drin: 'In der Zone', gebrochen: 'Gebrochen' }

export interface AlarmNachricht {
  titel: string
  text: string
  tag: string
  /** Pfad hinter dem # der App */
  pfad: string
}

const prozent = (p: number) => p.toFixed(2).replace('.', ',')

/** Push-Text: Markt, Zone, aktueller Preis */
export function alarmNachricht(a: ZonenAlarm): AlarmNachricht {
  const markt = ZONEN_MARKT_NACH_ID[a.markt]?.name ?? a.markt
  const zone = `${TYP_TEXT[a.typ]} ${zonenSpanne(a)}`
  const einheit = ZONEN_ZEITEINHEITEN.find((e) => e.id === a.zeiteinheit)?.text ?? a.zeiteinheit
  const kurs = `Kurs ${fmtPreis(a.kurs)}`
  const notiz = a.notiz ? ` · ${a.notiz.slice(0, 80)}` : ''
  let titel: string
  let text: string
  if (a.art === 'nah') {
    titel = `${markt}: nähert sich ${zone}`
    text = `${kurs}, noch ${prozent(a.abstandProzent ?? 0)} % bis zur Zone${notiz}`
  } else if (a.art === 'drin') {
    titel = `${markt}: in der Zone ${zonenSpanne(a)}`
    text = `${kurs} · ${TYP_TEXT[a.typ]} (${einheit})${notiz}`
  } else {
    titel = `${markt}: ${zone} gebrochen`
    text = `${einheit}-Kerze schließt bei ${fmtPreis(a.schluss ?? a.kurs)} ${a.typ === 'support' ? 'unter' : 'über'} der Zone. ${kurs}${notiz}`
  }
  return { titel, text, tag: `zone-${a.zoneId}`, pfad: `/analyse/zonen?zone=${encodeURIComponent(a.zoneId)}` }
}

function zustandAus(roh: unknown): ZonenZustand | null {
  const r = roh as Partial<ZonenZustand> | null
  if (!r || typeof r !== 'object' || typeof r.kanten !== 'string' || typeof r.bruchKerze !== 'number') return null
  return { kanten: r.kanten, nah: r.nah === true, drin: r.drin === true, bruchKerze: r.bruchKerze }
}

/** Status aus dem KV bzw. aus einer Dienst-Anfrage bereinigen */
export function normalisiereStatus(roh: unknown): ZonenStatus {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Partial<ZonenStatus>
  const zustand: Record<string, ZonenZustand> = {}
  for (const [id, x] of Object.entries(r.zustand && typeof r.zustand === 'object' ? r.zustand : {})) {
    const z = zustandAus(x)
    if (z && id.length <= 60) zustand[id] = z
  }
  const alarme = (Array.isArray(r.alarme) ? r.alarme : [])
    .filter((a): a is ZonenAlarm => !!a && typeof a === 'object' && typeof a.id === 'string' && typeof a.zoneId === 'string' && a.markt in ZONEN_MARKT_NACH_ID && a.art in ALARM_TEXT && typeof a.zeit === 'number' && typeof a.kurs === 'number')
    .slice(0, ALARME_MAX)
  return { zustand, alarme, aktualisiertAm: typeof r.aktualisiertAm === 'number' ? r.aktualisiertAm : 0 }
}
