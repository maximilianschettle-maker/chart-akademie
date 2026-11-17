// Cron-Wecker: Cloudflare ruft `scheduled` zuverlässig auf; GitHubs eigener Scheduler ließ am
// 29.10.2026 von ~45 geplanten Tracker-Läufen zwei laufen. Deshalb stößt der Worker die
// GitHub Actions per workflow_dispatch an. Die Schedules in den Workflows bleiben als Fallback.
//
// Braucht das Secret GITHUB_DISPATCH_TOKEN: feingranulares Token nur für dieses Repo mit
// „Actions: Read and write“ (`npx wrangler secret put GITHUB_DISPATCH_TOKEN --config worker/wrangler.toml`).
// Ohne Token passiert nichts außer einem Logeintrag.

import { kvLesen, kvSchreiben } from './cache'
import type { Env } from './http'
import { RUND_UM_DIE_UHR } from '../../src/zonen/types'
import { zonenAktiv } from './zonen'

export const REPO_STANDARD = 'maximilianschettle-maker/chart-akademie'

/** Das Makro-Raster der Action: mit diesem Anlass greift dort der Frühausstieg (lauf-noetig.ts) */
export const MAKRO_RASTER = '3,13,23,33,43,53 11-22 * * 2-4'

interface Auftrag {
  workflow: string
  inputs?: Record<string, string>
}

/** Cron-Ausdrücke aus wrangler.toml → Workflow (der Tracker-Cron: siehe trackerLauf). Unbekannte Ausdrücke werden geloggt und ignoriert. */
export const AUFTRAEGE: Record<string, Auftrag> = {
  '0 6 * * *': { workflow: 'macro.yml' },
  '*/10 11-22 * * TUE-THU': { workflow: 'macro.yml', inputs: { anlass: MAKRO_RASTER } },
  '23 * * * *': { workflow: 'board.yml' },
}

/**
 * Ein Cron für den Tracker (Cloudflare erlaubt im freien Tarif nur fünf Trigger): alle 15 Minuten,
 * was läuft, entscheidet die Uhrzeit. „voll“ = Tracker + Zonen wie bisher (Mo–Fr 07–22 Uhr UTC alle
 * 15 Minuten, Sa/So alle zwei Stunden), sonst „zonen“ = nur die Preiszonen der Märkte, die rund um
 * die Uhr handeln (Bitcoin) – und auch das nur, wenn jemand dort eine Zone mit Alarm hat.
 */
export const TRACKER_CRON = '*/15 * * * *'

export function trackerLauf(zeit: Date): 'voll' | 'zonen' {
  const tag = zeit.getUTCDay()
  const stunde = zeit.getUTCHours()
  if (tag >= 1 && tag <= 5) return stunde >= 7 && stunde <= 22 ? 'voll' : 'zonen'
  return zeit.getUTCMinutes() === 0 && stunde % 2 === 0 ? 'voll' : 'zonen'
}

async function trackerAuftrag(env: Env, zeit: Date): Promise<Auftrag | null> {
  if (trackerLauf(zeit) === 'voll') return { workflow: 'tracker.yml' }
  return (await zonenAktiv(env, RUND_UM_DIE_UHR)) ? { workflow: 'tracker.yml', inputs: { nur: 'zonen' } } : null
}

export interface CronStatus {
  /** je Workflow: letzter erfolgreicher Anstoß (ISO) */
  zuletzt: Record<string, string>
  letzterFehler?: { zeit: string; workflow: string; text: string }
  laeufe: number
}

export const CRON_STATUS_KEY = 'cron:status'

export async function workflowStarten(env: Env, auftrag: Auftrag): Promise<void> {
  const repo = env.GITHUB_REPO?.trim() || REPO_STANDARD
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${auftrag.workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'chart-akademie-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', ...(auftrag.inputs ? { inputs: auftrag.inputs } : {}) }),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status !== 204) {
    const text = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`GitHub antwortet ${res.status}${text ? `: ${text}` : ''}`)
  }
}

export async function cronLauf(cron: string, env: Env, zeitMs = Date.now()): Promise<void> {
  const auftrag = cron === TRACKER_CRON ? await trackerAuftrag(env, new Date(zeitMs)) : AUFTRAEGE[cron]
  if (!auftrag) {
    // Tracker-Cron außerhalb der Tracker-Zeiten ohne Rund-um-die-Uhr-Zone: nichts zu tun
    if (cron !== TRACKER_CRON) console.warn(`Cron „${cron}“ hat keinen Auftrag`)
    return
  }
  if (!env.GITHUB_DISPATCH_TOKEN) {
    console.warn(`Cron ${cron}: GITHUB_DISPATCH_TOKEN fehlt – ${auftrag.workflow} wird nicht angestoßen`)
    return
  }
  const alt = (await kvLesen<CronStatus>(env, CRON_STATUS_KEY))?.daten ?? { zuletzt: {}, laeufe: 0 }
  const jetzt = new Date().toISOString()
  try {
    await workflowStarten(env, auftrag)
    console.log(`Cron ${cron}: ${auftrag.workflow} angestoßen`)
    const status: CronStatus = { ...alt, zuletzt: { ...alt.zuletzt, [auftrag.workflow]: jetzt }, laeufe: alt.laeufe + 1 }
    // KV schonen: Erfolge nur einmal je Stunde und Workflow festhalten, Fehler immer
    const vorher = alt.zuletzt[auftrag.workflow]
    if (!vorher || vorher.slice(0, 13) !== jetzt.slice(0, 13) || alt.letzterFehler) {
      delete status.letzterFehler
      await kvSchreiben(env, CRON_STATUS_KEY, status)
    }
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e)
    console.error(`Cron ${cron}: ${auftrag.workflow} nicht angestoßen – ${text}`)
    await kvSchreiben(env, CRON_STATUS_KEY, { ...alt, letzterFehler: { zeit: jetzt, workflow: auftrag.workflow, text } })
  }
}
