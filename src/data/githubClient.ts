import {
  type SyncStand,
  type SyncTeil,
  SYNC_DATEI,
  SYNC_NAME,
  dateiLesen,
  dateiText,
  teilUmfang,
  teilZusammenfuehren,
} from '../engine/gitSync'

// GitHub als Ablage für den Nutzerstand: je Teil (Journal, Lernfortschritt) eine
// JSON-Datei, gelesen und geschrieben über die Contents-API direkt aus dem Browser
// (api.github.com erlaubt CORS). Authentifizierung per Personal Access Token.

const API = 'https://api.github.com'

export interface GitZiel {
  /** owner/name */
  repo: string
  /** Ordner im Repo, leer = Wurzel */
  ordner: string
  token: string
}

export class GitFehler extends Error {
  status: number
  constructor(text: string, status: number) {
    super(text)
    this.status = status
  }
}

export function zuBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function vonBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

async function anfrage(token: string, pfad: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(API + pfad, {
      ...init,
      // GitHub erlaubt 60 s Browser-Cache — ein veralteter sha ließe den nächsten Push scheitern
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    })
  } catch {
    throw new GitFehler('GitHub ist nicht erreichbar — bist du online?', 0)
  }
  if (res.status === 401) throw new GitFehler('Das Token ist ungültig oder abgelaufen.', 401)
  if (res.status === 403 || res.status === 429) {
    throw new GitFehler(
      res.headers.get('x-ratelimit-remaining') === '0'
        ? 'GitHub-Anfragelimit erreicht — in ein paar Minuten nochmal versuchen.'
        : 'Kein Zugriff — das Token braucht für dieses Repository „Contents: Read and write“.',
      res.status,
    )
  }
  return res
}

async function mussOk(res: Response, was: string): Promise<Response> {
  if (!res.ok) throw new GitFehler(`${was} fehlgeschlagen (GitHub antwortet mit ${res.status}).`, res.status)
  return res
}

function dateiPfad(ziel: GitZiel, name: string): string {
  const teile = [...ziel.ordner.split('/').filter(Boolean), name].map(encodeURIComponent)
  return `/repos/${ziel.repo}/contents/${teile.join('/')}`
}

/** Repositories, auf die das Token zugreifen kann — zuletzt benutzte zuerst. */
export async function reposAuflisten(token: string): Promise<string[]> {
  const res = await mussOk(await anfrage(token, '/user/repos?per_page=100&sort=pushed'), 'Repositories laden')
  const liste = (await res.json()) as { full_name: string }[]
  return liste.map((r) => r.full_name)
}

/** Prüft Erreichbarkeit und (für den Push) Schreibrecht. */
async function repoPruefen(ziel: GitZiel, schreiben: boolean): Promise<void> {
  const res = await anfrage(ziel.token, `/repos/${ziel.repo}`)
  if (res.status === 404) {
    throw new GitFehler(`Repository „${ziel.repo}“ nicht gefunden — oder das Token hat keinen Zugriff darauf.`, 404)
  }
  await mussOk(res, 'Repository prüfen')
  const repo = (await res.json()) as { permissions?: { push?: boolean } }
  if (schreiben && repo.permissions && !repo.permissions.push) {
    throw new GitFehler('Das Token darf in dieses Repository nicht schreiben („Contents: Read and write“ fehlt).', 403)
  }
}

async function dateiHolen(ziel: GitZiel, name: string): Promise<{ text: string; sha: string } | null> {
  const pfad = dateiPfad(ziel, name)
  const res = await anfrage(ziel.token, pfad)
  if (res.status === 404) return null
  await mussOk(res, `${name} lesen`)
  const j = (await res.json()) as { content?: string; sha?: string; size?: number }
  if (typeof j.sha !== 'string') throw new GitFehler(`„${name}“ ist im Repository keine Datei.`, 422)
  if (j.content || !j.size) return { text: vonBase64(j.content ?? ''), sha: j.sha }
  // Über 1 MB liefert die Contents-API den Inhalt nur noch roh
  const roh = await mussOk(
    await anfrage(ziel.token, pfad, { headers: { Accept: 'application/vnd.github.raw+json' } }),
    `${name} lesen`,
  )
  return { text: await roh.text(), sha: j.sha }
}

async function dateiSchreiben(
  ziel: GitZiel,
  name: string,
  text: string,
  sha: string | undefined,
  nachricht: string,
): Promise<Response> {
  return anfrage(ziel.token, dateiPfad(ziel, name), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: nachricht, content: zuBase64(text), sha }),
  })
}

/** Erster Abschnitt des Ordner-Pfads, der im Repository eine Datei statt eines Ordners ist. */
async function ordnerIstDatei(ziel: GitZiel): Promise<string | null> {
  const teile = ziel.ordner.split('/').filter(Boolean)
  for (let i = 1; i <= teile.length; i++) {
    const pfad = teile.slice(0, i)
    const res = await anfrage(ziel.token, `/repos/${ziel.repo}/contents/${pfad.map(encodeURIComponent).join('/')}`)
    if (res.status === 404) return null
    if (res.ok && !Array.isArray(await res.json())) return pfad.join('/')
  }
  return null
}

function keineSyncDatei(teil: SyncTeil): GitFehler {
  return new GitFehler(`„${SYNC_DATEI[teil]}“ im Repository ist keine ChartAkademie-Datei.`, 422)
}

/** Holt die gewählten Teile; ein Teil fehlt im Ergebnis, wenn seine Datei noch nicht existiert. */
export async function standHolen(ziel: GitZiel, teile: SyncTeil[]): Promise<Partial<SyncStand>> {
  await repoPruefen(ziel, false)
  const stand: Partial<SyncStand> = {}
  const lesen = async <T extends SyncTeil>(teil: T) => {
    const datei = await dateiHolen(ziel, SYNC_DATEI[teil])
    if (!datei) return
    const daten = dateiLesen(teil, datei.text)
    if (!daten) throw keineSyncDatei(teil)
    stand[teil] = daten
  }
  await Promise.all(teile.map(lesen))
  return stand
}

/**
 * Schreibt die gewählten Teile ins Repository (ein Commit je geänderter Datei).
 * Ohne `ersetzen` wird vorher mit dem Stand im Repository zusammengeführt, damit
 * nichts verloren geht, was ein anderes Gerät gepusht hat. Liefert die Teile,
 * die tatsächlich geschrieben wurden — unveränderte ergeben keinen Commit.
 */
export async function standPushen(
  ziel: GitZiel,
  teile: SyncTeil[],
  lokal: SyncStand,
  ersetzen = false,
): Promise<SyncTeil[]> {
  await repoPruefen(ziel, true)
  const geschrieben: SyncTeil[] = []
  const schreiben = async <T extends SyncTeil>(teil: T) => {
    const name = SYNC_DATEI[teil]
    for (let versuch = 0; ; versuch++) {
      const datei = await dateiHolen(ziel, name)
      let stand = lokal[teil]
      if (datei && !ersetzen) {
        const entfernt = dateiLesen(teil, datei.text)
        if (!entfernt) throw keineSyncDatei(teil)
        stand = teilZusammenfuehren(teil, entfernt, stand)
      }
      const text = dateiText(teil, stand)
      if (datei?.text === text) return
      const res = await dateiSchreiben(
        ziel,
        name,
        text,
        datei?.sha,
        `ChartAkademie: ${SYNC_NAME[teil]} (${teilUmfang(teil, stand)})`,
      )
      if (res.status === 409 || res.status === 422) {
        // Liegt dort, wo der Ordner hin soll, eine Datei, kann GitHub ihn nicht anlegen
        const blockiert = await ordnerIstDatei(ziel)
        if (blockiert) {
          throw new GitFehler(
            `Im Repository liegt eine Datei namens „${blockiert}“ — dort kann kein Ordner entstehen. Datei löschen oder einen anderen Ordner wählen.`,
            res.status,
          )
        }
        // sonst: zwischen Lesen und Schreiben hat ein anderes Gerät gepusht → einmal neu ansetzen
        if (res.status === 409 && versuch === 0) {
          await new Promise((r) => setTimeout(r, 700))
          continue
        }
      }
      await mussOk(res, `${name} schreiben`)
      geschrieben.push(teil)
      return
    }
  }
  // nacheinander: zwei gleichzeitige Commits auf denselben Branch stoßen sich gegenseitig ab
  for (const teil of teile) await schreiben(teil)
  return geschrieben
}
