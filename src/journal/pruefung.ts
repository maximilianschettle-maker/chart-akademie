import { AktienFehler, anfrage } from '../aktien/data/client'
import type { PruefungAntwort } from './pruefungTypes'
import type { TradeFakten } from './fakten'

// KI-Prüfung über den Worker: nur Fakten gehen raus (keine Kerzen), zurück kommt das Urteil.


/** 404 vom Worker heißt hier: der deployte Worker kennt den Endpunkt noch nicht */
function kiFehler(e: unknown): Error {
  if (e instanceof AktienFehler && e.status === 404) return new Error('Der deployte Worker kennt diesen Endpunkt noch nicht – im Projektordner „npm run worker:deploy“ ausführen.')
  return e instanceof Error ? e : new Error(String(e))
}

export async function tradePruefen(fakten: TradeFakten): Promise<PruefungAntwort> {
  try {
    const r = await anfrage<PruefungAntwort>('/api/ki/pruefung', {
      method: 'POST',
      body: JSON.stringify({ fakten }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!r) throw new Error('Leere Antwort vom Worker.')
    return r
  } catch (e) {
    throw kiFehler(e)
  }
}
