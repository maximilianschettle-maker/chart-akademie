// Verschickt fällige Web-Push-Nachrichten (VAPID) an alle Push-Abos aus dem Worker.
//   node scripts/macro/sende-push.ts            → fällige Pushes laut public/data/macro.json + tracker.json
//   node scripts/macro/sende-push.ts --test "…" → eine Testnachricht an alle Geräte, Status bleibt unberührt
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), AKTIEN_WORKER_URL (optional,
// Standard: der Worker der ChartAkademie), AKTIEN_SECRET (Dienst-Token), APP_URL (Link beim Antippen).
// Übergangsweise: PUSH_SUBSCRIPTION (das alte Einzel-Abo als Secret) wird noch mitgenommen.
// Sendestatus: data/push-status.json je Gerät (wird committet, verhindert Doppel-Pushes bei Cron-Verspätung).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import webpush, { WebPushError, type PushSubscription } from 'web-push'
import type { MakroDaten } from '../../src/makro/types.ts'
import type { TrackerConfig, TrackerDaten } from '../../src/tracker/types.ts'
import { faelligePushes, faelligeTrackerPushes, type PushNachricht } from './push-logik.ts'
import { aufraeumen, endpointHash, gesendetFuer, markiere, type Status } from './push-status.ts'

const WURZEL = fileURLToPath(new URL('../../', import.meta.url))
const MAKRO = join(WURZEL, 'public', 'data', 'macro.json')
const TRACKER = join(WURZEL, 'public', 'data', 'tracker.json')
const STATUS = join(WURZEL, 'data', 'push-status.json')
const AUFBEWAHRUNG_MS = 60 * 86400_000
const STANDARD_APP_URL = 'https://maximilianschettle-maker.github.io/chart-akademie/#/makro'
const STANDARD_WORKER_URL = 'https://chart-akademie-aktien.chart-akademie.workers.dev'

interface Abo extends PushSubscription {
  geraet?: string
}
interface Nutzer {
  nutzerId: string
  abos: Abo[]
  tracker: TrackerConfig | null
}

function log(...t: unknown[]) {
  console.log(new Date().toISOString().slice(11, 19), ...t)
}

function liesStatus(): Status {
  if (!existsSync(STATUS)) return { gesendet: {} }
  try {
    const s = JSON.parse(readFileSync(STATUS, 'utf8')) as Partial<Status>
    return { gesendet: s.gesendet ?? {} }
  } catch {
    return { gesendet: {} }
  }
}

function subscriptionAusEnv(roh: string | undefined): PushSubscription | null {
  if (!roh?.trim()) return null
  try {
    const s = JSON.parse(roh) as Partial<PushSubscription>
    if (typeof s.endpoint !== 'string' || !s.keys?.p256dh || !s.keys?.auth) return null
    return s as PushSubscription
  } catch {
    return null
  }
}

async function nutzerVomWorker(url: string, secret: string): Promise<Nutzer[]> {
  const res = await fetch(`${url}/api/dienst/push`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Worker antwortet ${res.status}`)
  const d = (await res.json()) as { nutzer?: Nutzer[] }
  return Array.isArray(d.nutzer) ? d.nutzer : []
}

async function abgelaufenMelden(url: string, secret: string, abgelaufen: { nutzerId: string; endpoint: string }[]): Promise<void> {
  if (abgelaufen.length === 0) return
  try {
    const res = await fetch(`${url}/api/dienst/push/abgelaufen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ abgelaufen }),
      signal: AbortSignal.timeout(20_000),
    })
    const d = (await res.json()) as { entfernt?: number }
    log('Abgelaufene Abos im Worker entfernt:', d.entfernt ?? '?')
  } catch (e) {
    log('Abgelaufene Abos konnten nicht gemeldet werden:', (e as Error).message)
  }
}

/** Tracker-Daten auf die Auswahl eines Nutzers zuschneiden (Instrumente, Muster, Push-Schalter). */
function trackerFuer(daten: TrackerDaten, config: TrackerConfig | null): TrackerDaten {
  if (!config) return daten
  return { ...daten, config, instrumente: daten.instrumente.filter((i) => config.instrumente.includes(i.id)) }
}

async function main() {
  const testIndex = process.argv.indexOf('--test')
  const test = testIndex >= 0
  const testText = test ? process.argv[testIndex + 1] || 'Testnachricht aus der GitHub Action' : ''

  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:chart-akademie@users.noreply.github.com'
  const appUrl = process.env.APP_URL?.trim() || STANDARD_APP_URL
  const workerUrl = (process.env.AKTIEN_WORKER_URL?.trim() || STANDARD_WORKER_URL).replace(/\/+$/, '')
  const secret = process.env.AKTIEN_SECRET?.trim()

  if (!pub || !priv) {
    log('VAPID-Schlüssel fehlen (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) – Push übersprungen')
    if (test) process.exit(1)
    return
  }
  webpush.setVapidDetails(subject, pub, priv)

  // Empfänger: alle Nutzer mit Abos aus dem Worker, übergangsweise plus das alte Einzel-Abo
  const nutzer: Nutzer[] = []
  if (secret) {
    try {
      nutzer.push(...(await nutzerVomWorker(workerUrl, secret)))
    } catch (e) {
      log('Abos vom Worker nicht geholt:', (e as Error).message)
    }
  } else {
    log('AKTIEN_SECRET fehlt – keine Abos vom Worker')
  }
  const alt = subscriptionAusEnv(process.env.PUSH_SUBSCRIPTION)
  if (alt && !nutzer.some((n) => n.abos.some((a) => a.endpoint === alt.endpoint))) nutzer.push({ nutzerId: 'legacy', abos: [alt], tracker: null })
  const geraete = nutzer.reduce((n, u) => n + u.abos.length, 0)
  if (geraete === 0) {
    log('Keine Push-Abos – Push übersprungen')
    if (test) process.exit(1)
    return
  }
  log(nutzer.length, 'Nutzer,', geraete, 'Geräte')

  const status = liesStatus()
  const makro = existsSync(MAKRO) ? (JSON.parse(readFileSync(MAKRO, 'utf8')) as MakroDaten) : null
  const tracker = existsSync(TRACKER) ? (JSON.parse(readFileSync(TRACKER, 'utf8')) as TrackerDaten) : null
  if (!makro) log('macro.json fehlt – keine Zins-Pushes')
  const trackerUrl = appUrl.replace(/#.*$/, '') + '#/tracker'
  const jetzt = new Date()

  let gesendet = 0
  let fehler = 0
  const abgelaufen: { nutzerId: string; endpoint: string }[] = []

  for (const u of nutzer) {
    for (const abo of u.abos) {
      const hash = endpointHash(abo.endpoint)
      let nachrichten: PushNachricht[]
      if (test) {
        nachrichten = [{ key: `test:${Date.now()}`, titel: 'ChartAkademie: Test-Push', text: testText, url: appUrl, tag: 'test' }]
      } else {
        const schonGesendet = gesendetFuer(status, hash)
        nachrichten = []
        if (makro) nachrichten.push(...faelligePushes(makro, schonGesendet, jetzt, appUrl))
        if (tracker) nachrichten.push(...faelligeTrackerPushes(trackerFuer(tracker, u.tracker), schonGesendet, jetzt, trackerUrl))
      }
      if (nachrichten.length === 0) continue
      const sub: PushSubscription = { endpoint: abo.endpoint, keys: abo.keys, expirationTime: abo.expirationTime ?? null }
      for (const n of nachrichten) {
        try {
          await webpush.sendNotification(sub, JSON.stringify({ titel: n.titel, text: n.text, url: n.url, tag: n.tag }), { TTL: 3600, urgency: 'high' })
          gesendet++
          log('Gesendet an', u.nutzerId, abo.geraet ?? hash, ':', n.key, '–', n.titel)
          if (!test) markiere(status, n.key, hash, new Date().toISOString())
        } catch (e) {
          fehler++
          const code = e instanceof WebPushError ? e.statusCode : undefined
          log('Fehler bei', u.nutzerId, abo.geraet ?? hash, n.key, code ?? '', (e as Error).message)
          if (code === 404 || code === 410) {
            abgelaufen.push({ nutzerId: u.nutzerId, endpoint: abo.endpoint })
            break // dieses Gerät ist weg, Rest der Nachrichten sparen
          }
          if (!test && code !== undefined && code >= 400 && code < 500 && code !== 429) {
            // Dauerhafter Fehler: nicht bei jedem Lauf erneut versuchen
            markiere(status, n.key, hash, `fehler ${code} ${new Date().toISOString()}`)
          }
        }
      }
    }
  }
  log(gesendet, 'gesendet,', fehler, 'Fehler,', abgelaufen.length, 'abgelaufen')

  if (secret) await abgelaufenMelden(workerUrl, secret, abgelaufen.filter((a) => a.nutzerId !== 'legacy'))
  if (abgelaufen.some((a) => a.nutzerId === 'legacy')) log('Das alte Einzel-Abo (PUSH_SUBSCRIPTION) ist abgelaufen – Secret löschen, Push läuft über die App.')

  if (!test) {
    aufraeumen(status, Date.now(), AUFBEWAHRUNG_MS)
    const neu = JSON.stringify(status, null, 2) + '\n'
    const altText = existsSync(STATUS) ? readFileSync(STATUS, 'utf8') : ''
    if (neu !== altText) writeFileSync(STATUS, neu)
  }
  if (fehler && test) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
