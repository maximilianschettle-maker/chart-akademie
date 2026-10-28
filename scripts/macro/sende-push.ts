// Verschickt fällige Web-Push-Nachrichten (VAPID) an die eine hinterlegte Subscription.
//   node scripts/macro/sende-push.ts            → fällige Pushes laut public/data/macro.json
//   node scripts/macro/sende-push.ts --test "…" → eine Testnachricht, Status bleibt unberührt
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), PUSH_SUBSCRIPTION (JSON
// aus der App), APP_URL (Link, der beim Antippen geöffnet wird).
// Sendestatus: data/push-status.json (wird committet, verhindert Doppel-Pushes bei Cron-Verspätung).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import webpush, { WebPushError, type PushSubscription } from 'web-push'
import type { MakroDaten } from '../../src/makro/types.ts'
import type { TrackerDaten } from '../../src/tracker/types.ts'
import { faelligePushes, faelligeTrackerPushes, type PushNachricht } from './push-logik.ts'

const WURZEL = fileURLToPath(new URL('../../', import.meta.url))
const MAKRO = join(WURZEL, 'public', 'data', 'macro.json')
const TRACKER = join(WURZEL, 'public', 'data', 'tracker.json')
const STATUS = join(WURZEL, 'data', 'push-status.json')
const AUFBEWAHRUNG_MS = 60 * 86400_000
const STANDARD_APP_URL = 'https://maximilianschettle-maker.github.io/chart-akademie/#/makro'

interface Status {
  gesendet: Record<string, string>
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
    if (typeof s.endpoint !== 'string' || !s.keys?.p256dh || !s.keys?.auth) {
      log('PUSH_SUBSCRIPTION: endpoint oder keys fehlen')
      return null
    }
    return s as PushSubscription
  } catch {
    log('PUSH_SUBSCRIPTION ist kein gültiges JSON')
    return null
  }
}

async function main() {
  const testIndex = process.argv.indexOf('--test')
  const test = testIndex >= 0
  const testText = test ? process.argv[testIndex + 1] || 'Testnachricht aus der GitHub Action' : ''

  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:chart-akademie@users.noreply.github.com'
  const appUrl = process.env.APP_URL?.trim() || STANDARD_APP_URL
  const sub = subscriptionAusEnv(process.env.PUSH_SUBSCRIPTION)

  if (!pub || !priv) {
    log('VAPID-Schlüssel fehlen (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) – Push übersprungen')
    if (test) process.exit(1)
    return
  }
  if (!sub) {
    log('Keine Push-Subscription (Secret PUSH_SUBSCRIPTION) – Push übersprungen')
    if (test) process.exit(1)
    return
  }
  webpush.setVapidDetails(subject, pub, priv)

  let nachrichten: PushNachricht[]
  const status = liesStatus()
  if (test) {
    nachrichten = [
      {
        key: `test:${Date.now()}`,
        titel: 'ChartAkademie: Test-Push',
        text: testText,
        url: appUrl,
        tag: 'test',
      },
    ]
  } else {
    nachrichten = []
    if (existsSync(MAKRO)) {
      const daten = JSON.parse(readFileSync(MAKRO, 'utf8')) as MakroDaten
      nachrichten.push(...faelligePushes(daten, status.gesendet, new Date(), appUrl))
    } else {
      log('macro.json fehlt – keine Zins-Pushes')
    }
    if (existsSync(TRACKER)) {
      const tracker = JSON.parse(readFileSync(TRACKER, 'utf8')) as TrackerDaten
      const trackerUrl = appUrl.replace(/#.*$/, '') + '#/tracker'
      nachrichten.push(...faelligeTrackerPushes(tracker, status.gesendet, new Date(), trackerUrl))
    }
  }
  log(nachrichten.length, 'Nachricht(en) fällig')

  let fehler = 0
  for (const n of nachrichten) {
    try {
      await webpush.sendNotification(sub, JSON.stringify({ titel: n.titel, text: n.text, url: n.url, tag: n.tag }), {
        TTL: 3600,
        urgency: 'high',
      })
      log('Gesendet:', n.key, '–', n.titel)
      if (!test) status.gesendet[n.key] = new Date().toISOString()
    } catch (e) {
      fehler++
      const code = e instanceof WebPushError ? e.statusCode : undefined
      log('Fehler bei', n.key, code ?? '', (e as Error).message)
      if (code === 404 || code === 410) log('Die Subscription ist abgelaufen – in der App neu aktivieren und das Secret PUSH_SUBSCRIPTION erneuern.')
      if (!test && code !== undefined && code >= 400 && code < 500 && code !== 429) {
        // Dauerhafter Fehler: nicht bei jedem Lauf erneut versuchen
        status.gesendet[n.key] = `fehler ${code} ${new Date().toISOString()}`
      }
    }
  }

  if (!test) {
    const grenze = Date.now() - AUFBEWAHRUNG_MS
    for (const [key, wert] of Object.entries(status.gesendet)) {
      const zeit = Date.parse(wert.replace(/^fehler \d+ /, ''))
      if (Number.isFinite(zeit) && zeit < grenze) delete status.gesendet[key]
    }
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
