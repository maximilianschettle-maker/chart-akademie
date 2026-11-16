// Feste Adresse des Cloudflare Workers. Nutzer tragen nur noch ihren Einladungscode ein.
// Überschreibbar per VITE_WORKER_URL (z.B. für einen zweiten Worker); im Dev-Server läuft
// `npm run worker:dev` auf Port 8787.

const WORKER_URL_PROD = 'https://chart-akademie-aktien.chart-akademie.workers.dev'
const WORKER_URL_DEV = 'http://localhost:8787'

const ausUmgebung = (import.meta.env.VITE_WORKER_URL as string | undefined)?.trim().replace(/\/+$/, '')

export const WORKER_URL: string = ausUmgebung || (import.meta.env.DEV ? WORKER_URL_DEV : WORKER_URL_PROD)

/** Link zum Teilen eines Codes: öffnet die App direkt auf der Zugang-Seite mit vorbelegtem Code. */
export const APP_URL = 'https://maximilianschettle-maker.github.io/chart-akademie/'
export const zugangLink = (code: string) => `${APP_URL}#/zugang?code=${encodeURIComponent(code)}`
