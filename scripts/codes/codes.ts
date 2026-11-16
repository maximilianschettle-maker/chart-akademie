// Einladungscodes verwalten (Admin-Endpunkte des Workers). Braucht das Dienst-Token:
//   AKTIEN_SECRET=… npm run codes -- anlegen "Anna" [--id anna] [--admin] [--ki 20]
//   AKTIEN_SECRET=… npm run codes -- liste
//   AKTIEN_SECRET=… npm run codes -- sperren <id> | entsperren <id> | loeschen <id> | limit <id> <n|aus>
// Optionen: --lokal (http://localhost:8787), AKTIEN_WORKER_URL überschreibt die Adresse.
// Der Code erscheint genau einmal im Klartext – hier. Es wird nichts auf Platte geschrieben.
// Im Windows-Terminal: $env:AKTIEN_SECRET="…"; npm run codes -- anlegen "Anna"

const STANDARD_WORKER_URL = 'https://chart-akademie-aktien.chart-akademie.workers.dev'
const APP_URL = 'https://maximilianschettle-maker.github.io/chart-akademie/'

interface Zeile {
  nutzerId: string
  name: string
  rolle: string
  gesperrt?: boolean
  kiLimitTag?: number
  angelegtAm?: number
  zuletzt?: number
}

function hilfe(): never {
  console.log(`Befehle:
  anlegen "<Name>" [--id <id>] [--admin] [--ki <n>]   neuen Code erzeugen (Id: Kleinbuchstaben, Ziffern, Bindestrich)
  liste                                              alle Codes mit Rolle, Limit, zuletzt gesehen
  sperren <id> | entsperren <id>                     Zugang sperren / wieder öffnen
  limit <id> <n|aus>                                 KI-Aufrufe je Tag setzen; "aus" = Standard
  loeschen <id>                                      Code löschen (Daten bleiben im KV)
Optionen: --lokal → http://localhost:8787 (Dienst-Token dort: AKTIEN_SECRET aus worker/.dev.vars)`)
  process.exit(1)
}

function argumente(): { befehl: string; rest: string[]; flags: Map<string, string | true> } {
  const args = process.argv.slice(2)
  const rest: string[] = []
  const flags = new Map<string, string | true>()
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const name = a.slice(2)
      const wert = args[i + 1]
      if (wert !== undefined && !wert.startsWith('--') && ['id', 'ki'].includes(name)) {
        flags.set(name, wert)
        i++
      } else flags.set(name, true)
    } else rest.push(a)
  }
  const [befehl = '', ...weitere] = rest
  return { befehl, rest: weitere, flags }
}

async function main() {
  const { befehl, rest, flags } = argumente()
  if (!befehl) hilfe()
  const secret = process.env.AKTIEN_SECRET?.trim()
  if (!secret) {
    console.error('AKTIEN_SECRET fehlt (Dienst-Token des Workers).')
    process.exit(1)
  }
  const basis = (flags.has('lokal') ? 'http://localhost:8787' : process.env.AKTIEN_WORKER_URL?.trim() || STANDARD_WORKER_URL).replace(/\/+$/, '')

  async function ruf<T>(pfad: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(basis + pfad, {
      ...init,
      headers: { Authorization: `Bearer ${secret}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(20_000),
    })
    const daten = (await res.json().catch(() => null)) as (T & { fehler?: string }) | null
    if (!res.ok) throw new Error(daten?.fehler ?? `HTTP ${res.status}`)
    return daten as T
  }

  const wann = (ms?: number) => (ms ? new Date(ms).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }) : '–')

  switch (befehl) {
    case 'anlegen': {
      const name = rest[0]
      if (!name) hilfe()
      const body: Record<string, unknown> = { name }
      if (typeof flags.get('id') === 'string') body.nutzerId = flags.get('id')
      if (flags.has('admin')) body.rolle = 'admin'
      if (typeof flags.get('ki') === 'string') body.kiLimitTag = Number(flags.get('ki'))
      const r = await ruf<{ code: string; eintrag: Zeile }>('/api/admin/codes', { method: 'POST', body: JSON.stringify(body) })
      console.log(`\nCode für ${r.eintrag.name} (${r.eintrag.rolle}, Id ${r.eintrag.nutzerId}):\n\n  ${r.code}\n\nTeilen-Link:\n  ${APP_URL}#/zugang?code=${encodeURIComponent(r.code)}\n\nDer Code wird nicht noch einmal angezeigt.`)
      return
    }
    case 'liste': {
      const r = await ruf<{ codes: Zeile[] }>('/api/admin/codes')
      if (r.codes.length === 0) {
        console.log('Keine Codes.')
        return
      }
      const breite = Math.max(...r.codes.map((c) => c.nutzerId.length), 8)
      console.log(`${'Id'.padEnd(breite)}  ${'Name'.padEnd(18)}  Rolle   KI/Tag  Status    Angelegt          Zuletzt`)
      for (const c of r.codes) {
        const limit = c.kiLimitTag !== undefined ? String(c.kiLimitTag) : c.rolle === 'admin' ? '∞' : 'Std.'
        console.log(`${c.nutzerId.padEnd(breite)}  ${c.name.slice(0, 18).padEnd(18)}  ${c.rolle.padEnd(6)}  ${limit.padEnd(6)}  ${(c.gesperrt ? 'gesperrt' : 'aktiv').padEnd(8)}  ${wann(c.angelegtAm).padEnd(16)}  ${wann(c.zuletzt)}`)
      }
      return
    }
    case 'sperren':
    case 'entsperren': {
      const id = rest[0]
      if (!id) hilfe()
      await ruf(`/api/admin/codes/${id}`, { method: 'PATCH', body: JSON.stringify({ gesperrt: befehl === 'sperren' }) })
      console.log(`${id}: ${befehl === 'sperren' ? 'gesperrt' : 'wieder aktiv'}`)
      return
    }
    case 'limit': {
      const [id, wert] = rest
      if (!id || !wert) hilfe()
      const kiLimitTag = wert === 'aus' ? null : Number(wert)
      if (kiLimitTag !== null && !Number.isFinite(kiLimitTag)) hilfe()
      await ruf(`/api/admin/codes/${id}`, { method: 'PATCH', body: JSON.stringify({ kiLimitTag }) })
      console.log(`${id}: KI-Limit ${kiLimitTag === null ? 'Standard' : kiLimitTag + ' je Tag'}`)
      return
    }
    case 'loeschen': {
      const id = rest[0]
      if (!id) hilfe()
      await ruf(`/api/admin/codes/${id}`, { method: 'DELETE' })
      console.log(`${id}: Code gelöscht (Daten im KV bleiben)`)
      return
    }
    default:
      hilfe()
  }
}

main().catch((e) => {
  console.error('Fehler:', (e as Error).message)
  process.exit(1)
})
