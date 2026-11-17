// Preiszonen-Alarme: holt die Zonen aller Nutzer vom Worker, lädt Kurse der betroffenen Märkte (Yahoo,
// Bitcoin notfalls Coinbase), prüft sie (src/zonen/alarm.ts), verschickt Web-Push und speichert den
// Alarm-Zustand zurück in den Worker. Nichts davon landet im (öffentlichen) Repo.
//   npx tsx scripts/tracker/zonen-alarm.ts             → prüfen, pushen, Zustand speichern
//   npx tsx scripts/tracker/zonen-alarm.ts --trocken   → nur prüfen und ausgeben
// Env: AKTIEN_WORKER_URL (optional), AKTIEN_SECRET (Dienst-Token), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT, APP_URL; ZONEN_LAUF=nur → nur Märkte, die rund um die Uhr handeln (Lauf außerhalb der Tracker-Zeiten).
// Reihenfolge: erst pushen, dann speichern – scheitert das Speichern, kommt ein Alarm lieber doppelt als gar nicht.

import webpush, { WebPushError, type PushSubscription } from 'web-push'
import type { Candle } from '../../src/types'
import { alarmNachricht, pruefeZonen, type MarktDaten, type ZonenAlarm, type ZonenStatus } from '../../src/zonen/alarm'
import { RUND_UM_DIE_UHR, ZONEN_MARKT_NACH_ID, type ZonenMarktId, type ZonenStand } from '../../src/zonen/types'

const STANDARD_WORKER_URL = 'https://chart-akademie-aktien.chart-akademie.workers.dev'
const STANDARD_APP_URL = 'https://maximilianschettle-maker.github.io/chart-akademie/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
/** Höchstzahl Pushes je Nutzer und Lauf (Schutz vor einer Flut bei vielen eng liegenden Zonen) */
const MAX_JE_NUTZER = 8
const COINBASE: Partial<Record<ZonenMarktId, string>> = { bitcoin: 'BTC-USD' }

interface Abo extends PushSubscription {
  geraet?: string
}
interface Nutzer {
  nutzerId: string
  stand: ZonenStand
  status: ZonenStatus | null
  abos: Abo[]
}

function log(...t: unknown[]) {
  console.log(new Date().toISOString().slice(11, 19), ...t)
}

async function hole(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,*/*', ...headers }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} für ${url.split('?')[0]}`)
  return res.json()
}

// ── Kurse ─────────────────────────────────────────────────────────────────────

interface YahooChart {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; regularMarketTime?: number }
      timestamp?: number[]
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] }
    }[]
    error?: { description?: string } | null
  }
}

export function kerzenAusYahoo(json: YahooChart): { kerzen: Candle[]; kurs?: number; kursZeit?: number } {
  const r = json.chart?.result?.[0]
  const q = r?.indicators?.quote?.[0]
  if (!r?.timestamp || !q) throw new Error(json.chart?.error?.description ?? 'Yahoo: leere Antwort')
  const kerzen: Candle[] = []
  r.timestamp.forEach((time, i) => {
    const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]]
    if ([o, h, l, c].every((x) => typeof x === 'number' && Number.isFinite(x))) kerzen.push({ time, open: o!, high: h!, low: l!, close: c!, volume: 0 })
  })
  kerzen.sort((a, b) => a.time - b.time)
  const kurs = r.meta?.regularMarketPrice
  const zeit = r.meta?.regularMarketTime
  return { kerzen, kurs: typeof kurs === 'number' ? kurs : undefined, kursZeit: typeof zeit === 'number' ? zeit * 1000 : undefined }
}

const yahoo = async (symbol: string, bereich: string) =>
  kerzenAusYahoo((await hole(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${bereich}`)) as YahooChart)

/** Coinbase: [time, low, high, open, close, volume], neueste zuerst */
async function coinbase(produkt: string, sek: number): Promise<Candle[]> {
  const roh = (await hole(`https://api.exchange.coinbase.com/products/${produkt}/candles?granularity=${sek}`)) as number[][]
  if (!Array.isArray(roh)) throw new Error('Coinbase: unerwartete Antwort')
  return roh
    .filter((z) => Array.isArray(z) && z.length >= 5)
    .map((z) => ({ time: z[0], low: z[1], high: z[2], open: z[3], close: z[4], volume: 0 }))
    .sort((a, b) => a.time - b.time)
}

/** 15-Minuten-, Stunden- und Tageskerzen eines Markts; welche gebraucht werden, bestimmen die Zeiteinheiten der Zonen */
async function ladeMarkt(markt: ZonenMarktId, einheiten: Set<string>, jetzt: number): Promise<MarktDaten> {
  const symbol = ZONEN_MARKT_NACH_ID[markt].symbol
  const mitStunde = einheiten.has('1h') || einheiten.has('4h')
  const mitTag = einheiten.has('1d')
  try {
    const m15 = await yahoo(symbol, 'range=5d&interval=15m')
    if (m15.kurs === undefined || m15.kursZeit === undefined) throw new Error('Yahoo: kein aktueller Kurs')
    return {
      kurs: m15.kurs,
      kursZeit: m15.kursZeit,
      k15: m15.kerzen,
      k1h: mitStunde ? (await yahoo(symbol, 'range=1mo&interval=1h')).kerzen : [],
      k1d: mitTag ? (await yahoo(symbol, 'range=6mo&interval=1d')).kerzen : [],
    }
  } catch (e) {
    const produkt = COINBASE[markt]
    if (!produkt) throw e
    log(markt, 'Yahoo fehlgeschlagen, Coinbase:', (e as Error).message)
    const k15 = await coinbase(produkt, 900)
    if (k15.length === 0) throw new Error('Coinbase: keine Kerzen')
    return { kurs: k15[k15.length - 1].close, kursZeit: jetzt, k15, k1h: mitStunde ? await coinbase(produkt, 3600) : [], k1d: mitTag ? await coinbase(produkt, 86_400) : [] }
  }
}

// ── Lauf ──────────────────────────────────────────────────────────────────────

async function main() {
  const trocken = process.argv.includes('--trocken')
  const workerUrl = (process.env.AKTIEN_WORKER_URL?.trim() || STANDARD_WORKER_URL).replace(/\/+$/, '')
  const secret = process.env.AKTIEN_SECRET?.trim()
  const appUrl = (process.env.APP_URL?.trim() || STANDARD_APP_URL).replace(/#.*$/, '')
  const nurRund = process.env.ZONEN_LAUF?.trim() === 'nur'
  if (!secret) {
    log('AKTIEN_SECRET fehlt – Zonen-Alarme übersprungen')
    return
  }
  const auth = { Authorization: `Bearer ${secret}` }
  const nutzer = ((await hole(`${workerUrl}/api/dienst/zonen`, auth)) as { nutzer?: Nutzer[] }).nutzer ?? []
  if (nutzer.length === 0) {
    log('Keine Zonen mit Alarm')
    return
  }

  // Märkte und Zeiteinheiten aller Alarm-Zonen
  const bedarf = new Map<ZonenMarktId, Set<string>>()
  for (const n of nutzer) {
    for (const z of n.stand.zonen) {
      if (!z.alarm || (nurRund && !RUND_UM_DIE_UHR.includes(z.markt))) continue
      bedarf.set(z.markt, (bedarf.get(z.markt) ?? new Set()).add(z.zeiteinheit))
    }
  }
  const jetzt = Date.now()
  const daten: Partial<Record<ZonenMarktId, MarktDaten>> = {}
  let kursFehler = 0
  for (const [markt, einheiten] of bedarf) {
    try {
      daten[markt] = await ladeMarkt(markt, einheiten, jetzt)
      log(ZONEN_MARKT_NACH_ID[markt].name, 'Kurs', daten[markt]!.kurs, `(${Math.round((jetzt - daten[markt]!.kursZeit) / 60_000)} min alt)`)
    } catch (e) {
      kursFehler++
      log(ZONEN_MARKT_NACH_ID[markt].name, 'keine Kurse:', (e as Error).message)
    }
  }

  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const pushBereit = Boolean(pub && priv) && !trocken
  if (pushBereit) webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:chart-akademie@users.noreply.github.com', pub!, priv!)
  else if (!trocken) log('VAPID-Schlüssel fehlen – Alarme werden gespeichert, aber nicht gepusht')

  const speichern: { nutzerId: string; status: ZonenStatus }[] = []
  const abgelaufen: { nutzerId: string; endpoint: string }[] = []
  let gesendet = 0
  let fehler = 0

  for (const n of nutzer) {
    const r = pruefeZonen(n.stand, n.status, daten, jetzt)
    if (!r.geaendert) continue
    speichern.push({ nutzerId: n.nutzerId, status: r.status })
    const alarme: ZonenAlarm[] = r.alarme.slice(0, MAX_JE_NUTZER)
    for (const a of alarme) {
      const nachricht = alarmNachricht(a)
      log(n.nutzerId, '→', nachricht.titel, '|', nachricht.text)
      if (!pushBereit) continue
      const payload = JSON.stringify({ titel: nachricht.titel, text: nachricht.text, url: `${appUrl}#${nachricht.pfad}`, tag: nachricht.tag })
      for (const abo of n.abos) {
        if (abgelaufen.some((x) => x.endpoint === abo.endpoint)) continue
        try {
          await webpush.sendNotification({ endpoint: abo.endpoint, keys: abo.keys, expirationTime: abo.expirationTime ?? null }, payload, { TTL: 1800, urgency: 'high' })
          gesendet++
        } catch (e) {
          fehler++
          const code = e instanceof WebPushError ? e.statusCode : undefined
          log('Push-Fehler', n.nutzerId, abo.geraet ?? '', code ?? '', (e as Error).message)
          if (code === 404 || code === 410) abgelaufen.push({ nutzerId: n.nutzerId, endpoint: abo.endpoint })
        }
      }
    }
    if (alarme.length && n.abos.length === 0) log(n.nutzerId, 'hat kein Push-Abo – Alarm nur in der App sichtbar')
  }
  log(`${nutzer.length} Nutzer, ${bedarf.size} Märkte, ${gesendet} Pushes, ${fehler} Fehler, ${speichern.length} Zustände geändert${trocken ? ' (trocken: nichts gespeichert)' : ''}`)
  if (trocken) return

  const post = (pfad: string, body: unknown) =>
    fetch(`${workerUrl}${pfad}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) })
  if (speichern.length) {
    const res = await post('/api/dienst/zonen/status', { nutzer: speichern })
    if (!res.ok) throw new Error(`Zustand nicht gespeichert: Worker antwortet ${res.status}`)
  }
  if (abgelaufen.length) await post('/api/dienst/push/abgelaufen', { abgelaufen }).catch((e) => log('Abgelaufene Abos nicht gemeldet:', (e as Error).message))
  if (kursFehler) process.exitCode = 2
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
