// Welche Push-Nachrichten sind jetzt fällig? Reine Logik, getestet; das Senden macht sende-push.ts.
// Drei Anlässe je Termin: Vortag, kurz vorher, Ergebnis. Fenster sind bewusst breit, weil
// GitHub-Cron verspätet laufen kann; der Sendestatus (data/push-status.json) verhindert Doppelungen.

import type { Bank, MakroDaten, ZinsTermin } from '../../src/makro/types.ts'
import type { TrackerDaten } from '../../src/tracker/types.ts'
import { ZONE_EZB } from './zeit.ts'

export interface PushNachricht {
  /** eindeutiger Schlüssel für den Sendestatus, z.B. fed-2026-10-28:vortag */
  key: string
  titel: string
  text: string
  url: string
  tag: string
}

const STUNDE = 3600_000
const MINUTE = 60_000

/** Fenster (relativ zur Entscheidung T): Vortag [T−30h, T−3h], kurz vorher [T−75min, T−15min], Ergebnis [T, T+36h] */
export const FENSTER = {
  vortagVon: 30 * STUNDE,
  vortagBis: 3 * STUNDE,
  kurzVon: 75 * MINUTE,
  kurzBis: 15 * MINUTE,
  ergebnisBis: 36 * STUNDE,
}

export function uhrzeitBerlin(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: ZONE_EZB, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function wochentagDatumBerlin(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: ZONE_EZB, weekday: 'short', day: '2-digit', month: '2-digit' }).format(
    new Date(iso),
  )
}

function datumBerlin(d: Date): string {
  const p: Record<string, string> = {}
  for (const t of new Intl.DateTimeFormat('en-US', { timeZone: ZONE_EZB, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d))
    p[t.type] = t.value
  return `${p.year}-${p.month}-${p.day}`
}

export function fmtProzent(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fedKorridor(unten: number, oben: number): string {
  return `${fmtProzent(unten)}–${fmtProzent(oben)} %`
}

function bankName(bank: Bank): string {
  return bank === 'fed' ? 'Fed' : 'EZB'
}

function aktuellerZins(daten: MakroDaten, bank: Bank): string | null {
  if (bank === 'fed') return daten.fed.zins ? fedKorridor(daten.fed.zins.unten, daten.fed.zins.oben) : null
  return daten.ezb.zins ? `${fmtProzent(daten.ezb.zins.einlage)} %` : null
}

export function faelligePushes(daten: MakroDaten, gesendet: Record<string, string>, jetzt: Date, appUrl: string): PushNachricht[] {
  const liste: PushNachricht[] = []
  const t0 = jetzt.getTime()
  const heute = datumBerlin(jetzt)
  const morgen = datumBerlin(new Date(t0 + 24 * STUNDE))

  const pruefe = (bank: Bank, termin: ZinsTermin) => {
    const T = Date.parse(termin.entscheidungUtc)
    if (!Number.isFinite(T)) return
    const diff = T - t0
    const name = bankName(bank)
    const uhr = uhrzeitBerlin(termin.entscheidungUtc)
    const zins = aktuellerZins(daten, bank)
    const sep = bank === 'fed' && termin.sep ? ', mit Projektionen' : ''
    const basis = `${bank}-${termin.datum}`

    if (diff >= FENSTER.vortagBis && diff <= FENSTER.vortagVon && !gesendet[`${basis}:vortag`]) {
      const wann = datumBerlin(new Date(T)) === morgen ? 'Morgen' : datumBerlin(new Date(T)) === heute ? 'Heute' : wochentagDatumBerlin(termin.entscheidungUtc)
      liste.push({
        key: `${basis}:vortag`,
        titel: `${name}-Zinsentscheidung ${wann.toLowerCase() === 'morgen' ? 'morgen' : wann} ${uhr} Uhr`,
        text: `${wann} um ${uhr} Uhr (deutsche Zeit)${sep}.${zins ? ` Aktuell ${zins}.` : ''}`,
        url: appUrl,
        tag: `${basis}-vortag`,
      })
    }
    if (diff >= FENSTER.kurzBis && diff <= FENSTER.kurzVon && !gesendet[`${basis}:kurz`]) {
      const minuten = Math.round(diff / MINUTE)
      liste.push({
        key: `${basis}:kurz`,
        titel: `In ${minuten} Min: ${name}-Zinsentscheidung`,
        text: `Veröffentlichung um ${uhr} Uhr${sep}.${zins ? ` Aktuell ${zins}.` : ''}`,
        url: appUrl,
        tag: `${basis}-kurz`,
      })
    }
    if (diff <= 0 && -diff <= FENSTER.ergebnisBis && !gesendet[`${basis}:ergebnis`]) {
      const e = bank === 'fed' ? daten.fed.letzteEntscheidung : daten.ezb.letzteEntscheidung
      if (e && e.datum === termin.datum) {
        liste.push({
          key: `${basis}:ergebnis`,
          titel: `${name}: ${e.text}`,
          text: `Entscheidung vom ${wochentagDatumBerlin(termin.entscheidungUtc)}${e.link ? ' – Statement öffnen' : ''}`,
          url: e.link ?? appUrl,
          tag: `${basis}-ergebnis`,
        })
      }
    }
  }

  for (const t of daten.fed.termine) pruefe('fed', t)
  for (const t of daten.ezb.termine) pruefe('ezb', t)
  return liste
}

/** Signale, die nicht älter als so viele Tage sind, werden noch gepusht (Erstlauf soll keine Flut auslösen) */
export const TRACKER_SIGNAL_TAGE = 2
/** Höchstzahl Tracker-Pushes je Lauf */
export const TRACKER_MAX_JE_LAUF = 6

/** Neue Tracker-Signale (aktive Muster, Push an) als Nachrichten; Schlüssel `tracker:<signal-id>` */
export function faelligeTrackerPushes(daten: TrackerDaten, gesendet: Record<string, string>, jetzt: Date, appUrl: string): PushNachricht[] {
  if (!daten.config) return []
  const grenze = new Date(jetzt.getTime() - TRACKER_SIGNAL_TAGE * 86_400_000).toISOString().slice(0, 10)
  const liste: PushNachricht[] = []
  const sammle = (inst: TrackerDaten['instrumente'][number], signale: TrackerDaten['instrumente'][number]['signale'], muster: Record<string, boolean>, stunde: boolean) => {
    for (const s of signale) {
      if (s.datum < grenze || !muster[s.muster] || gesendet[`tracker:${s.id}`]) continue
      liste.push({
        key: `tracker:${s.id}`,
        titel: `${inst.name}${stunde ? ' (1h)' : ''}: ${s.titel}`,
        text: `${s.text}${s.vorlaeufig ? (stunde ? ' (Stundenkerze noch offen)' : ' (Tageskerze noch offen)') : ''}`,
        url: appUrl,
        tag: `tracker-${inst.id}-${s.muster}${stunde ? '-1h' : ''}`,
      })
    }
  }
  for (const inst of daten.instrumente) {
    if (daten.config.push) sammle(inst, inst.signale, daten.config.muster, false)
    if (daten.config.pushStunde && inst.stunde) sammle(inst, inst.stunde.signale, daten.config.musterStunde ?? {}, true)
  }
  liste.sort((a, b) => a.key.localeCompare(b.key))
  return liste.slice(0, TRACKER_MAX_JE_LAUF)
}
