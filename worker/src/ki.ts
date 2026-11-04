import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { HttpFehler, type Env } from './http'
import type { BildTyp, ScreenshotErgebnis } from '../../src/journal/positionTypes'

// Claude im Worker: der API-Schlüssel bleibt hier (wrangler secret ANTHROPIC_API_KEY), die App
// schickt nur Bilder bzw. Fakten. Erster Nutzer: Broker-Screenshots (eToro) → Positionen fürs Journal.

export const KI_MODELL = 'claude-opus-5-5'

const PositionSchema = z.object({
  brokerId: z.string().nullable(),
  instrument: z.string(),
  richtung: z.enum(['kaufen', 'verkaufen']).nullable(),
  hebel: z.number().nullable(),
  kontrakte: z.number().nullable(),
  positionsgroesse: z.number().nullable(),
  einsatz: z.number().nullable(),
  eroeffnungskurs: z.number().nullable(),
  eroeffnungsdatum: z.string().nullable(),
  stopLoss: z.number().nullable(),
  takeProfit: z.number().nullable(),
  gewinnVerlust: z.number().nullable(),
  uebernachtgebuehren: z.number().nullable(),
  status: z.enum(['offen', 'geschlossen']),
  schlusskurs: z.number().nullable(),
  schlussdatum: z.string().nullable(),
})

const AntwortSchema = z.object({
  positionen: z.array(PositionSchema),
  hinweis: z.string().nullable(),
})

const SYSTEM = `Du liest Screenshots einer Broker-App (meist eToro, deutsche Oberfläche) und gibst die darauf sichtbaren Positionen als Daten zurück.

Regeln:
- Nur ablesen, nie schätzen oder ergänzen. Ein Wert, der nicht im Bild steht, ist null.
- Eine Positionsinfo-Ansicht enthält genau eine Position. Eine Portfolio- oder Historienliste enthält mehrere; dann alle zurückgeben, in der Reihenfolge des Bildes.
- "Kaufen" = richtung "kaufen" (Long), "Verkaufen" = richtung "verkaufen" (Short).
- Zahlen als reine Zahlen ohne Währungszeichen und ohne Tausendertrenner, Punkt als Dezimaltrenner ("$28,497.70" → 28497.7). Verluste negativ ("▼ $3.34" oder rot = negativ).
- "X20" oder "x20" = hebel 20. "CFD" ist nur ein Hinweis auf den Produkttyp.
- "SL/TP"-Zeile wie "SL 27900 / TP 29934.87": stopLoss 27900, takeProfit 29934.87. "Kein SL" oder "–" = null.
- "Marge" oder "Betrag" oder "Investiert" = einsatz. "Positionsgröße" = positionsgroesse. "Kontrakte" oder "Einheiten" = kontrakte.
- Datumsangaben wie "04 Nov 2026, 17:02" oder "04.11.2026 17:02" → "2026-11-04T17:02" (Ortszeit wie angezeigt, keine Zeitzonenumrechnung). Monatsnamen können englisch oder deutsch abgekürzt sein.
- Status: eine offene Position (Positionsinfo mit "Position schließen", Portfolio) = "offen". Eine geschlossene Position (Historie, "Geschlossen", mit Schlusskurs oder Schlussdatum) = "geschlossen"; dann schlusskurs und schlussdatum füllen, gewinnVerlust ist der realisierte Betrag.
- "Wert" ist der aktuelle Wert der Position, nicht der Einsatz; die Zahl daneben mit Pfeil ist gewinnVerlust.
- hinweis: kurz auf Deutsch, was nicht lesbar oder mehrdeutig war; sonst null.`

function client(env: Env): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new HttpFehler('ANTHROPIC_API_KEY ist im Worker nicht gesetzt (wrangler secret put ANTHROPIC_API_KEY)', 503)
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 50_000 })
}

/** Positionen aus einem Screenshot (Base64 ohne data:-Präfix) */
export async function positionenAusBild(env: Env, bild: string, typ: BildTyp): Promise<ScreenshotErgebnis> {
  try {
    const antwort = await client(env).messages.parse({
      model: KI_MODELL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: 'low', format: zodOutputFormat(AntwortSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: typ, data: bild } },
            { type: 'text', text: 'Lies alle Positionen aus diesem Screenshot.' },
          ],
        },
      ],
    })
    if (antwort.stop_reason === 'refusal') throw new HttpFehler('Das Modell hat die Auswertung abgelehnt.', 422)
    if (antwort.stop_reason === 'max_tokens') throw new HttpFehler('Antwort des Modells abgeschnitten – Bild zu umfangreich?', 502)
    const daten = antwort.parsed_output
    if (!daten) throw new HttpFehler('Antwort des Modells nicht lesbar.', 502)
    return { positionen: daten.positionen, hinweis: daten.hinweis, modell: antwort.model }
  } catch (e) {
    if (e instanceof HttpFehler) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new HttpFehler('ANTHROPIC_API_KEY wird von Anthropic nicht akzeptiert.', 502)
    if (e instanceof Anthropic.RateLimitError) throw new HttpFehler('Anthropic: Ratenlimit erreicht, gleich nochmal.', 429)
    if (e instanceof Anthropic.APIError) throw new HttpFehler(`Anthropic-Fehler ${e.status ?? ''}: ${e.message}`, 502)
    throw e
  }
}
