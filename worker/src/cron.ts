// Cron-Wecker: Cloudflare ruft `scheduled` zuverlässig auf; GitHubs eigener Scheduler ließ am
// 29.10.2026 von ~45 geplanten Tracker-Läufen zwei laufen. Deshalb stößt der Worker die
// GitHub Actions per workflow_dispatch an. Die Schedules in den Workflows bleiben als Fallback.
//
// Braucht das Secret GITHUB_DISPATCH_TOKEN: feingranulares Token nur für dieses Repo mit
// „Actions: Read and write“ (`npx wrangler secret put GITHUB_DISPATCH_TOKEN --config worker/wrangler.toml`).
// Ohne Token passiert nichts außer einem Logeintrag.

import { kvLesen, kvSchreiben } from './cache'
import type { Env } from './http'

export const REPO_STANDARD = 'maximilianschettle-maker/chart-akademie'

/** Das Makro-Raster der Action: mit diesem Anlass greift dort der Frühausstieg (lauf-noetig.ts) */
export const MAKRO_RASTER = '3,13,23,33,43,53 11-22 * * 2-4'

interface Auftrag {
  workflow: string
  inputs?: Record<string, string>
}

/** Cron-Ausdrücke aus wrangler.toml → Workflow. Unbekannte Ausdrücke werden geloggt und ignoriert. */
export const AUFTRAEGE: Record<string, Auftrag> = {
  '*/15 7-22 * * MON-FRI': { workflow: 'tracker.yml' },
  '0 */2 * * SAT,SUN': { workflow: 'tracker.yml' },
  '0 6 * * *': { workflow: 'macro.yml' },
  '*/10 11-22 * * TUE-THU': { workflow: 'macro.yml', inputs: { anlass: MAKRO_RASTER } },
  '23 * * * *': { workflow: 'board.yml' },
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

export async function cronLauf(cron: string, env: Env): Promise<void> {
  const auftrag = AUFTRAEGE[cron]
  if (!auftrag) {
    console.warn(`Cron „${cron}“ hat keinen Auftrag`)
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
