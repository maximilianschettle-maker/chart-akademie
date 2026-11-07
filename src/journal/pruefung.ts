import { anfrage } from '../aktien/data/client'
import type { PruefungAntwort } from './pruefungTypes'
import type { TradeFakten } from './fakten'

// KI-Prüfung über den Worker: nur Fakten gehen raus (keine Kerzen), zurück kommt das Urteil.

export async function tradePruefen(fakten: TradeFakten): Promise<PruefungAntwort> {
  const r = await anfrage<PruefungAntwort>('/api/ki/pruefung', {
    method: 'POST',
    body: JSON.stringify({ fakten }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!r) throw new Error('Leere Antwort vom Worker.')
  return r
}
